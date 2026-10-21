import type { Dossier } from "@/lib/dossier";
import { integrityPayload } from "@/lib/dossier-integrity";

export async function digest(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), b => b.toString(16).padStart(2, "0")).join("");
}

// Called only after the account permission or private capability was verified.
export async function generateDossier(source: Record<string, unknown>, generationId?: string): Promise<{ dossier: Dossier; pdf: string }> {
  const { registration_id: registrationId, ...snapshot } = source;
  if (typeof registrationId !== "string") throw new Error("Inscrição não recuperada.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let dossier: Dossier;
  if (generationId) {
    const saved = await supabaseAdmin.from("registration_dossiers").select("id,generated_at,snapshot,hash").eq("id", generationId).eq("registration_id", registrationId).maybeSingle();
    if (saved.error || !saved.data) throw new Error("Documento não encontrado para esta inscrição.");
    dossier = saved.data as unknown as Dossier;
    if (await digest(integrityPayload(dossier)) !== dossier.hash) throw new Error("A integridade desta geração não foi confirmada. Gere novamente seu documento.");
  } else {
    dossier = { id: crypto.randomUUID(), generated_at: new Date().toISOString(), snapshot: snapshot as unknown as Dossier["snapshot"], hash: "" };
    dossier.hash = await digest(integrityPayload(dossier));
  }
  const { makeDossierPdf } = await import("@/lib/dossier-pdf");
  let pdf: Uint8Array;
  try { pdf = await makeDossierPdf(dossier); } catch { throw new Error("Não foi possível gerar o PDF completo. Nenhum arquivo incompleto foi disponibilizado. Tente novamente."); }
  if (!generationId) {
    const save = await supabaseAdmin.from("registration_dossiers").insert({ id: dossier.id, registration_id: registrationId, generated_at: dossier.generated_at, snapshot: dossier.snapshot as never, hash: dossier.hash });
    if (save.error) throw new Error("Não foi possível preservar esta geração. Tente novamente.");
  }
  let binary = "";
  for (const b of pdf) binary += String.fromCharCode(b);
  return { dossier, pdf: btoa(binary) };
}