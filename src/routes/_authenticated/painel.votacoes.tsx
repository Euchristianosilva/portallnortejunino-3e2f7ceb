import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, GripVertical, ChevronUp, ChevronDown, Info, Vote, UserRound, Save, Send, Power, Trophy, Search, AlertCircle, CalendarDays, BarChart3, Eye, CircleStop, Settings2, Infinity as InfinityIcon, Lock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLiveQueries } from "@/lib/realtime";
import { useAuth } from "@/lib/auth";
import { LiveBadge } from "@/components/site/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageUpload } from "@/components/site/ImageUpload";
import { cleanupImage } from "@/lib/upload";
import { StoredImage } from "@/components/site/StoredImage";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { POLL_STATUS, POLL_TRANSITIONS, VISIBILITY, effectivePollStatus, fmtDate, errMsg, percent, UFS, type PollStatus } from "@/lib/format";
import { guardedUpdate, toLocalInput, fromLocalInput } from "@/lib/admin";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/painel/votacoes")({ head: () => ({ meta: [{ title: "Votações administrativas — Portal Norte Junino" }, { name: "description", content: "Gerencie votações e candidatos do portal." }, { property: "og:title", content: "Votações administrativas — Portal Norte Junino" }, { property: "og:description", content: "Gerencie votações e candidatos do portal." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), component: PollsAdmin });
type Poll = Tables<"polls">;

type PollRow = Poll & { poll_options: { count: number }[]; poll_tallies: { votes: number }[] };
const STATUS_TONE: Record<PollStatus, string> = {
  rascunho: "bg-muted text-muted-foreground",
  agendada: "bg-accent text-accent-foreground",
  ativa: "bg-success/15 text-success",
  encerrada: "bg-secondary text-secondary-foreground",
  cancelada: "bg-destructive/10 text-destructive",
};

function PollsAdmin() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<PollStatus | "todas">("todas");
  const list = useQuery({
    queryKey: ["admin", "polls"],
    queryFn: async () => {
      const { data, error } = await supabase.from("polls").select("*, poll_options(count), poll_tallies(votes)").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data as unknown as PollRow[];
    },
  });
  const st = useLiveQueries("admin-polls", [
    { table: "polls", keys: [["admin", "polls"], ["admin", "poll"]] },
    { table: "poll_tallies", keys: [["admin", "poll"], ["admin", "polls"]] },
    { table: "poll_options", keys: [["admin", "poll"], ["admin", "polls"]] },
  ]);
  const act = useMutation({
    mutationFn: async ({ p, kind }: { p: PollRow; kind: "encerrar" | "excluir" }) => {
      if (kind === "encerrar") return guardedUpdate("polls", p.id, p.updated_at, { status: "encerrada" });
      const { error } = await supabase.from("polls").delete().eq("id", p.id);
      if (error) throw error;
      await cleanupImage(p.image_url);
    },
    onSuccess: (_d, v) => { toast.success(v.kind === "encerrar" ? "Votação encerrada." : "Votação excluída."); qc.invalidateQueries({ queryKey: ["admin", "polls"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const rows = (list.data ?? []).filter((p) => {
    const q = search.trim().toLowerCase();
    if (q && ![p.title, p.category, p.project].some((v) => (v ?? "").toLowerCase().includes(q))) return false;
    return filter === "todas" || effectivePollStatus(p) === filter;
  });
  return (
    <div>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Gerenciar votações</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">Crie, edite e acompanhe as votações do portal, seus candidatos e resultados.</p>
        </div>
        <div className="flex items-center gap-3"><LiveBadge status={st} /><Button size="lg" onClick={() => setEditing("new")}><Plus /> Nova votação</Button></div>
      </header>

      <div className="mt-6 flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, projeto ou categoria" className="pl-9" aria-label="Buscar votações" />
        </label>
        <div className="flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Filtrar por situação">
          {(["todas", ...Object.keys(POLL_STATUS)] as (PollStatus | "todas")[]).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${filter === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
              {k === "todas" ? "Todas" : POLL_STATUS[k]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        {list.isLoading ? (
          [0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)
        ) : list.isError ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
            <AlertCircle className="size-8 text-destructive" />
            <p className="text-sm">Não foi possível carregar as votações. {errMsg(list.error)}</p>
            <Button variant="outline" size="sm" onClick={() => list.refetch()}>Tentar novamente</Button>
          </div>
        ) : !rows.length ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-10 text-center">
            <Vote className="size-8 text-muted-foreground" />
            <p className="font-semibold">{list.data?.length ? "Nenhuma votação encontrada" : "Nenhuma votação criada ainda"}</p>
            <p className="text-sm text-muted-foreground">{list.data?.length ? "Ajuste a busca ou o filtro." : "Comece criando a primeira votação do portal."}</p>
            {!list.data?.length && <Button onClick={() => setEditing("new")}><Plus /> Nova votação</Button>}
          </div>
        ) : rows.map((p) => {
          const eff = effectivePollStatus(p);
          const candidates = p.poll_options?.[0]?.count ?? 0;
          const votes = (p.poll_tallies ?? []).reduce((a, t) => a + t.votes, 0);
          return (
            <article key={p.id} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-card sm:flex-row sm:items-center sm:p-5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE[eff]}`}>{POLL_STATUS[eff]}</span>
                  <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">{p.single_vote ? "Voto único" : "Votos ilimitados"}</span>
                </div>
                <h2 className="mt-2 truncate text-lg font-bold">{p.title}</h2>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{[p.project, p.category].filter(Boolean).join(" · ") || "Sem categoria"}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><CalendarDays className="size-3.5" />{fmtDate(p.starts_at)} — {fmtDate(p.ends_at)}</span>
                  <span className="flex items-center gap-1"><UserRound className="size-3.5" />{candidates} candidato(s)</span>
                  <span className="flex items-center gap-1"><BarChart3 className="size-3.5" />{votes} voto(s)</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <Button size="sm" onClick={() => setEditing(p.id)}><Pencil /> Editar</Button>
                {p.status !== "rascunho" && <Button size="sm" variant="outline" asChild><Link to="/votacoes/$id" params={{ id: p.id }} target="_blank"><Eye /> Visualizar</Link></Button>}
                {p.status === "ativa" && <Button size="sm" variant="outline" disabled={act.isPending} onClick={() => confirm(`Encerrar "${p.title}"? Novos votos serão bloqueados.`) && act.mutate({ p, kind: "encerrar" })}><CircleStop /> Encerrar</Button>}
                {p.status === "rascunho" && votes === 0 && <Button size="sm" variant="ghost" className="text-destructive" disabled={act.isPending} onClick={() => confirm(`Excluir "${p.title}"? Esta ação não pode ser desfeita.`) && act.mutate({ p, kind: "excluir" })}><Trash2 /> Excluir</Button>}
              </div>
            </article>
          );
        })}
      </div>
      {editing && <PollEditor id={editing === "new" ? null : editing} onClose={() => setEditing(null)} onCreated={(id) => setEditing(id)} />}
    </div>
  );
}

const selectCls = "h-9 w-full rounded-md border border-input bg-card px-2 text-sm";

function PollEditor({ id, onClose, onCreated }: { id: string | null; onClose: () => void; onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const data = useQuery({
    queryKey: ["admin", "poll", id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) throw new Error("Votação não encontrada.");
      const [p, o, t, v] = await Promise.all([
        supabase.from("polls").select("*").eq("id", id).single(),
        supabase.from("poll_options").select("*").eq("poll_id", id).order("position"),
        supabase.from("poll_tallies").select("*").eq("poll_id", id),
        supabase.from("poll_voters").select("email").eq("poll_id", id),
      ]);
      if (p.error) throw p.error;
      return { p: p.data as Poll, o: o.data ?? [], t: t.data ?? [], v: v.data ?? [] };
    },
  });
  const p = data.data?.p;
  const [singleOverride, setSingleOverride] = useState<boolean | null>(null);
  const singleVote = singleOverride ?? p?.single_vote ?? true;
  const [dirty, setDirty] = useState(false);
  const isDirty = dirty || (singleOverride !== null && singleOverride !== (p?.single_vote ?? true));
  const close = () => { if (!isDirty || confirm("Há alterações não salvas. Deseja sair mesmo assim?")) onClose(); };
  const [editingOption, setEditingOption] = useState<string | null>(null);
  const [addingCandidate, setAddingCandidate] = useState(false);
  const infoFormRef = useRef<HTMLFormElement | null>(null);
  const inval = () => { qc.invalidateQueries({ queryKey: ["admin", "poll", id] }); qc.invalidateQueries({ queryKey: ["admin", "polls"] }); };

  const save = useMutation({
    mutationFn: async ({ fd, publish }: { fd: FormData; publish: boolean }) => {
      if (fd.has("upload_pending")) throw new Error("Aguarde o envio da imagem antes de salvar.");
      const title = String(fd.get("title")).trim();
      if (title.length < 3) throw new Error("Informe um título.");
      const starts = fromLocalInput(fd.get("starts_at")), ends = fromLocalInput(fd.get("ends_at"));
      if (starts && ends && new Date(ends) <= new Date(starts)) throw new Error("O encerramento deve ser após o início.");
      if (publish && !starts) throw new Error("Informe a data de início para publicar.");
      const values = {
        title,
        project: String(fd.get("project") ?? "").trim(),
        description: String(fd.get("description") ?? ""),
        category: String(fd.get("category") ?? ""),
        image_url: String(fd.get("image_url") ?? "") || null,
        rules: String(fd.get("rules") ?? ""),
        starts_at: starts,
        ends_at: ends,
        audience: fd.get("audience") as "publica" | "restrita",
        results_visibility: fd.get("results_visibility") as "oculto" | "ao_vivo" | "apos_encerramento",
        single_vote: singleVote,
      };
      let pollId = p?.id ?? null;
      if (p) {
        await guardedUpdate("polls", p.id, p.updated_at, values);
        if (p.image_url !== values.image_url) await cleanupImage(p.image_url);
      } else {
        const { data: ins, error } = await supabase.from("polls").insert({ ...values, created_by: user?.id ?? null }).select("id").single();
        if (error) throw error;
        pollId = ins.id;
      }
      if (publish) {
        const activeCount = (data.data?.o ?? []).filter((o) => o.active).length;
        if (activeCount < 2) throw new Error("A votação precisa de pelo menos 2 candidatos ativos para ser publicada.");
        const { data: cur } = await supabase.from("polls").select("status, updated_at").eq("id", pollId!).single();
        if (cur && (cur.status === "rascunho" || cur.status === "agendada")) {
          const to: PollStatus = starts && new Date(starts) > new Date() ? "agendada" : "ativa";
          await guardedUpdate("polls", pollId!, cur.updated_at, { status: to });
        }
      }
      return pollId;
    },
    onSuccess: (newId, vars) => { toast.success(vars.publish ? "Votação publicada." : "Alterações salvas."); setDirty(false); setSingleOverride(null); inval(); if (newId && !id) onCreated(newId); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const transition = useMutation({
    mutationFn: async (to: PollStatus) => {
      if (to === "ativa" && (data.data?.o ?? []).filter((o) => o.active).length < 2) throw new Error("A votação precisa de pelo menos 2 candidatos ativos.");
      if (!p) throw new Error("Votação não encontrada.");
      await guardedUpdate("polls", p.id, p.updated_at, { status: to });
    },
    onSuccess: () => { toast.success("Status alterado."); inval(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const optionPayload = (fd: FormData) => {
    if (fd.has("upload_pending")) throw new Error("Aguarde o envio da imagem antes de salvar.");
    const name = String(fd.get("name")).trim();
    if (!name) throw new Error("Informe o nome do candidato.");
    const socials = String(fd.get("social_links") ?? "")
      .split(/[\n,;]+/).map((s) => s.trim()).filter((s) => /^https?:\/\//i.test(s)).slice(0, 10);
    return {
      name,
      artistic_name: String(fd.get("artistic_name") ?? "").trim(),
      code: String(fd.get("code") ?? "").trim(),
      group_name: String(fd.get("group_name") ?? "").trim(),
      state: String(fd.get("state") ?? "").trim(),
      city: String(fd.get("city") ?? "").trim(),
      description: String(fd.get("description") ?? ""),
      social_links: socials,
      image_url: String(fd.get("image_url") ?? "") || null,
    };
  };

  const toggleActive = useMutation({
    mutationFn: async ({ oid, active }: { oid: string; active: boolean }) => {
      const { error } = await supabase.from("poll_options").update({ active }).eq("id", oid);
      if (error) throw error;
    },
    onSuccess: (_d, v) => { inval(); toast.success(v.active ? "Candidato ativado." : "Candidato desativado."); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const addOption = useMutation({
    mutationFn: async (fd: FormData) => {
      if (!id) throw new Error("Salve a votação antes de adicionar candidatos.");
      const { error } = await supabase.from("poll_options").insert({ poll_id: id, ...optionPayload(fd), position: data.data?.o.length ?? 0 });
      if (error) throw error;
    },
    onSuccess: () => { setAddingCandidate(false); inval(); toast.success("Candidato adicionado."); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const delOption = useMutation({
    mutationFn: async (oid: string) => {
      const withVotes = data.data?.t.some((t) => t.option_id === oid && t.votes > 0);
      if (withVotes) throw new Error("Este candidato já recebeu votos e não pode ser removido.");
      const oldImage = data.data?.o.find((o) => o.id === oid)?.image_url;
      const { error } = await supabase.from("poll_options").delete().eq("id", oid);
      if (error) throw error;
      await cleanupImage(oldImage);
    },
    onSuccess: inval, onError: (e) => toast.error(errMsg(e)),
  });
  const updateOption = useMutation({
    mutationFn: async (fd: FormData) => {
      if (!editingOption) throw new Error("Candidato não encontrado.");
      const oldImage = data.data?.o.find((o) => o.id === editingOption)?.image_url;
      const payload = optionPayload(fd);
      const r = await supabase.from("poll_options").update(payload).eq("id", editingOption);
      if (r.error) throw r.error;
      if (oldImage !== payload.image_url) await cleanupImage(oldImage);
    },
    onSuccess: () => { setEditingOption(null); inval(); toast.success("Candidato atualizado."); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const moveOption = useMutation({
    mutationFn: async ({ oid, dir }: { oid: string; dir: -1 | 1 }) => {
      const list = data.data?.o ?? [];
      const i = list.findIndex((o) => o.id === oid);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return;
      const a = list[i], b = list[j];
      if (!a || !b) return;
      const r1 = await supabase.from("poll_options").update({ position: b.position }).eq("id", a.id);
      if (r1.error) throw r1.error;
      const r2 = await supabase.from("poll_options").update({ position: a.position }).eq("id", b.id);
      if (r2.error) throw r2.error;
    },
    onSuccess: inval,
    onError: (e) => toast.error(errMsg(e)),
  });
  const voters = useMutation({
    mutationFn: async (txt: string) => {
      if (!id) throw new Error("Votação não encontrada.");
      const emails = [...new Set(txt.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)))];
      const removed = await supabase.from("poll_voters").delete().eq("poll_id", id); if (removed.error) throw removed.error;
      if (emails.length) { const { error } = await supabase.from("poll_voters").insert(emails.map((email) => ({ poll_id: id, email }))); if (error) throw error; }
      return emails.length;
    },
    onSuccess: (n) => { toast.success(`${n} participante(s) habilitado(s).`); inval(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const tallies = new Map(data.data?.t.map((t) => [t.option_id, t.votes]));
  const total = [...tallies.values()].reduce((a, b) => a + b, 0);
  const locked = p && (p.status === "encerrada" || p.status === "cancelada");

  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent className="theme-light max-h-[90dvh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{p ? "Editar votação" : "Nova votação"}</DialogTitle>
          <p className="text-sm text-muted-foreground">Configure as informações, os candidatos e o modo de votação.</p>
        </DialogHeader>
        {id && !p ? <p>Carregando…</p> : (
          <div className="space-y-6">
            {p && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted p-3 text-sm">
                Status: <strong>{POLL_STATUS[p.status]}</strong>
                {POLL_TRANSITIONS[p.status].map((to) => (
                  <Button key={to} size="sm" variant={to === "cancelada" ? "destructive" : "outline"} disabled={transition.isPending} onClick={() => confirm(`Alterar para "${POLL_STATUS[to]}"?`) && transition.mutate(to)}>
                    → {POLL_STATUS[to]}
                  </Button>
                ))}
              </div>
            )}

            {/* 1. Informações da votação */}
            <form ref={infoFormRef} key={p?.updated_at ?? "new"} onChange={() => setDirty(true)} onSubmit={(e) => e.preventDefault()} className="rounded-xl border border-border bg-card p-5 shadow-card">
              <h2 className="flex items-center gap-2 text-lg font-extrabold"><Vote className="size-5 text-primary" /> Informações da votação</h2>
              <fieldset disabled={!!locked} className="mt-5 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label>Projeto</Label><Input name="project" defaultValue={p?.project} placeholder="Ex.: Estrela de São João" maxLength={120} /></div>
                  <div className="space-y-1.5"><Label>Título da votação *</Label><Input name="title" defaultValue={p?.title} required maxLength={150} /></div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label>Categoria</Label><Input name="category" defaultValue={p?.category} placeholder="Ex.: Brincante de Ouro" maxLength={80} /></div>
                  <div className="space-y-1.5"><Label>Configuração de resultados</Label>
                    <select name="results_visibility" defaultValue={p?.results_visibility ?? "apos_encerramento"} className={selectCls}>
                      {Object.entries(VISIBILITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5"><Label>Descrição</Label><Textarea name="description" defaultValue={p?.description} rows={3} maxLength={5000} /></div>
                <div className="space-y-1.5"><Label>Regras de participação</Label><Textarea name="rules" defaultValue={p?.rules} rows={2} maxLength={5000} /></div>
                <ImageUpload initialValue={p?.image_url} label="Imagem de capa (opcional)" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label>Data de início</Label><Input name="starts_at" type="datetime-local" defaultValue={toLocalInput(p?.starts_at)} /></div>
                  <div className="space-y-1.5"><Label>Data de encerramento</Label><Input name="ends_at" type="datetime-local" defaultValue={toLocalInput(p?.ends_at)} /></div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label>Público</Label>
                    <select name="audience" defaultValue={p?.audience ?? "publica"} className={selectCls}><option value="publica">Pública (contas cadastradas)</option><option value="restrita">Restrita (lista de e-mails)</option></select>
                  </div>
                </div>
              </fieldset>
            </form>

            {/* Configuração de votos */}
            <section className="rounded-xl border border-border bg-card p-5 shadow-card">
              <h2 className="flex items-center gap-2 text-lg font-extrabold"><Settings2 className="size-5 text-primary" /> Configuração de votos</h2>
              <div className="mt-4 flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/40 p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{singleVote ? <Lock className="size-4" /> : <InfinityIcon className="size-4" />}</span>
                  <div>
                    <Label htmlFor="single-vote" className="text-base font-bold">Permitir votos ilimitados</Label>
                    <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
                      {singleVote
                        ? "Voto único: cada participante poderá registrar apenas um voto nesta votação."
                        : "Votos ilimitados: cada participante poderá votar quantas vezes quiser, inclusive no mesmo candidato."}
                    </p>
                  </div>
                </div>
                <Switch id="single-vote" checked={singleVote} disabled={!!locked} onCheckedChange={setSingleOverride} />
              </div>
              {p && singleOverride !== null && singleOverride !== p.single_vote && <p className="mt-2 text-xs text-muted-foreground">A nova regra vale para os votos registrados após salvar. Votos já registrados são mantidos.</p>}
            </section>

            {/* 2. Candidatos da votação */}
            {p && (
              <section className="rounded-xl border border-border bg-card p-5 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-lg font-extrabold"><UserRound className="size-5 text-primary" /> Candidatos ({data.data?.o.length ?? 0})</h2>
                  {!locked && (
                    <Button size="sm" onClick={() => { setAddingCandidate((v) => !v); setEditingOption(null); }}>
                      <Plus /> Adicionar candidato
                    </Button>
                  )}
                </div>
                <p className="mt-3 flex items-start gap-2 rounded-lg bg-accent/60 p-3 text-sm text-accent-foreground">
                  <Info className="mt-0.5 size-4 shrink-0" /> Adicione quantos candidatos forem necessários. Não há limite de participantes.
                </p>

                {addingCandidate && !locked && (
                  <form onSubmit={(e) => { e.preventDefault(); addOption.mutate(new FormData(e.currentTarget)); }} className="mt-4 space-y-3 rounded-lg border border-border bg-muted/50 p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5"><Label>Nome completo do candidato *</Label><Input name="name" required maxLength={150} /></div>
                      <div className="space-y-1.5"><Label>Nome artístico / de apresentação</Label><Input name="artistic_name" maxLength={150} /></div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5"><Label>Número ou código de identificação</Label><Input name="code" maxLength={30} /></div>
                      <div className="space-y-1.5"><Label>Quadrilha junina ou grupo</Label><Input name="group_name" maxLength={150} /></div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5"><Label>Estado de representação</Label>
                        <select name="state" defaultValue="" className={selectCls}><option value="">Selecione…</option>{UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}</select>
                      </div>
                      <div className="space-y-1.5"><Label>Cidade ou município</Label><Input name="city" maxLength={120} /></div>
                    </div>
                    <div className="space-y-1.5"><Label>Biografia ou apresentação</Label><Textarea name="description" rows={3} maxLength={1000} /></div>
                    <div className="space-y-1.5"><Label>Redes sociais (um link por linha, opcional)</Label><Textarea name="social_links" rows={2} placeholder="https://instagram.com/..." /></div>
                    <ImageUpload key={`new-${data.data?.o.length ?? 0}`} label="Foto oficial do candidato" />
                    <div className="flex gap-2">
                      <Button disabled={addOption.isPending}>{addOption.isPending ? "Salvando…" : "Salvar candidato"}</Button>
                      <Button type="button" variant="outline" onClick={() => setAddingCandidate(false)}>Cancelar</Button>
                    </div>
                  </form>
                )}

                <ul className="mt-4 space-y-2">
                  {data.data?.o.map((o, i) => (
                    <li key={o.id} className="rounded-lg border border-border bg-card">
                      <div className="flex items-center gap-3 p-3">
                        {!locked && (
                          <span className="flex flex-col text-muted-foreground" aria-label="Reordenar">
                            <button type="button" aria-label="Mover para cima" disabled={i === 0 || moveOption.isPending} onClick={() => moveOption.mutate({ oid: o.id, dir: -1 })} className="hover:text-foreground disabled:opacity-30"><ChevronUp className="size-4" /></button>
                            <GripVertical className="size-4" />
                            <button type="button" aria-label="Mover para baixo" disabled={i === (data.data?.o.length ?? 0) - 1 || moveOption.isPending} onClick={() => moveOption.mutate({ oid: o.id, dir: 1 })} className="hover:text-foreground disabled:opacity-30"><ChevronDown className="size-4" /></button>
                          </span>
                        )}
                        {o.image_url ? (
                          <StoredImage src={o.image_url} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
                        ) : (
                          <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted"><UserRound className="size-6 text-muted-foreground/50" /></span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold">{i + 1}. {o.name}{o.artistic_name ? ` (${o.artistic_name})` : ""}</div>
                          <div className="truncate text-xs text-muted-foreground">{[o.code && `#${o.code}`, o.group_name].filter(Boolean).join(" · ")}</div>
                          <div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${percent(tallies.get(o.id) ?? 0, total)}%` }} /></div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-semibold">{[o.city, o.state].filter(Boolean).join(" · ") || "—"}</div>
                          <div className={`mt-0.5 flex items-center justify-end gap-1 text-xs ${o.active ? "text-success" : "text-muted-foreground"}`}><span className={`size-1.5 rounded-full ${o.active ? "bg-success" : "bg-muted-foreground"}`} /> {o.active ? "Ativo" : "Inativo"}</div>
                          <div className="mt-0.5 text-xs font-bold">{tallies.get(o.id) ?? 0} voto(s) · {percent(tallies.get(o.id) ?? 0, total)}%</div>
                        </div>
                        {!locked && (
                          <div className="flex flex-col gap-1">
                            <Button type="button" size="icon" variant="ghost" aria-label={`Editar ${o.name}`} onClick={() => { setEditingOption(editingOption === o.id ? null : o.id); setAddingCandidate(false); }}><Pencil /></Button>
                            <Button type="button" size="icon" variant="ghost" aria-label={`${o.active ? "Desativar" : "Ativar"} ${o.name}`} disabled={toggleActive.isPending} onClick={() => toggleActive.mutate({ oid: o.id, active: !o.active })}><Power /></Button>
                            {(p.status === "rascunho" || p.status === "agendada") && <Button size="icon" variant="ghost" aria-label={`Excluir ${o.name}`} onClick={() => confirm(`Excluir o candidato "${o.name}"? Esta ação não pode ser desfeita.`) && delOption.mutate(o.id)}><Trash2 /></Button>}
                          </div>
                        )}
                      </div>
                      {editingOption === o.id && (
                        <form className="space-y-3 border-t border-border p-4" onSubmit={(e) => { e.preventDefault(); updateOption.mutate(new FormData(e.currentTarget)); }}>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5"><Label>Nome completo *</Label><Input name="name" defaultValue={o.name} required maxLength={150} /></div>
                            <div className="space-y-1.5"><Label>Nome artístico / de apresentação</Label><Input name="artistic_name" defaultValue={o.artistic_name} maxLength={150} /></div>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5"><Label>Número ou código</Label><Input name="code" defaultValue={o.code} maxLength={30} /></div>
                            <div className="space-y-1.5"><Label>Quadrilha junina ou grupo</Label><Input name="group_name" defaultValue={o.group_name} maxLength={150} /></div>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5"><Label>Estado</Label>
                              <select name="state" defaultValue={o.state} className={selectCls}><option value="">Selecione…</option>{UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}</select>
                            </div>
                            <div className="space-y-1.5"><Label>Cidade ou município</Label><Input name="city" defaultValue={o.city} maxLength={120} /></div>
                          </div>
                          <div className="space-y-1.5"><Label>Biografia ou apresentação</Label><Textarea name="description" defaultValue={o.description} rows={3} maxLength={1000} /></div>
                          <div className="space-y-1.5"><Label>Redes sociais (um link por linha)</Label><Textarea name="social_links" rows={2} defaultValue={(o.social_links as string[] ?? []).join("\n")} /></div>
                          <ImageUpload initialValue={o.image_url} label="Foto oficial (envie outro arquivo para substituir)" />
                          <div className="flex gap-2">
                            <Button disabled={updateOption.isPending}>{updateOption.isPending ? "Salvando…" : "Salvar candidato"}</Button>
                            <Button type="button" variant="outline" onClick={() => setEditingOption(null)}>Cancelar</Button>
                          </div>
                        </form>
                      )}
                    </li>
                  ))}
                  {!data.data?.o.length && <li className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Nenhum candidato adicionado ainda.</li>}
                </ul>
              </section>
            )}

            {/* Resultados e ranking */}
            {p && (data.data?.o.length ?? 0) > 0 && (
              <section className="rounded-xl border border-border bg-card p-5 shadow-card">
                <h2 className="flex items-center gap-2 text-lg font-extrabold"><Trophy className="size-5 text-primary" /> Resultados</h2>
                <p className="mt-1 text-sm text-muted-foreground">Total geral: <strong>{total} voto(s)</strong> · Visibilidade pública: {VISIBILITY[p.results_visibility]}</p>
                <ol className="mt-4 space-y-2">
                  {[...(data.data?.o ?? [])].sort((a, b) => (tallies.get(b.id) ?? 0) - (tallies.get(a.id) ?? 0)).map((o, pos) => (
                    <li key={o.id} className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground">{pos + 1}º</span>
                      {o.image_url ? <StoredImage src={o.image_url} alt="" className="size-10 shrink-0 rounded-lg object-cover" /> : <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted"><UserRound className="size-5 text-muted-foreground/50" /></span>}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{o.name}{o.active ? "" : " (inativo)"}</div>
                        <div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${percent(tallies.get(o.id) ?? 0, total)}%` }} /></div>
                      </div>
                      <div className="shrink-0 text-right text-sm font-bold">{tallies.get(o.id) ?? 0} <span className="text-xs font-semibold text-muted-foreground">({percent(tallies.get(o.id) ?? 0, total)}%)</span></div>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {p?.audience === "restrita" && (
              <form onSubmit={(e) => { e.preventDefault(); voters.mutate(String(new FormData(e.currentTarget).get("emails") ?? "")); }} className="space-y-2 rounded-xl border border-border bg-card p-5 shadow-card">
                <h3 className="font-bold">Participantes habilitados ({data.data?.v.length ?? 0})</h3>
                <Textarea name="emails" rows={4} defaultValue={data.data?.v.map((v) => v.email).join("\n")} placeholder="Um e-mail por linha" />
                <Button type="submit" variant="outline" size="sm">Salvar lista</Button>
              </form>
            )}

            {/* Botões de ação */}
            {!locked && (
              <div className="sticky bottom-0 -mx-6 -mb-6 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card/95 px-6 py-4 backdrop-blur">
                <div className="flex items-center gap-3">
                  <Button type="button" variant="outline" onClick={close}>Cancelar</Button>
                  {isDirty && <span className="text-xs font-medium text-muted-foreground">Alterações não salvas</span>}
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    disabled={save.isPending}
                    onClick={() => {
                      if (infoFormRef.current) save.mutate({ fd: new FormData(infoFormRef.current), publish: false });
                    }}
                  >
                    {save.isPending ? <Loader2 className="animate-spin" /> : <Save />} {save.isPending ? "Salvando…" : "Salvar alterações"}
                  </Button>
                  <Button
                    disabled={save.isPending}
                    onClick={() => {
                      if (infoFormRef.current) save.mutate({ fd: new FormData(infoFormRef.current), publish: true });
                    }}
                  >
                    <Send /> Publicar votação
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
