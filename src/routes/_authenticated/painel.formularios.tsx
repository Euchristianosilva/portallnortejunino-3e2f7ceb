import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ArrowUp, ArrowDown, Eye } from "lucide-react";
import { ImageUpload } from "@/components/site/ImageUpload";
import { cleanupImage } from "@/lib/upload";
import { DynamicField } from "@/components/site/DynamicField";
import { supabase } from "@/integrations/supabase/client";
import { useLiveQueries } from "@/lib/realtime";
import { useAuth } from "@/lib/auth";
import { LiveBadge } from "@/components/site/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtDate, errMsg, formIsOpen, DEFAULT_FIELDS, FIELD_TYPES, type FormField } from "@/lib/format";
import { guardedUpdate, toLocalInput, fromLocalInput } from "@/lib/admin";
import type { Tables } from "@/integrations/supabase/types";
import type { LegalDocument } from "@/lib/dossier";

export const Route = createFileRoute("/_authenticated/painel/formularios")({ head: () => ({ meta: [{ title: "Formulários administrativos — Portal Norte Junino" }, { name: "description", content: "Crie e publique formulários de inscrição." }, { property: "og:title", content: "Formulários administrativos — Portal Norte Junino" }, { property: "og:description", content: "Crie e publique formulários de inscrição." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), component: FormsAdmin });

type Form = Tables<"registration_forms">;

function FormsAdmin() {
  const [editing, setEditing] = useState<Form | "new" | null>(null);
  const list = useQuery({
    queryKey: ["admin", "forms"],
    queryFn: async () => {
      const { data, error } = await supabase.from("registration_forms").select("*").eq("opportunity_managed", false).order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });
  const st = useLiveQueries("admin-forms", [{ table: "registration_forms", keys: [["admin", "forms"]] }]);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Formulários de inscrição</h1>
        <div className="flex items-center gap-3"><LiveBadge status={st} /><Button onClick={() => setEditing("new")}><Plus /> Novo formulário</Button></div>
      </div>
      <div className="mt-6 grid gap-4">
        {list.isLoading ? <p className="text-muted-foreground">Carregando…</p> : !list.data?.length ? <p className="text-muted-foreground">Nenhum formulário criado.</p> :
          list.data.map((f) => (
            <button key={f.id} onClick={() => setEditing(f)} className="portal-interactive-item flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card p-5 text-left shadow-card hover:ring-2 hover:ring-primary/40">
              <div>
                <div className="font-bold">{f.title}</div>
                <div className="text-xs text-muted-foreground">{(f.fields as unknown as FormField[]).length} campo(s) · {fmtDate(f.opens_at)} — {fmtDate(f.closes_at)}</div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${formIsOpen(f) ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {!f.published ? "Rascunho" : formIsOpen(f) ? "Aberto" : "Fechado"}
              </span>
            </button>
          ))}
      </div>
      {editing && <FormEditor form={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function FormEditor({ form, onClose }: { form: Form | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [fields, setFields] = useState<FormField[]>((form?.fields as unknown as FormField[]) ?? DEFAULT_FIELDS.map(f => ({ ...f })));
  const [preview, setPreview] = useState(false);
  const [published, setPublished] = useState(form?.published ?? false);
  const [unique, setUnique] = useState(form?.unique_per_email ?? true);
  const [login, setLogin] = useState(form?.require_login ?? false);
  const [documents,setDocuments]=useState<LegalDocument[]>((form?.legal_documents as unknown as LegalDocument[])??[]);
  const updateDocument=(i:number,p:Partial<LegalDocument>)=>setDocuments(ds=>ds.map((d,j)=>j===i?{...d,...p}:d));

  const save = useMutation({
    mutationFn: async (fd: FormData) => {
      if (fd.has("upload_pending")) throw new Error("Aguarde o envio da imagem antes de salvar.");
      const title = String(fd.get("title")).trim();
      if (title.length < 3) throw new Error("Informe um título.");
      const clean = fields.map((f, i) => ({ ...f, key: f.key || `campo_${i + 1}`, label: f.label.trim() })).filter((f) => f.label);
      const keys = new Set(clean.map((f) => f.key));
      if (keys.size !== clean.length) throw new Error("Há campos com a mesma chave.");
      const values = {
        title,
        description: String(fd.get("description") ?? ""),
        category: String(fd.get("category") ?? ""),
        image_url: String(fd.get("image_url") ?? "") || null,
        opens_at: fromLocalInput(fd.get("opens_at")),
        closes_at: fromLocalInput(fd.get("closes_at")),
        published,
        unique_per_email: unique,
        require_login: login,
        fields: clean,
        legal_documents: documents.map(d=>({...d})),
      };
      if (form) await guardedUpdate("registration_forms", form.id, form.updated_at, values);
      else {
        const { error } = await supabase.from("registration_forms").insert({ ...values, fields: clean as never, created_by: user?.id ?? null });
        if (error) throw error;
      }
      if(form?.image_url !== values.image_url) await cleanupImage(form?.image_url);
    },
    onSuccess: () => { toast.success("Formulário salvo."); qc.invalidateQueries({ queryKey: ["admin", "forms"] }); onClose(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const del = useMutation({
    mutationFn: async () => {
      if (!form) throw new Error("Formulário não encontrado.");
      const { error } = await supabase.from("registration_forms").delete().eq("id", form.id);
      if (error) throw new Error(error.code === "23503" ? "Este formulário já tem inscrições. Despublique em vez de excluir." : error.message);
    },
    onSuccess: () => { toast.success("Excluído."); qc.invalidateQueries({ queryKey: ["admin", "forms"] }); onClose(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const upd = (i: number, p: Partial<FormField>) => setFields((fs) => fs.map((f, j) => (j === i ? { ...f, ...p } : f)));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="theme-light max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{form ? "Editar formulário" : "Novo formulário"}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(new FormData(e.currentTarget)); }} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Título</Label><Input name="title" defaultValue={form?.title} required maxLength={150} /></div>
            <div className="space-y-1.5"><Label>Categoria</Label><Input name="category" defaultValue={form?.category} maxLength={80} /></div>
          </div>
          <div className="space-y-1.5"><Label>Descrição e regras</Label><Textarea name="description" defaultValue={form?.description} rows={4} maxLength={5000} /></div>
          <ImageUpload initialValue={form?.image_url} label="Imagem do formulário" />
          <section className="space-y-4 border-y border-border py-5"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold">Documentos de participação e aceites</h3><Button type="button" size="sm" variant="outline" onClick={()=>setDocuments(ds=>[...ds,{id:crypto.randomUUID(),title:"",kind:"terms",version:"",published_at:new Date().toISOString(),content:"",required:true}])}><Plus/>Documento</Button></div>{documents.map((doc,i)=><div key={doc.id} className="space-y-3 border-b border-border pb-4"><div className="grid gap-3 sm:grid-cols-2"><div><Label>Título do documento</Label><Input value={doc.title} required onChange={e=>updateDocument(i,{title:e.target.value})}/></div><div><Label>Tipo de documento</Label><select className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm" value={doc.kind} onChange={e=>updateDocument(i,{kind:e.target.value as LegalDocument["kind"]})}><option value="terms">Regulamento e termos</option><option value="image">Imagem e voz</option><option value="privacy">Privacidade</option><option value="other">Outro documento</option></select></div><div><Label>Versão</Label><Input required value={doc.version} onChange={e=>updateDocument(i,{version:e.target.value})}/></div><div><Label>Publicação ou vigência</Label><Input type="datetime-local" required value={toLocalInput(doc.published_at)} onChange={e=>updateDocument(i,{published_at:fromLocalInput(e.target.value)??""})}/></div></div><Label>Conteúdo integral</Label><Textarea value={doc.content} rows={8} required onChange={e=>updateDocument(i,{content:e.target.value})}/><div className="flex items-center justify-between"><label className="flex items-center gap-2 text-sm"><Switch checked={doc.required} onCheckedChange={required=>updateDocument(i,{required})}/>Aceite obrigatório</label><Button type="button" variant="ghost" size="icon" aria-label="Remover documento" onClick={()=>setDocuments(ds=>ds.filter((_,j)=>j!==i))}><Trash2/></Button></div></div>)}</section>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Abertura</Label><Input name="opens_at" type="datetime-local" defaultValue={toLocalInput(form?.opens_at)} /></div>
            <div className="space-y-1.5"><Label>Encerramento</Label><Input name="closes_at" type="datetime-local" defaultValue={toLocalInput(form?.closes_at)} /></div>
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <label className="flex items-center gap-2"><Switch checked={published} onCheckedChange={setPublished} /> Publicado</label>
            <label className="flex items-center gap-2"><Switch checked={unique} onCheckedChange={setUnique} /> Uma inscrição por e-mail</label>
            <label className="flex items-center gap-2"><Switch checked={login} onCheckedChange={setLogin} /> Exigir login</label>
          </div>
          <div className="rounded-lg bg-muted p-4">
            <div className="flex items-center justify-between"><h3 className="font-bold">Campos (nome e e-mail já são incluídos)</h3>
              <Button type="button" size="sm" variant="outline" onClick={() => setFields([...fields, { key: `campo_${crypto.randomUUID().replaceAll("-", "")}`, label: "", type: "text", required: false }])}><Plus /> Campo</Button>
            </div>
            <div className="mt-3 space-y-3">
              {fields.map((f, i) => (
                <div key={i} className="grid gap-2 rounded-lg bg-card p-3 md:grid-cols-[1fr_130px_120px_auto_auto]">
                  <Input placeholder="Rótulo" value={f.label} onChange={(e) => upd(i, { label: e.target.value })} />
                  <select value={f.type} onChange={(e) => upd(i, { type: e.target.value as FormField["type"] })} className="h-9 rounded-md border border-input bg-card px-2 text-sm">
                    {Object.entries(FIELD_TYPES).map(([t, label]) => <option key={t} value={t}>{label}</option>)}
                  </select>
                  <Input placeholder="chave" value={f.key} onChange={(e) => upd(i, { key: e.target.value.replace(/[^a-z0-9_]/gi, "").toLowerCase() })} />
                  <label className="flex items-center gap-2 text-xs"><Switch checked={f.required} onCheckedChange={(v) => upd(i, { required: v })} /> Obrig.</label>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setFields(fields.filter((_, j) => j !== i))}><Trash2 /></Button>
                  <div className="flex gap-1 md:col-span-5"><Button type="button" size="icon" variant="ghost" aria-label="Mover campo para cima" disabled={i===0} onClick={() => setFields(fs => { const a=[...fs]; const current=a[i]; const previous=a[i-1]; if(current && previous) { a[i-1]=current; a[i]=previous; } return a; })}><ArrowUp /></Button><Button type="button" size="icon" variant="ghost" aria-label="Mover campo para baixo" disabled={i===fields.length-1} onClick={() => setFields(fs => { const a=[...fs]; const current=a[i]; const next=a[i+1]; if(current && next) { a[i+1]=current; a[i]=next; } return a; })}><ArrowDown /></Button><Input placeholder="Texto de ajuda (opcional)" value={f.help ?? ""} onChange={e => upd(i,{help:e.target.value})} /></div>
                  {["select", "radio", "multiselect"].includes(f.type) && (
                    <Input className="md:col-span-5" placeholder="Opções separadas por vírgula" value={(f.options ?? []).join(", ")} onChange={(e) => upd(i, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
                  )}
                </div>
              ))}
            </div>
          </div>
          <Button type="button" variant="outline" onClick={() => setPreview(!preview)}><Eye />{preview ? "Fechar prévia" : "Visualizar prévia"}</Button>
          {preview && <fieldset disabled className="portal-form-state space-y-4 border-t border-border pt-4"><h3 className="font-bold">Prévia dos campos</h3><Label>Nome completo *</Label><Input /><Label>E-mail *</Label><Input type="email" />{fields.filter(f => f.label).map(f => <DynamicField key={f.key} field={f} preview />)}</fieldset>}
          <div className="flex justify-between">
            {form ? <Button type="button" variant="destructive" onClick={() => confirm("Excluir este formulário?") && del.mutate()}>Excluir</Button> : <span />}
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Salvando…" : "Salvar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
