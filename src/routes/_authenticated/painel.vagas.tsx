import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Eye, ExternalLink, Briefcase, MapPin, FileText, Send, Save, Search, Loader2 } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { fmtDate, errMsg } from "@/lib/format";
import { toLocalInput, fromLocalInput } from "@/lib/admin";
import { OPP_STATUS, type Opportunity } from "@/lib/opportunities";
import { StateMultiSelect } from "@/components/site/StateMultiSelect";
import { BRAZIL_STATES, opportunityStates, opportunityLocation, matchesOpportunityState } from "@/lib/brazil-states";

export const Route = createFileRoute("/_authenticated/painel/vagas")({
  head: () => ({ meta: [{ title: "Vagas administrativas — Portal Norte Junino" }, { name: "description", content: "Cadastre, publique e gerencie vagas." }, { property: "og:title", content: "Vagas administrativas — Portal Norte Junino" }, { property: "og:description", content: "Cadastre, publique e gerencie vagas." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: OpportunitiesAdmin,
});

interface DocRow { id: string; title: string; kind: string; active_version: number }
interface VersionRow { id: string; document_id: string; version: number; title: string; published: boolean }
interface LinkRow { id: string; document_id: string; version_id: string; required: boolean; image_choice: boolean; position: number }

function OpportunitiesAdmin() {
  const [editing, setEditing] = useState<Opportunity | "new" | null>(null);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
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
      <div className="mt-6 flex flex-wrap gap-3 border-y border-border py-4">
        <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label="Pesquisar vagas" placeholder="Pesquisar título, categoria ou projeto" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
        <select aria-label="Filtrar vagas por estado" className="h-10 rounded-md border border-input bg-card px-3 text-sm" value={stateFilter} onChange={e => setStateFilter(e.target.value)}><option value="">Todos os estados</option>{BRAZIL_STATES.map(s => <option key={s.code} value={s.code}>{s.code} — {s.name}</option>)}</select>
      </div>
      {list.isError && <p role="alert" className="mt-4 text-destructive">{errMsg(list.error)} <Button variant="outline" onClick={() => list.refetch()}>Tentar novamente</Button></p>}
      <div className="mt-6 grid gap-4">
        {list.isLoading ? <p className="text-muted-foreground">Carregando…</p> : !list.data?.length ? <p className="text-muted-foreground">Nenhuma vaga cadastrada.</p> :
          list.data.filter(o => matchesOpportunityState(o, stateFilter) && `${o.title} ${o.category} ${o.project}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map((o) => (
            <div key={o.id} className="portal-interactive-item flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card p-5 shadow-card">
              <Button variant="ghost" onClick={() => setEditing(o)} className="h-auto min-w-0 flex-1 flex-col items-start whitespace-normal text-left">
                <div className="font-bold">{o.title}</div>
                <div className="text-xs text-muted-foreground">{opportunityLocation(o)}</div>
                <div className="text-xs text-muted-foreground">{o.category || "Sem categoria"} · {fmtDate(o.opens_at)} — {fmtDate(o.closes_at)}</div>
              </Button>
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
  const [dirty, setDirty] = useState(false);
  const [states, setStates] = useState<string[]>(opportunityStates(opp ?? {}));
  const [inlineError, setInlineError] = useState("");
  const submitLock = useRef(false);
  const [status, setStatus] = useState<Opportunity["status"]>(opp?.status ?? "rascunho");
  const [modality, setModality] = useState(opp?.modality ?? "voluntaria");
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [linksLoaded, setLinksLoaded] = useState(false);

  const docs = useQuery({
    queryKey: ["admin", "legal-docs"],
    queryFn: async () => {
      const [d, v] = await Promise.all([
        supabase.from("legal_documents").select("id, title, kind, active_version").order("title"),
        supabase.from("legal_document_versions").select("id, document_id, version, title, published").order("version", { ascending: false }),
      ]);
      if (d.error) throw d.error;
      if (v.error) throw v.error;
      return { docs: (d.data ?? []) as DocRow[], versions: (v.data ?? []) as VersionRow[] };
    },
  });
  const existingLinks = useQuery({
    queryKey: ["admin", "opp-docs", opp?.id],
    enabled: !!opp,
    queryFn: async () => {
      if (!opp) return [];
      const { data, error } = await supabase.from("opportunity_documents").select("*").eq("opportunity_id", opp.id).order("position");
      if (error) throw error;
      return (data ?? []) as LinkRow[];
    },
  });
  useEffect(() => { if (opp && existingLinks.data) { setLinks(existingLinks.data); setLinksLoaded(true); } }, [opp, existingLinks.data]);

  const save = useMutation({
    mutationFn: async (fd: FormData) => {
      if (fd.has("upload_pending")) throw new Error("Aguarde o envio da imagem antes de salvar.");
      if (status === "publicada" && !links.length) throw new Error("É necessário vincular ao menos um termo ou documento à vaga para publicar.");
      if (status === "publicada" && links.some(l => !docs.data?.versions.find(v => v.id === l.version_id)?.published)) throw new Error("Para publicar, todos os termos vinculados precisam estar com a versão publicada.");
      const title = String(fd.get("title") ?? "").trim();
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
        states,
        city: String(fd.get("city") ?? ""),
        dedication: String(fd.get("dedication") ?? ""),
        benefits: String(fd.get("benefits") ?? ""),
        selection_criteria: String(fd.get("selection_criteria") ?? ""),
        opens_at: fromLocalInput(fd.get("opens_at")),
        closes_at: fromLocalInput(fd.get("closes_at")),
        status,
        image_url: String(fd.get("image_url") ?? "") || null,

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
      if (error) throw new Error(error.code === "P0001" ? error.message : errMsg(error));
      if (opp?.image_url && opp.image_url !== values.image_url) await cleanupImage(opp.image_url).catch(() => undefined);
    },
    onSuccess: () => { toast.success(status === "publicada" ? "Vaga publicada." : "Vaga salva."); qc.invalidateQueries({ queryKey: ["admin", "opportunities"] }); qc.invalidateQueries({ queryKey: ["opportunities"] }); if (opp) qc.invalidateQueries({ queryKey: ["opportunity", opp.id] }); onClose(); },
    onError: (e) => { setInlineError(errMsg(e)); toast.error(errMsg(e)); },
    onSettled: () => { submitLock.current = false; },
  });

  const del = useMutation({
    mutationFn: async () => {
      if (!opp) throw new Error("Vaga não encontrada.");
      const { error } = await supabase.from("opportunities").delete().eq("id", opp.id);
      if (error) throw new Error(error.code === "23503" ? "Esta vaga já tem candidaturas. Arquive em vez de excluir." : error.message);
    },
    onSuccess: () => { toast.success("Excluída."); qc.invalidateQueries({ queryKey: ["admin", "opportunities"] }); qc.invalidateQueries({ queryKey: ["opportunities"] }); onClose(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const allDocs = docs.data?.docs ?? [];
  const allVersions = docs.data?.versions ?? [];
  const linkedIds = new Set(links.map((l) => l.document_id));

  const busy = save.isPending || del.isPending;
  function close() { if (!busy && (!dirty || confirm("Descartar as alterações não salvas?"))) onClose(); }
  const blocked = busy || (!!opp && !linksLoaded) || docs.isLoading || docs.isError || existingLinks.isError;
  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent className="theme-light flex max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-4xl flex-col gap-0 overflow-hidden rounded-lg bg-card p-0" onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onPointerDownOutside={e => e.preventDefault()}>
        <DialogHeader className="shrink-0 border-b border-border px-5 py-5 text-left sm:px-7">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-primary"><Briefcase className="size-4" />Gestão de oportunidades</div>
          <DialogTitle className="text-2xl font-bold">{opp ? "Editar vaga" : "Nova vaga"}</DialogTitle>
          <DialogDescription>Dados da oportunidade · campos com * são obrigatórios</DialogDescription>
        </DialogHeader>
        <form onChange={() => setDirty(true)} onSubmit={(e) => { e.preventDefault(); if (submitLock.current || blocked) return; submitLock.current = true; setInlineError(""); save.mutate(new FormData(e.currentTarget)); }} className="flex min-h-0 flex-1 flex-col">
          <fieldset disabled={busy} className="min-h-0 min-w-0 w-full flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-6 sm:px-7">
          {existingLinks.isError && <p role="alert" className="text-sm text-destructive">Não foi possível carregar os termos desta vaga. <Button type="button" variant="outline" onClick={() => existingLinks.refetch()}>Tentar novamente</Button></p>}
          <h3 className="flex items-center gap-2 text-base font-bold"><Briefcase className="size-4 text-primary" />1. Identificação da oportunidade</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="opp-title">Título da vaga *</Label><Input id="opp-title" name="title" minLength={3} defaultValue={opp?.title} required maxLength={150} /></div>
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
          <h3 className="flex items-center gap-2 border-t border-border pt-5 text-base font-bold"><FileText className="size-4 text-primary" />2. Sobre a vaga</h3>
          <div className="space-y-1.5"><Label htmlFor="opp-description">Descrição completa{status === "publicada" ? " *" : " (opcional no rascunho)"}</Label><Textarea id="opp-description" name="description" required={status === "publicada"} defaultValue={opp?.description} rows={4} maxLength={5000} /></div>
          <div className="space-y-1.5"><Label>Atividades e responsabilidades</Label><Textarea name="activities" defaultValue={opp?.activities} rows={3} maxLength={5000} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Requisitos</Label><Textarea name="requirements" defaultValue={opp?.requirements} rows={3} maxLength={3000} /></div>
            <div className="space-y-1.5"><Label>Perfil desejado</Label><Textarea name="profile" defaultValue={opp?.profile} rows={3} maxLength={3000} /></div>
            <div className="space-y-1.5"><Label>Benefícios ou condições (sem anunciar remuneração inexistente)</Label><Textarea name="benefits" defaultValue={opp?.benefits} rows={3} maxLength={3000} /></div>
            <div className="space-y-1.5"><Label>Seleção e critérios de avaliação</Label><Textarea name="selection_criteria" defaultValue={opp?.selection_criteria} rows={3} maxLength={3000} /></div>
          </div>
          <h3 className="flex items-center gap-2 border-t border-border pt-5 text-base font-bold"><MapPin className="size-4 text-primary" />3. Estados de atuação e condições</h3>
          <div className="space-y-2"><Label htmlFor="opportunity-states">Estados de atuação (opcional)</Label><StateMultiSelect value={states} disabled={busy} onChange={v => { setStates(v); setDirty(true); }} /></div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5"><Label>Quantidade de vagas</Label><Input name="seats" type="number" min={1} defaultValue={opp?.seats ?? ""} /></div>
            <div className="space-y-1.5"><Label>Município</Label><Input name="city" defaultValue={opp?.city} maxLength={120} /></div>
            <div className="space-y-1.5"><Label>Dedicação esperada</Label><Input name="dedication" defaultValue={opp?.dedication} placeholder="Ex.: 8h semanais" maxLength={120} /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Abertura das candidaturas</Label><Input name="opens_at" type="datetime-local" defaultValue={toLocalInput(opp?.opens_at)} /></div>
            <div className="space-y-1.5"><Label>Encerramento</Label><Input name="closes_at" type="datetime-local" defaultValue={toLocalInput(opp?.closes_at)} /></div>
          </div>
          <ImageUpload initialValue={opp?.image_url} label="Imagem de capa (opcional)" />
          <h3 className="flex items-center gap-2 border-t border-border pt-5 text-base font-bold"><FileText className="size-4 text-primary" />4. Termos e documentos da vaga</h3>
          {docs.isError && <p role="alert" className="text-sm text-destructive">Não foi possível carregar os documentos. <Button type="button" variant="outline" onClick={() => docs.refetch()}>Tentar novamente</Button></p>}
          {docs.isLoading && <p className="text-sm text-muted-foreground">Carregando documentos…</p>}
          <p className="text-xs text-muted-foreground">Gerencie o conteúdo e as versões em <Link to="/painel/termos" className="font-semibold text-primary underline">Termos e documentos</Link>. Aqui você escolhe quais documentos se aplicam a esta vaga.</p>
          <div className="space-y-3">
            {links.map((l, i) => {
              const doc = allDocs.find((d) => d.id === l.document_id);
              const versions = allVersions.filter((v) => v.document_id === l.document_id);
              return (
                <div key={l.document_id} className="grid gap-3 rounded-lg border border-border p-3 md:grid-cols-[minmax(0,1fr)_120px_auto] md:items-center">
                  <div className="text-sm font-semibold">{doc?.title ?? "Documento"}</div>
                  <select className="h-9 rounded-md border border-input bg-card px-2 text-sm" value={l.version_id} onChange={(e) => { setDirty(true); setLinks((ls) => ls.map((x, j) => j === i ? { ...x, version_id: e.target.value } : x)); }}>
                    {versions.map((v) => <option key={v.id} value={v.id}>v{v.version}{v.published ? "" : " (rascunho)"}</option>)}
                  </select>
                  <label className="flex items-center gap-2 text-xs"><Switch checked={l.required} onCheckedChange={(v) => { setDirty(true); setLinks((ls) => ls.map((x, j) => j === i ? { ...x, required: v } : x)); }} /> Obrigatório</label>
                  <label className="flex items-center gap-2 text-xs"><Switch checked={l.image_choice} onCheckedChange={(v) => { setDirty(true); setLinks((ls) => ls.map((x, j) => j === i ? { ...x, image_choice: v } : x)); }} /> Escolha de imagem</label>
                  <Button type="button" variant="ghost" size="icon" aria-label="Remover documento" onClick={() => { setDirty(true); setLinks((ls) => ls.filter((_, j) => j !== i)); }}><Trash2 /></Button>
                </div>
              );
            })}
            <div className="flex flex-wrap gap-2">
              {allDocs.filter((d) => !linkedIds.has(d.id)).map((d) => {
                const v = allVersions.find((x) => x.document_id === d.id && x.version === d.active_version) ?? allVersions.find((x) => x.document_id === d.id);
                if (!v) return null;
                return (
                  <Button key={d.id} type="button" variant="outline" size="sm" onClick={() => { setDirty(true); setLinks((ls) => [...ls, { id: crypto.randomUUID(), document_id: d.id, version_id: v.id, required: true, image_choice: d.kind === "image", position: ls.length }]); }}>
                    <Plus /> {d.title}
                  </Button>
                );
              })}
            </div>
          </div>

          <h3 className="flex items-center gap-2 border-t border-border pt-5 text-base font-bold"><Send className="size-4 text-primary" />5. Publicação</h3>
          <div className="flex flex-wrap items-center gap-4">
            <select aria-label="Situação da vaga" className="h-10 rounded-md border border-input bg-card px-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value as Opportunity["status"])}>
              {Object.entries(OPP_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            {opp && status !== "rascunho" && (
              <Button asChild type="button" variant="outline" size="sm"><Link to="/vagas/$id" params={{ id: opp.id }} target="_blank"><Eye /> Prévia da página pública</Link></Button>
            )}
          </div>
          </fieldset>
          <div className="shrink-0 border-t border-border bg-card px-5 py-4 sm:px-7">
            {inlineError && <p role="alert" className="mb-3 text-sm text-destructive">{inlineError}</p>}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {opp ? <Button type="button" variant="ghost" disabled={busy} className="text-destructive" onClick={() => confirm("Excluir esta vaga? Esta ação não pode ser desfeita.") && del.mutate()}><Trash2 />Excluir</Button> : <span className="text-xs text-muted-foreground">{dirty ? "Alterações não salvas" : "Nova oportunidade"}</span>}
              <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={busy} onClick={close}>Cancelar</Button><Button type="submit" disabled={blocked}>{save.isPending ? <Loader2 className="animate-spin" /> : status === "publicada" ? <Send /> : <Save />}{save.isPending ? "Salvando…" : status === "publicada" ? "Publicar vaga" : status === "rascunho" ? "Salvar rascunho" : "Salvar alterações"}</Button></div>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
