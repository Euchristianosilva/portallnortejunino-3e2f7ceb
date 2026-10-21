import { describe, it, expect, vi } from "vitest";
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, inputValidator: () => builder, handler: (handler: unknown) => handler };
  return builder;
} }));
vi.mock("@tanstack/react-start/server", () => ({ setResponseHeader: vi.fn() }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
const generate = vi.hoisted(() => vi.fn(async () => ({ dossier: { id: "generation" }, pdf: "pdf" })));
vi.mock("@/lib/dossier-generation.server", () => ({ generateDossier: generate }));
import { prepareAdminDossier } from "@/lib/dossier.functions";
const handler = prepareAdminDossier as unknown as (input: { data: { registrationId: string; action: string }; context: { supabase: { rpc: ReturnType<typeof vi.fn> } } }) => Promise<unknown>;
describe("Autorizações administrativas no servidor", () => {
  it("recusa usuário sem permissão antes de ler ou gerar documentos", async () => {
    generate.mockClear(); const rpc=vi.fn(async () => ({ error: { message: "Sem permissão" }, data: null }));
    await expect(handler({ data: { registrationId: "candidate", action: "view" }, context: { supabase: { rpc } } })).rejects.toThrow("sem permissão");
    expect(generate).not.toHaveBeenCalled(); expect(rpc).toHaveBeenCalledWith("admin_registration_dossier_source", { _id: "candidate" });
  });
  it("fonte autorizada permite gerar e auditar somente a inscrição solicitada", async () => {
    generate.mockClear(); const rpc=vi.fn().mockResolvedValueOnce({ data: { registration_id: "candidate" }, error: null }).mockResolvedValueOnce({ error: null });
    await handler({ data: { registrationId: "candidate", action: "pdf" }, context: { supabase: { rpc } } });
    expect(generate).toHaveBeenCalledWith({ registration_id: "candidate" }, undefined);
    expect(rpc).toHaveBeenLastCalledWith("audit_registration_dossier", { _id: "candidate", _generation_id: "generation", _action: "pdf" });
  });
});