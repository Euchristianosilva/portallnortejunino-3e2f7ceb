import { supabase } from "@/integrations/supabase/client";

type Editable = "registration_forms" | "polls" | "announcements" | "events" | "opportunities";

/** Update guarded by optimistic concurrency: fails if someone else saved first. */
export async function guardedUpdate(table: Editable, id: string, expectedUpdatedAt: string, values: Record<string, unknown>) {
  const { data, error } = await supabase
    .from(table)
    .update(values as never)
    .eq("id", id)
    .eq("updated_at", expectedUpdatedAt)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Este registro foi alterado por outra pessoa. Feche e abra novamente para ver a versão atual.");
}

export function toLocalInput(d: string | null | undefined) {
  if (!d) return "";
  const dt = new Date(d);
  const off = dt.getTimezoneOffset();
  return new Date(dt.getTime() - off * 60000).toISOString().slice(0, 16);
}
export function fromLocalInput(v: FormDataEntryValue | null) {
  const s = String(v ?? "");
  return s ? new Date(s).toISOString() : null;
}
