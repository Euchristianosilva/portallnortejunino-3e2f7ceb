import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, AlertTriangle, Eye, UploadCloud } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLiveQueries } from "@/lib/realtime";
import { LiveBadge } from "@/components/site/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtDate, errMsg } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/painel/termos")({
  head: () => ({ meta: [{ title: "Termos e documentos — Portal Norte Junino" }, { name: "description", content: "Gerencie documentos legais e suas versões." }, { property: "og:title", content: "Termos e documentos — Portal Norte Junino" }, { property: "og:description", content: "Gerencie documentos legais e suas versões." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: TermsAdmin,
});

interface Doc { id: string; slug: string; title: string; kind: string; active_version: number; legal_blockers: string[] }
interface Version { id: string; document_id: string; version: number; title: string; body: string; published: boolean; published_at: string | null }

const KINDS: Record<string, string> = { terms: "Participação", image: "Imagem/voz", privacy: "Privacidade", truth: "Veracidade", other: "Outro" };

function TermsAdmin() {
  const [editing, setEditing] = useState<Doc | null>(null);
  const list = useQuery({
    queryKey: ["admin", "legal-docs-full"],
    queryFn: async () => {
      const { data, error } = await supabase.from("legal_documents").select("*").order("title");
      if (error) throw error;
      return (data ?? []) as Doc[];
    },
  });
  const st = useLiveQueries("admin-legal-docs", [{ table: "legal_documents", keys: [["admin", "legal-docs-full"]] }]);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Termos e documentos</h1>
        <LiveBadge status={st} />
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Documentos com pendências jurídicas não podem ser publicados. Editar um documento publicado cria uma nova versão — os aceites anteriores permanecem preservados.
      </p>
      <div className="mt-6 grid gap-4">
        {list.isLoading ? <p className="text-muted-foreground">Carregando…</p> : list.data?.map((d) => (
          <button key={d.id} onClick={() => setEditing(d)} className="portal-interactive-item flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card p-5 text-left shadow-card hover:ring-2 hover:ring-primary/40">
            <div>
              <div className="font-bold">{d.title}</div>
              <div className="text-xs text-muted-foreground">{KINDS[d.kind] ?? d.kind} · {d.active_version > 0 ? `Versão ativa: v${d.active_version}` : "Nenhuma versão publicada"}</div>
            </div>
            {d.legal_blockers.length > 0 ? (
              <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive"><AlertTriangle className="size-3.5" /> {d.legal_blockers.length} pendência(s) jurídica(s)</span>
            ) : (
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">Apto a publicar</span>
            )}
          </button>
        ))}
      </div>
      {editing && <DocEditor doc={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function DocEditor({ doc, onClose }: { doc: Doc; onClose: () => void }) {
  const qc = useQueryClient();
  const [blockers, setBlockers] = useState<string[]>(doc.legal_blockers);
  const [newBlocker, setNewBlocker] = useState("");
  const [viewing, setViewing] = useState<Version | null>(null);
  const [draft, setDraft] = useState<{ version: number; title: string; body: string } | null>(null);

  const versions = useQuery({
    queryKey: ["admin", "legal-versions", doc.id],
    queryFn: async () => {
      const { data } = await supabase.from("legal_document_versions").select("*").eq("document_id", doc.id).order("version", { ascending: false });
      return (data ?? []) as Version[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "legal-docs-full"] });
    qc.invalidateQueries({ queryKey: ["admin", "legal-versions", doc.id] });
    qc.invalidateQueries({ queryKey: ["admin", "legal-docs"] });
  };

  const saveMeta = useMutation({
    mutationFn: async (fd: FormData) => {
      const { error } = await supabase.from("legal_documents").update({
        title: String(fd.get("title")).trim(),
        kind: String(fd.get("kind")),
        legal_blockers: blockers,
        updated_at: new Date().toISOString(),
      }).eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Documento atualizado."); invalidate(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const saveDraft = useMutation({
    mutationFn: async () => {
      if (!draft) return;
      const existing = versions.data?.find((v) => v.version === draft.version && !v.published);
      if (existing) {
        const { error } = await supabase.from("legal_document_versions").update({ title: draft.title, body: draft.body }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("legal_document_versions").insert({ document_id: doc.id, version: draft.version, title: draft.title, body: draft.body });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Versão salva como rascunho."); setDraft(null); invalidate(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const publish = useMutation({
    mutationFn: async (version: number) => {
      const { error } = await supabase.rpc("publish_legal_version", { _document_id: doc.id, _version: version });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Versão publicada."); invalidate(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const delVersion = useMutation({
    mutationFn: async (v: Version) => {
      if (v.published) throw new Error("Versões publicadas são preservadas e não podem ser excluídas.");
      const { error } = await supabase.from("legal_document_versions").delete().eq("id", v.id);
      if (error) throw new Error(error.code === "23503" ? "Esta versão já está vinculada a uma vaga." : error.message);
    },
    onSuccess: () => { toast.success("Rascunho excluído."); invalidate(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const nextVersion = (versions.data?.[0]?.version ?? 0) + 1;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="theme-light max-h-[90dvh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{doc.title}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); saveMeta.mutate(new FormData(e.currentTarget)); }} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Título</Label><Input name="title" defaultValue={doc.title} required maxLength={200} /></div>
            <div className="space-y-1.5"><Label>Tipo</Label>
              <select name="kind" defaultValue={doc.kind} className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm">
                {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Pendências jurídicas (enquanto houver, a publicação fica bloqueada)</Label>
            <ul className="space-y-1">
              {blockers.map((b, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm">
                  <span>{b}</span>
                  <Button type="button" variant="ghost" size="icon" aria-label="Resolver pendência" onClick={() => setBlockers((bs) => bs.filter((_, j) => j !== i))}><Trash2 /></Button>
                </li>
              ))}
              {blockers.length === 0 && <li className="text-sm text-muted-foreground">Nenhuma pendência — o documento pode ser publicado.</li>}
            </ul>
            <div className="flex gap-2">
              <Input placeholder="Nova pendência" value={newBlocker} onChange={(e) => setNewBlocker(e.target.value)} maxLength={300} />
              <Button type="button" variant="outline" onClick={() => { if (newBlocker.trim()) { setBlockers((bs) => [...bs, newBlocker.trim()]); setNewBlocker(""); } }}><Plus /> Adicionar</Button>
            </div>
          </div>
          <Button type="submit" disabled={saveMeta.isPending}>Salvar informações</Button>
        </form>

        <div className="mt-6 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">Versões</h3>
            <Button size="sm" variant="outline" onClick={() => setDraft({ version: nextVersion, title: doc.title, body: "" })}><Plus /> Nova versão (v{nextVersion})</Button>
          </div>
          <ul className="mt-3 space-y-2">
            {versions.data?.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                <span className="font-semibold">v{v.version} · {v.title}</span>
                <span className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${v.published ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {v.published ? `Publicada em ${fmtDate(v.published_at)}` : "Rascunho"}
                  </span>
                  {doc.active_version === v.version && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">Ativa</span>}
                  <Button type="button" variant="ghost" size="icon" aria-label="Visualizar texto" onClick={() => setViewing(v)}><Eye /></Button>
                  {!v.published && <Button type="button" variant="ghost" size="icon" aria-label="Editar rascunho" onClick={() => setDraft({ version: v.version, title: v.title, body: v.body })}><Plus className="rotate-45" /></Button>}
                  {!v.published && <Button type="button" variant="ghost" size="icon" aria-label="Excluir rascunho" onClick={() => confirm("Excluir este rascunho?") && delVersion.mutate(v)}><Trash2 /></Button>}
                  {!v.published && <Button type="button" size="sm" onClick={() => publish.mutate(v.version)} disabled={publish.isPending}><UploadCloud /> Publicar</Button>}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {viewing && (
          <div className="mt-4 rounded-lg bg-muted p-4">
            <div className="mb-2 flex items-center justify-between"><h4 className="font-bold">{viewing.title} — v{viewing.version}</h4><Button type="button" variant="ghost" size="sm" onClick={() => setViewing(null)}>Fechar</Button></div>
            <div className="max-h-72 overflow-y-auto whitespace-pre-wrap text-sm leading-6">{viewing.body}</div>
          </div>
        )}

        {draft && (
          <div className="mt-4 space-y-3 rounded-lg border border-border p-4">
            <h4 className="font-bold">{versions.data?.some((v) => v.version === draft.version) ? `Editar rascunho v${draft.version}` : `Nova versão v${draft.version}`}</h4>
            <div className="space-y-1.5"><Label>Título da versão</Label><Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={200} /></div>
            <div className="space-y-1.5"><Label>Texto integral</Label><Textarea rows={10} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} /></div>
            <div className="flex gap-2">
              <Button onClick={() => saveDraft.mutate()} disabled={saveDraft.isPending || !draft.body.trim()}>Salvar rascunho</Button>
              <Button variant="ghost" onClick={() => setDraft(null)}>Cancelar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
