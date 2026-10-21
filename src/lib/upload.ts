export const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export function validateUpload(file: Pick<File, "type" | "size">, attachment = false) {
  if (![...IMAGE_TYPES, ...(attachment ? ["application/pdf"] : [])].includes(file.type)) throw new Error(attachment ? "Selecione JPEG, PNG, WebP ou PDF." : "Selecione uma imagem JPEG, PNG ou WebP.");
  if (file.size === 0 || file.size > MAX_UPLOAD_SIZE) throw new Error("O arquivo deve ter até 5 MB e não pode estar vazio.");
}

export async function cleanupImage(reference: string | null | undefined) {
  if (!reference?.startsWith("storage:")) return;
  const { supabase } = await import("@/integrations/supabase/client");
  // DELETE RLS refuses objects that any saved form, poll or option still references.
  await supabase.storage.from("portal-images").remove([reference.slice(8)]);
}