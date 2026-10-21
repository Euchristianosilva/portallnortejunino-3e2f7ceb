import { useEffect, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cleanupImage, validateUpload } from "@/lib/upload";
import { errMsg } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { StoredImage } from "./StoredImage";

export function ImageUpload({ name = "image_url", initialValue = "", label = "Imagem" }: { name?: string; initialValue?: string | null | undefined; label?: string }) {
  const [value, setValue] = useState(initialValue ?? "");
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const localPreview = useRef<string | null>(null);
  const uploaded = useRef<string[]>([]);
  useEffect(() => () => { uploaded.current.forEach(reference => { void cleanupImage(reference); }); }, []);
  async function upload(file?: File) {
    if (!file) return;
    try {
      validateUpload(file);
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("Entre na sua conta para enviar imagens.");
      setBusy(true);
      const url = URL.createObjectURL(file); localPreview.current=url; setPreview(url);
      const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
      const path = `${data.user.id}/${crypto.randomUUID()}.${extension}`;
      const result = await supabase.storage.from("portal-images").upload(path, file, { contentType: file.type, upsert: false });
      if (result.error) throw result.error;
      setValue(`storage:${path}`);
      uploaded.current.push(`storage:${path}`);
      toast.success("Imagem enviada. Salve para confirmar a alteração.");
      setPreview(null);
    } catch (e) { toast.error(errMsg(e)); setPreview(null); }
    finally { if(localPreview.current) URL.revokeObjectURL(localPreview.current); localPreview.current=null; setBusy(false); if (input.current) input.current.value = ""; }
  }
  return <div className="space-y-2">
    <div className="text-sm font-medium">{label} <span className="text-muted-foreground">· JPEG, PNG ou WebP, até 5 MB</span></div>
    <input type="hidden" name={name} value={value} />
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={`Selecionar ${label.toLowerCase()}`} onChange={(e) => upload(e.target.files?.[0])} />
    {(preview || value) && <StoredImage src={preview ?? value} alt={label} className="h-36 w-full rounded-md object-contain bg-muted" />}
    <div className="flex gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => input.current?.click()}><Upload />{busy ? "Enviando imagem…" : value ? "Substituir imagem" : "Selecionar imagem"}</Button>{value && <Button type="button" variant="ghost" size="icon" aria-label="Remover imagem" disabled={busy} onClick={() => setValue("")}><X /></Button>}</div>
    {busy && <input name="upload_pending" value="true" type="hidden" />}
  </div>;
}