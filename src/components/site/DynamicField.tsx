import { useState } from "react";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { validateUpload } from "@/lib/upload";
import { errMsg, type FormField } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function DynamicField({ field: f, preview = false }: { field: FormField; preview?: boolean }) {
 const name = `f_${f.key}`;
 const [path, setPath] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
 async function upload(file?: File) {
  if (!file) return;
  try { validateUpload(file, true); setBusy(true); setError(""); const { data } = await supabase.auth.getUser(); if (!data.user) throw new Error("Entre na sua conta para enviar um arquivo."); const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1]; const p = `${data.user.id}/${crypto.randomUUID()}.${ext}`; const r = await supabase.storage.from("registration-files").upload(p, file, { contentType: file.type }); if (r.error) throw r.error; setPath(p); } catch(e) { setError(errMsg(e)); } finally { setBusy(false); }
 }
 return <div className="space-y-1.5"><Label htmlFor={name}>{f.label}{f.required && " *"}</Label>
 {f.type === "textarea" ? <Textarea id={name} name={name} required={f.required} maxLength={5000} rows={4} /> : f.type === "select" ? <select id={name} name={name} required={f.required} defaultValue="" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Selecione</option>{f.options?.map(o => <option key={o}>{o}</option>)}</select> : f.type === "radio" || f.type === "multiselect" ? <div className="flex flex-wrap gap-4">{f.options?.map(o => <label key={o} className="flex gap-2 text-sm"><input name={name} type={f.type === "radio" ? "radio" : "checkbox"} value={o} required={f.type === "radio" && f.required} />{o}</label>)}</div> : f.type === "checkbox" ? <input id={name} name={name} type="checkbox" value="true" required={f.required} className="size-5 accent-primary" /> : f.type === "file" ? <div className="space-y-2"><input type="hidden" name={name} value={path} /><label className="inline-flex items-center gap-2 text-sm"><Upload className="size-4" /><input disabled={preview || busy} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => upload(e.target.files?.[0])} /></label><p className="text-xs text-muted-foreground">JPEG, PNG, WebP ou PDF · até 5 MB{busy ? " · Enviando…" : path ? " · Arquivo enviado" : ""}</p>{busy && <input name="upload_pending" value="true" type="hidden" />}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</div> : <Input id={name} name={name} type={f.type === "phone" ? "tel" : f.type} required={f.required} maxLength={500} />}
 {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
 </div>;
}