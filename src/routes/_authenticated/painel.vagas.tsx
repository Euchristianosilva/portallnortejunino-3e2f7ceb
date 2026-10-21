import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Eye, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLiveQueries } from "@/lib/realtime";
import { LiveBadge } from "@/components/site/Layout";
import { ImageUpload } from "@/components/site/ImageUpload";
import { cleanupImage } from "@/lib/upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtDate, errMsg } from "@/lib/format";
import { toLocalInput, fromLocalInput } from "@/lib/admin";
import { OPP_STATUS, type Opportunity } from "@/lib/opportunities";

export const Route = createFileRoute("/_authenticated/painel/vagas")({
  head: () => ({ meta: [{ title: "Vagas administrativas — Portal Norte Junino" }, { name: "description", content: "Cadastre, publique e gerencie vagas." }, { property: "og:title", content: "Vagas administrativas — Portal Norte Junino" }, { property: "og:description", content: "Cadastre, publique e gerencie vagas." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: OpportunitiesAdmin,
});

interface DocRow { id: string; title: string; kind: string; active_version: number }
interface VersionRow { id: string; document_id: string; version: number; title: string; published: boolean }
interface LinkRow { id: string; document_id: string; version_id: string; required: boolean; image_choice: boolean; position: number }

function OpportunitiesAdmin() {
  const [editing, setEditing] = useState<Opportunity | "new" | null>(null);
  const list = useQuery({
    queryKey: ["admin", "opportunities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("opportunities").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data as Opportunity[];
    },
  });
  const st = useLiveQueries("admin-opportunities", [{ table: "opportunities", keys: [["admin", "opportunities"]] }]);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Vagas</h1>
        <div className="flex items-center gap-3"><LiveBadge status={st} /><Button onClick={() => setEditing("new")}><Plus /> Nova vaga</Button></div>
      </div>
      <div className="mt-6 grid gap-4">
        {list.isLoading ? <p className="text-muted-foreground">Carregando…</p> : !list.data?.length ? <p className="text-muted-foreground">Nenhuma vaga cadastrada.</p> :
          list.data.map((o) => (
            <div key={o.id} className="portal-interactive-item flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card p-5 shadow-card">
              <button onClick={() => setEditing(o)} className="min-w-0 flex-1 text-left">
                <div className="font-bold">{o.title}</div>
                <div className="text-xs text-muted-foreground">{o.category || "Sem categoria"} · {fmtDate(o.opens_at)} — {fmtDate(o.closes_at)}</div>
              </button>
              <div className="flex items-center gap-2">
                {o.status !== "rascunho" && o.status !== "arquivada" && (
                  <Button asChild variant="ghost" size="icon" aria-label="Ver página pública"><Link to="/vagas/$id" params={{ id: o.id }}><ExternalLink /></Link></Button>
                )}
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${o.status === "publicada" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{OPP_STATUS[o.status]}</span>
              </div>
            </div>
          ))}
      </div>
      {editing && <OppEditor opp={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function OppEditor({ opp, onClose }: { opp: Opportunity | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Opportunity["status"]>(opp?.status ?? "rascunho");
  const [modality, setModality] = useState(opp?.modality ?? "voluntaria");
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [linksLoaded, setLinksLoaded] = useState(false);

  const forms = useQuery({
    queryKey: ["admin", "forms-min"],
    queryFn: async () => (await supabase.from("registration_forms").select("id, title").order("created_at", { ascending: false })).data ?? [],
  });
  const docs = useQuery({
    queryKey: ["admin", "legal-docs"],
    queryFn: async () => {
      const [d, v] = await Promise.all([
        supabase.from("legal_documents").select("id, title, kind, active_version").order("title"),
        supabase.from("legal_document_versions").select("id, document_id, version, title, published").order("version", { ascending: false }),
      ]);
      return { docs: (d.data ?? []) as DocRow[], versions: (v.data ?? []) as VersionRow[] };
    },
  });
  const existingLinks = useQuery({
    queryKey: ["admin", "opp-docs", opp?.id],
    enabled: !!opp,
    queryFn: async () => {
      const { data } = await supabase.from("opportunity_documents").select("*").eq("opportunity_id", opp!.id).order("position");
      return (data ?? []) as LinkRow[];
    },
  });
  if (opp && existingLinks.data && !linksLoaded) { setLinks(existingLinks.data); setLinksLoaded(true); }

  const save = useMutation({
    mutationFn: async (fd: FormData) => {
      if (fd.has("upload_pending")) throw new Error("Aguarde o envio da imagem antes de salvar.");
      const title = String(fd.get("title")).trim();
      if (title.length < 3) throw new Error("Informe o título da vaga.");
      const values = {
        title,
        category: String(fd.get("category") ?? ""),
        modality,
        modality_label: String(fd.get("modality_label") ?? "") || (modality === "voluntaria" ? "Participação voluntária" : "Outra modalidade"),
        project: String(fd.get("project") ?? ""),
        description: String(fd.get("description") ?? ""),
        activities: String(fd.get("activities") ?? ""),
        requirements: String(fd.get("requirements") ?? ""),
        profile: String(fd.get("profile") ?? ""),
        seats: fd.get("seats") ? Number(fd.get("seats")) : null,
        state: String(fd.get("state") ?? ""),
        city: String(fd.get("city") ?? ""),
        dedication: String(fd.get("dedication") ?? ""),
        benefits: String(fd.get("benefits") ?? ""),
        selection_criteria: String(fd.get("selection_criteria") ?? ""),
        opens_at: fromLocalInput(fd.get("opens_at")),
        closes_at: fromLocalInput(fd.get("closes_at")),
        status,
        image_url: String(fd.get("image_url") ?? "") || null,
        form_id: String(fd.get("form_id") ?? "") || null,
      };
      // Uma única operação no servidor salva a vaga e os termos vinculados juntos
      // (tudo ou nada) e valida as condições de publicação.
      const keep = links.filter((l) => l.version_id).map((l) => ({ document_id: l.document_id, version_id: l.version_id, required: l.required, image_choice: l.image_choice }));
      const { error } = await supabase.rpc("save_opportunity", {
        _id: opp?.id ?? null as unknown as string,
        _expected_updated_at: opp?.updated_at ?? null as unknown as string,
        _values: { ...values, seats: values.seats === null ? "" : String(values.seats) },
        _links: keep,
      });
      if (error) throw error;
      if (opp?.image_url && opp.image_url !== values.image_url) await cleanupImage(opp.image_url);
    },
    onSuccess: () => { toast.success("Vaga salva."); qc.invalidateQueries({ queryKey: ["admin", "opportunities"] }); onClose(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const del = useMutation({
    mutationFn: async () => {
      if (!opp) throw new Error("Vaga não encontrada.");
      const { error } = await supabase.from("opportunities").delete().eq("id", opp.id);
      if (error) throw new Error(error.code === "23503" ? "Esta vaga já tem candidaturas. Arquive em vez de excluir." : error.message);
    },
    onSuccess: () => { toast.success("Excluída."); qc.invalidateQueries({ queryKey: ["admin", "opportunities"] }); onClose(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const allDocs = docs.data?.docs ?? [];
  const allVersions = docs.data?.versions ?? [];
  const linkedIds = new Set(links.map((l) => l.document_id));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="theme-light max-h-[90dvh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{opp ? "Editar vaga" : "Nova vaga"}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(new FormData(e.currentTarget)); }} className="space-y-4">
          <h3 className="font-bold">1. Informações da vaga</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Título da vaga *</Label><Input name="title" defaultValue={opp?.title} required maxLength={150} /></div>
            <div className="space-y-1.5"><Label>Categoria ou área</Label><Input name="category" defaultValue={opp?.category} maxLength={80} /></div>
            <div className="space-y-1.5"><Label>Modalidade jurídica</Label>
              <select className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm" value={modality} onChange={(e) => setModality(e.target.value)}>
                <option value="voluntaria">Participação voluntária</option>
                <option value="outra">Outra modalidade (validada juridicamente)</option>
              </select>
            </div>
            <div className="space-y-1.5"><Label>Rótulo da modalidade</Label><Input name="modality_label" defaultValue={opp?.modality_label} placeholder="Ex.: Participação voluntária" maxLength={120} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Projeto, departamento ou iniciativa</Label><Input name="project" defaultValue={opp?.project} maxLength={150} /></div>
          </div>
          <div className="space-y-1.5"><Label>Descrição completa</Label><Textarea name="description" defaultValue={opp?.description} rows={4} maxLength={5000} /></div>
          <div className="space-y-1.5"><Label>Atividades e responsabilidades</Label><Textarea name="activities" defaultValue={opp?.activities} rows={3} maxLength={5000} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Requisitos</Label><Textarea name="requirements" defaultValue={opp?.requirements} rows={3} maxLength={3000} /></div>
            <div className="space-y-1.5"><Label>Perfil desejado</Label><Textarea name="profile" defaultValue={opp?.profile} rows={3} maxLength={3000} /></div>
            <div className="space-y-1.5"><Label>Benefícios ou condições (sem anunciar remuneração inexistente)</Label><Textarea name="benefits" defaultValue={opp?.benefits} rows={3} maxLength={3000} /></div>
            <div className="space-y-1.5"><Label>Seleção e critérios de avaliação</Label><Textarea name="selection_criteria" defaultValue={opp?.selection_criteria} rows={3} maxLength={3000} /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-1.5"><Label>Quantidade de vagas</Label><Input name="seats" type="number" min={1} defaultValue={opp?.seats ?? ""} /></div>
            <div className="space-y-1.5"><Label>Estado</Label><Input name="state" defaultValue={opp?.state} maxLength={60} /></div>
            <div className="space-y-1.5"><Label>Município</Label><Input name="city" defaultValue={opp?.city} maxLength={120} /></div>
            <div className="space-y-1.5"><Label>Dedicação esperada</Label><Input name="dedication" defaultValue={opp?.dedication} placeholder="Ex.: 8h semanais" maxLength={120} /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Abertura das candidaturas</Label><Input name="opens_at" type="datetime-local" defaultValue={toLocalInput(opp?.opens_at)} /></div>
            <div className="space-y-1.5"><Label>Encerramento</Label><Input name="closes_at" type="datetime-local" defaultValue={toLocalInput(opp?.closes_at)} /></div>
          </div>
          <ImageUpload initialValue={opp?.image_url} label="Imagem de capa (opcional)" />
          <div className="space-y-1.5"><Label>Formulário de candidatura associado *</Label>
            <select name="form_id" required defaultValue={opp?.form_id ?? ""} className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm">
              <option value="">Selecione um formulário</option>
              {forms.data?.map((f) => <option key={f.id} value={f.id}>{f.title}</option>)}
            </select>
          </div>

          <h3 className="border-t border-border pt-4 font-bold">2. Termos e documentos da vaga</h3>
          <p className="text-xs text-muted-foreground">Gerencie o conteúdo e as versões em <Link to="/painel/termos" className="font-semibold text-primary underline">Termos e documentos</Link>. Aqui você escolhe quais documentos se aplicam a esta vaga.</p>
          <div className="space-y-3">
            {links.map((l, i) => {
              const doc = allDocs.find((d) => d.id === l.document_id);
              const versions = allVersions.filter((v) => v.document_id === l.document_id);
              return (
                <div key={l.document_id} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_140px_auto_auto_auto] sm:items-center">
                  <div className="text-sm font-semibold">{doc?.title ?? "Documento"}</div>
                  <select className="h-9 rounded-md border border-input bg-card px-2 text-sm" value={l.version_id} onChange={(e) => setLinks((ls) => ls.map((x, j) => j === i ? { ...x, version_id: e.target.value } : x))}>
                    {versions.map((v) => <option key={v.id} value={v.id}>v{v.version}{v.published ? "" : " (rascunho)"}</option>)}
                  </select>
                  <label className="flex items-center gap-2 text-xs"><Switch checked={l.required} onCheckedChange={(v) => setLinks((ls) => ls.map((x, j) => j === i ? { ...x, required: v } : x))} /> Obrigatório</label>
                  <label className="flex items-center gap-2 text-xs"><Switch checked={l.image_choice} onCheckedChange={(v) => setLinks((ls) => ls.map((x, j) => j === i ? { ...x, image_choice: v } : x))} /> Escolha de imagem</label>
                  <Button type="button" variant="ghost" size="icon" aria-label="Remover documento" onClick={() => setLinks((ls) => ls.filter((_, j) => j !== i))}><Trash2 /></Button>
                </div>
              );
            })}
            <div className="flex flex-wrap gap-2">
              {allDocs.filter((d) => !linkedIds.has(d.id)).map((d) => {
                const v = allVersions.find((x) => x.document_id === d.id && x.version === d.active_version) ?? allVersions.find((x) => x.document_id === d.id);
                if (!v) return null;
                return (
                  <Button key={d.id} type="button" variant="outline" size="sm" onClick={() => setLinks((ls) => [...ls, { id: crypto.randomUUID(), document_id: d.id, version_id: v.id, required: true, image_choice: d.kind === "image", position: ls.length }])}>
                    <Plus /> {d.title}
                  </Button>
                );
              })}
            </div>
          </div>

          <h3 className="border-t border-border pt-4 font-bold">3. Publicação</h3>
          <div className="flex flex-wrap items-center gap-4">
            <select className="h-9 rounded-md border border-input bg-card px-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value as Opportunity["status"])}>
              {Object.entries(OPP_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            {opp && status !== "rascunho" && (
              <Button asChild type="button" variant="outline" size="sm"><Link to="/vagas/$id" params={{ id: opp.id }} target="_blank"><Eye /> Prévia da página pública</Link></Button>
            )}
          </div>
          <div className="flex justify-between border-t border-border pt-4">
            {opp ? <Button type="button" variant="destructive" onClick={() => confirm("Excluir esta vaga?") && del.mutate()}>Excluir</Button> : <span />}
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Salvando…" : status === "publicada" ? "Publicar vaga" : "Salvar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
