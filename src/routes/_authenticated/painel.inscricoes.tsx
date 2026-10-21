import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLiveQueries } from "@/lib/realtime";
import { LiveBadge } from "@/components/site/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AttachmentLink } from "@/components/site/AttachmentLink";
import { AdminDossierActions } from "@/components/site/AdminDossierActions";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { REG_STATUS, fmtDate, errMsg, type RegStatus, type FormField } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/painel/inscricoes")({ head: () => ({ meta: [{ title: "Inscrições administrativas — Portal Norte Junino" }, { name: "description", content: "Consulte inscrições e atualize seus status." }, { property: "og:title", content: "Inscrições administrativas — Portal Norte Junino" }, { property: "og:description", content: "Consulte inscrições e atualize seus status." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), component: Regs });

const PAGE = 20;

function Regs() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<RegStatus | "">("");
  const [formId, setFormId] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<"desc" | "asc">("desc");
  const [openId, setOpenId] = useState<string | null>(null);

  const forms = useQuery({
    queryKey: ["admin", "forms-min"],
    queryFn: async () => (await supabase.from("registration_forms").select("id, title, category, fields").order("created_at", { ascending: false })).data ?? [],
  });
  const list = useQuery({
    queryKey: ["admin", "regs", q, status, formId, category, city, page, sort, forms.data],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let qq = supabase.from("registrations").select("id, protocol, full_name, email, status, created_at, updated_at, registration_forms(title), opportunities(title, category)", { count: "exact" });
      if (status) qq = qq.eq("status", status);
      if (formId) qq = qq.eq("form_id", formId);
      if (category) qq = qq.in("form_id", (forms.data ?? []).filter(f => f.category === category).map(f => f.id));
      const municipality = city.trim().replace(/[%,()]/g, "");
      if (municipality) {
        const keys = new Set(["cidade", "municipio", "city"]);
        for (const form of forms.data ?? []) for (const field of form.fields as unknown as FormField[]) {
          if (/munic[ií]pio|cidade/i.test(field.label) && /^[a-zA-Z0-9_]+$/.test(field.key)) keys.add(field.key);
        }
        qq = qq.or([...keys].map(key => `answers->>${key}.ilike.%${municipality}%`).join(","));
      }
      const s = q.trim().replace(/[%,()]/g, "");
      if (s) qq = /^\d{1,4}$/.test(s) ? qq.like("protocol", `${s}%`) : qq.or(`full_name.ilike.%${s}%,email.ilike.%${s}%`);
      const { data, count, error } = await qq.order("created_at", { ascending: sort === "asc" }).range(page * PAGE, page * PAGE + PAGE - 1);
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0 };
    },
  });
  const st = useLiveQueries("admin-regs", [{ table: "registrations", keys: [["admin", "regs"], ["admin", "reg"]] }]);
  const pages = Math.max(1, Math.ceil((list.data?.count ?? 0) / PAGE));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-extrabold">Inscrições</h1><LiveBadge status={st} /></div>
      <div className="mt-5 grid gap-3 md:grid-cols-[1fr_200px_220px_150px]">
        <Input placeholder="Buscar por nome, e-mail ou protocolo" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        <select className="h-9 rounded-md border border-input bg-card px-2 text-sm" value={status} onChange={(e) => { setStatus(e.target.value as RegStatus | ""); setPage(0); }}>
          <option value="">Todos os status</option>
          {Object.entries(REG_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="h-9 rounded-md border border-input bg-card px-2 text-sm" value={formId} onChange={(e) => { setFormId(e.target.value); setPage(0); }}>
          <option value="">Todas as modalidades</option>
          {forms.data?.map((f) => <option key={f.id} value={f.id}>{f.title}</option>)}
        </select>
        <select className="h-9 rounded-md border border-input bg-card px-2 text-sm" value={sort} onChange={(e) => setSort(e.target.value as "asc" | "desc")}>
          <option value="desc">Mais recentes</option><option value="asc">Mais antigas</option>
        </select>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <select aria-label="Categoria" className="h-9 rounded-md border border-input bg-card px-2 text-sm" value={category} onChange={e => { setCategory(e.target.value); setPage(0); }}><option value="">Todas as categorias</option>{[...new Set((forms.data ?? []).map(f => f.category).filter(Boolean))].map(c => <option key={c} value={c}>{c}</option>)}</select>
        <Input aria-label="Município" placeholder="Município" value={city} onChange={e => { setCity(e.target.value); setPage(0); }}/>
      </div>
      <div className="mt-5 overflow-x-auto rounded-xl bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <tr><th className="p-3">Protocolo</th><th className="p-3">Nome</th><th className="p-3">Modalidade</th><th className="p-3">Status</th><th className="p-3">Recebida</th><th className="p-3">Documentos</th></tr>
          </thead>
          <tbody>
            {list.isLoading ? <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Carregando…</td></tr> :
              list.error ? <tr><td colSpan={6} className="p-6 text-center text-destructive">{errMsg(list.error)}</td></tr> :
              !list.data?.rows.length ? <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhuma inscrição encontrada.</td></tr> :
              list.data.rows.map((r) => (
                <tr key={r.id} onClick={() => setOpenId(r.id)} className="cursor-pointer border-b border-border last:border-0 hover:bg-accent">
                  <td className="p-3 font-bold text-primary">{r.protocol}</td>
                  <td className="p-3"><div className="font-semibold">{r.full_name}</div><div className="text-xs text-muted-foreground">{r.email}</div></td>
                  <td className="p-3"><div>{(r.opportunities as { title: string; category: string } | null)?.title ?? (r.registration_forms as { title: string } | null)?.title}</div>{(r.opportunities as { category: string } | null)?.category && <div className="text-xs text-muted-foreground">{(r.opportunities as { category: string } | null)?.category}</div>}</td>
                  <td className="p-3"><span key={r.status} className="portal-status rounded-full bg-accent px-2 py-1 text-xs font-semibold">{REG_STATUS[r.status]}</span></td>
                  <td className="p-3 text-muted-foreground">{fmtDate(r.created_at)}</td>
                  <td className="p-3"><AdminDossierActions registrationId={r.id} protocol={r.protocol}/></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{list.data?.count ?? 0} resultado(s)</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
          <span>{page + 1} / {pages}</span>
          <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Próxima</Button>
        </div>
      </div>
      {openId && <RegDialog id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function RegDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const reg = useQuery({
    queryKey: ["admin", "reg", id],
    queryFn: async () => {
      const [r, h, c] = await Promise.all([
        supabase.from("registrations").select("*, registration_forms(title, fields), opportunities(title, category)").eq("id", id).single(),
        supabase.from("registration_status_history").select("*").eq("registration_id", id).order("created_at", { ascending: false }),
        supabase.from("consent_events").select("event, created_at, legal_document_versions(title, version)").eq("registration_id", id).order("created_at"),
      ]);
      if (r.error) throw r.error;
      return { r: r.data, h: h.data ?? [], c: c.data ?? [] };
    },
  });
  useLiveQueries(`admin-reg-${id}`, [{ table: "registration_status_history", filter: `registration_id=eq.${id}`, keys: [["admin", "reg", id]] }]);
  const [base, setBase] = useState<string | null>(null);
  const r = reg.data?.r;
  if (r && base === null) setBase(r.updated_at);
  const changedElsewhere = r && base && r.updated_at !== base;

  const save = useMutation({
    mutationFn: async (v: { status: RegStatus; note: string; public_note: string }) => {
      if (!base) throw new Error("Aguarde o carregamento da inscrição.");
      const { error } = await supabase.rpc("update_registration_status", { _id: id, _status: v.status, _note: v.note, _public_note: v.public_note, _expected_updated_at: base });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Status atualizado.");
      setBase(null);
      await qc.invalidateQueries({ queryKey: ["admin", "reg", id] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const fields = (r?.fields_snapshot as unknown as FormField[]) ?? [];
  const answers = (r?.answers ?? {}) as Record<string, string>;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="theme-light max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{r ? `${r.protocol} · ${r.full_name}` : "Carregando…"}</DialogTitle></DialogHeader>
        {r && (
          <div className="space-y-6">
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div><span className="text-muted-foreground">E-mail:</span> {r.email}</div>
              <div><span className="text-muted-foreground">Modalidade:</span> {(r.registration_forms as { title: string } | null)?.title}</div>
              <div><span className="text-muted-foreground">Vaga:</span> {(r.opportunities as { title: string; category: string } | null)?.title ?? "— (inscrição anterior ao sistema de vagas)"}</div>
              <div><span className="text-muted-foreground">Recebida:</span> {fmtDate(r.created_at)}</div>
              <div><span className="text-muted-foreground">Atualizada:</span> {fmtDate(r.updated_at)}</div>
            </div>
            <div className="flex items-center justify-between border-y border-border py-3"><h3 className="font-bold">Documentos da inscrição</h3><AdminDossierActions registrationId={id} protocol={r.protocol}/></div>
            <div className="rounded-lg bg-muted p-4">
              <h3 className="mb-2 font-bold">Termos e aceites registrados</h3>
              {(reg.data?.c.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum evento de consentimento vinculado a esta candidatura.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {reg.data?.c.map((ev, i) => {
                    const v = ev.legal_document_versions as { title: string; version: number } | null;
                    const label = ev.event === "accepted" ? "Aceite expresso" : ev.event === "refused" ? "Recusa registrada" : ev.event === "revoked" ? "Revogação" : "Texto disponibilizado";
                    return (
                      <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2">
                        <span>{v?.title ?? "Documento"} <span className="text-xs text-muted-foreground">v{v?.version}</span></span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ev.event === "accepted" ? "bg-primary/10 text-primary" : ev.event === "refused" || ev.event === "revoked" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>{label}</span>
                        <span className="text-xs text-muted-foreground">{fmtDate(ev.created_at)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="rounded-lg bg-muted p-4">
              <h3 className="mb-2 font-bold">Respostas</h3>
              {fields.length === 0 && Object.keys(answers).length === 0 ? <p className="text-sm text-muted-foreground">Sem campos adicionais.</p> : (
                <dl className="space-y-2 text-sm">
                  {(fields.length ? fields : Object.keys(answers).map((k) => ({ key: k, label: k }))).map((f) => (
                    <div key={f.key}><dt className="text-muted-foreground">{f.label}</dt><dd className="whitespace-pre-line font-medium">{"type" in f && f.type === "file" && answers[f.key] ? <AttachmentLink path={answers[f.key] ?? ""}/> : answers[f.key] === "true" ? "Confirmado" : answers[f.key] || "—"}</dd></div>
                  ))}
                </dl>
              )}
            </div>
            {changedElsewhere && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">Esta inscrição foi alterada por outra pessoa. <button className="underline" onClick={() => setBase(r.updated_at)}>Usar versão atual</button></div>}
            <form
              key={r.updated_at}
              className="portal-form-state space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                save.mutate({ status: fd.get("status") as RegStatus, note: String(fd.get("note") ?? ""), public_note: String(fd.get("public_note") ?? "") });
              }}
            >
              <div className="space-y-1.5"><Label>Status</Label>
                <select name="status" defaultValue={r.status} className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm">
                  {Object.entries(REG_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="space-y-1.5"><Label>Orientação visível para a pessoa inscrita</Label><Textarea name="public_note" defaultValue={r.public_note ?? ""} maxLength={2000} /></div>
              <div className="space-y-1.5"><Label>Observação interna (histórico)</Label><Textarea name="note" maxLength={2000} /></div>
              <Button type="submit" disabled={save.isPending || !!changedElsewhere}>{save.isPending ? "Salvando…" : "Salvar alteração"}</Button>
            </form>
            <div>
              <h3 className="mb-2 font-bold">Histórico</h3>
              <ul className="space-y-2 text-sm">
                {reg.data?.h.map((h) => (
                  <li key={h.id} className="rounded-lg border border-border p-3">
                    <div className="flex justify-between"><strong>{REG_STATUS[h.status]}</strong><span className="text-muted-foreground">{fmtDate(h.created_at)}</span></div>
                    {h.note && <p className="mt-1 text-muted-foreground">{h.note}</p>}
                    <p className="text-xs text-muted-foreground">Responsável: {h.changed_by ? h.changed_by.slice(0, 8) : "sistema/inscrito"}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
