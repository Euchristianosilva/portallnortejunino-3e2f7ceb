import { describe, it, expect, vi, beforeEach } from "vitest";
import { webcrypto } from "node:crypto";
import type { Dossier } from "@/lib/dossier";
import { dossierSections } from "@/lib/dossier";

const db = vi.hoisted(() => ({ saved: null as unknown, filters: [] as unknown[], inserts: [] as unknown[] }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: () => ({
  select: () => ({ eq: (_key: string, id: string) => { db.filters.push(id); return { eq: (_key: string, registration: string) => { db.filters.push(registration); return { maybeSingle: async () => ({ data: db.saved, error: null }) }; } }; } }),
  insert: async (value: unknown) => { db.inserts.push(value); return { error: null }; },
}) } }));
vi.mock("@/lib/dossier-pdf", () => ({ makeDossierPdf: async () => new Uint8Array([37,80,68,70]) }));
import { generateDossier } from "@/lib/dossier-generation.server";
const source = () => ({ registration_id: "11111111-1111-4111-8111-111111111111", protocol: "9910", full_name: "Candidato A", email: "a@example.org", title: "Formulário", category: "Dança", created_at: "2026-10-17T05:00:00Z", updated_at: "2026-10-17T05:00:00Z", status: "em_analise", form_version: 1, fields: [], answers: {}, consents: [], original: null });
beforeEach(() => { vi.stubGlobal("crypto", webcrypto); db.saved=null; db.filters=[]; db.inserts=[]; });
describe("Gerações administrativas compartilhadas", () => {
  it("geração não modifica cadastro, status ou consentimentos", async () => { const s=source(); const before=JSON.stringify(s); const result=await generateDossier(s); expect(JSON.stringify(s)).toBe(before); expect(result.dossier.snapshot.status).toBe("em_analise"); expect(db.inserts).toHaveLength(1); });
  it("consulta salva é limitada à inscrição solicitada", async () => { await expect(generateDossier(source(),"22222222-2222-4222-8222-222222222222")).rejects.toThrow(); expect(db.filters).toEqual(["22222222-2222-4222-8222-222222222222","11111111-1111-4111-8111-111111111111"]); expect(db.inserts).toHaveLength(0); });
  it("recusa adulteração de geração histórica", async () => { const r=await generateDossier(source()); db.saved={...r.dossier,snapshot:{...r.dossier.snapshot,full_name:"Adulterado"}}; await expect(generateDossier(source(),r.dossier.id)).rejects.toThrow("integridade"); });
  it("reabrir preserva geração antiga sem duplicar inscrição nem geração", async () => { const s=source(); const r=await generateDossier(s); db.saved=r.dossier; s.status="aprovada"; const old=await generateDossier(s,r.dossier.id); expect(old.dossier.snapshot.status).toBe("em_analise"); expect(db.inserts).toHaveLength(1); });
  it("candidatos não compartilham respostas nem identificadores", async () => { const a=await generateDossier(source()); const b=await generateDossier({...source(),registration_id:"33333333-3333-4333-8333-333333333333",protocol:"8877",full_name:"Candidato B"}); expect(a.dossier.id).not.toBe(b.dossier.id); expect(dossierSections(b.dossier).map(s=>s.text).join("\n")).not.toContain("Candidato A"); expect(b.dossier.snapshot.protocol).toBe("8877"); });
});