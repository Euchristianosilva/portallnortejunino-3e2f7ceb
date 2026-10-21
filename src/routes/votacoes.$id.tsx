import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Lock, Clock, Search, CalendarDays, Tag, Users, Trophy, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell, EmptyState, LiveBadge } from "@/components/site/Layout";
import { Button } from "@/components/ui/button";
import { pollQuery, tallyQuery, myVotesQuery } from "@/lib/queries";
import { useLiveQueries } from "@/lib/realtime";
import { useAuth } from "@/lib/auth";
import { POLL_STATUS, VISIBILITY, effectivePollStatus, fmtDate, percent, errMsg } from "@/lib/format";
import imgVote from "@/assets/card-votacao.jpg";
import { StoredImage } from "@/components/site/StoredImage";

export const Route = createFileRoute("/votacoes/$id")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Votação — Portal Norte Junino" },
      { name: "description", content: "Confira os participantes e registre seu voto." },
      { property: "og:title", content: "Votação — Portal Norte Junino" },
      { property: "og:description", content: "Participe desta votação do movimento junino do Norte." },
    ],
  }),
  component: PollPage,
});

function useNow(ms = 15000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

const STATUS_SEAL: Record<string, string> = {
  ativa: "Votação em andamento",
  agendada: "Votação agendada",
  encerrada: "Votação encerrada",
  cancelada: "Votação cancelada",
  rascunho: "Rascunho",
};

function PollPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const now = useNow();
  const poll = useQuery(pollQuery(id));
  const tally = useQuery(tallyQuery(id));
  const mine = useQuery(myVotesQuery(id, user?.id));
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const status = useLiveQueries(`poll-${id}`, [
    { table: "polls", filter: `id=eq.${id}`, keys: [["poll", id], ["tally", id]] },
    { table: "poll_options", filter: `poll_id=eq.${id}`, keys: [["poll", id]] },
    { table: "poll_tallies", filter: `poll_id=eq.${id}`, keys: [["tally", id]] },
    { table: "poll_participation", filter: `poll_id=eq.${id}`, keys: [["tally", id]] },
  ]);

  const vote = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data, error } = await supabase.rpc("cast_vote", { _poll_id: id, _option_ids: ids });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (left) => {
      toast.success(left < 0 ? "Voto registrado! Você pode votar novamente quando quiser." : "Voto registrado com sucesso!");
      setSelected([]);
      qc.invalidateQueries({ queryKey: ["myvotes", id] });
      qc.invalidateQueries({ queryKey: ["tally", id] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const p = poll.data;
  const eff = p ? effectivePollStatus(p, now) : null;
  useEffect(() => {
    if (eff === "encerrada") qc.invalidateQueries({ queryKey: ["tally", id] });
  }, [eff, id, qc]);

  const options = useMemo(() => [...(p?.poll_options ?? [])].filter((o) => o.active).sort((a, b) => a.position - b.position), [p]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) =>
      [o.name, o.group_name, o.state, o.city, o.description].some((v) => (v ?? "").toLowerCase().includes(q)),
    );
  }, [options, search]);

  if (poll.isLoading)
    return (
      <SiteShell>
        <div className="mx-auto max-w-5xl px-5 py-20">
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
        </div>
      </SiteShell>
    );
  if (!p)
    return (
      <SiteShell>
        <div className="mx-auto max-w-5xl px-5 py-20">
          <EmptyState title="Votação não encontrada" text="Ela pode ter sido removida ou ainda não foi publicada." />
        </div>
      </SiteShell>
    );

  const counts = new Map(tally.data?.tallies.map((t) => [t.option_id, t.votes]));
  const showResults = (tally.data?.tallies.length ?? 0) > 0 || (p.results_visibility === "ao_vivo" && eff !== "rascunho");
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const used = mine.data?.length ?? 0;
  const single = p.single_vote;
  const canVoteMore = !single || used === 0;
  const votedIds = new Set(mine.data?.map((v) => v.option_id));
  const open = eff === "ativa";

  function pick(oid: string) {
    setSelected((s) => {
      if (s.includes(oid)) return s.filter((x) => x !== oid);
      if (single) return [oid];
      return [...s, oid];
    });
  }

  return (
    <SiteShell>
      {/* Banner principal */}
      <section className="bg-hero relative overflow-hidden border-b border-border">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-5 py-12 md:grid-cols-[1.5fr_1fr] md:py-16">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-primary px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-primary-foreground">
              <span className={`size-2 rounded-full ${open ? "bg-success animate-pulse" : "bg-primary-foreground/70"}`} />
              {STATUS_SEAL[eff ?? p.status]}
            </span>
            {p.project && <p className="mt-5 text-sm font-semibold text-primary-glow">Projeto {p.project}</p>}
            <h1 className="mt-2 text-4xl font-extrabold leading-tight md:text-5xl">{p.title}</h1>
            <p className="mt-4 max-w-xl whitespace-pre-line text-foreground/85">{p.description}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <LiveBadge status={status} />
              {open && !user && (
                <Button asChild size="sm">
                  <Link to="/auth" search={{ next: `/votacoes/${id}` }}>
                    <Lock /> Entrar para votar
                  </Link>
                </Button>
              )}
            </div>
          </div>
          <StoredImage src={p.image_url || imgVote} alt="" className="aspect-[4/3] w-full rounded-2xl object-cover shadow-lg" />
        </div>
        {/* Faixa de informações */}
        <div className="border-t border-border/60 bg-navy-deep/60">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-y-4 px-5 py-5 text-sm md:grid-cols-4 md:divide-x md:divide-border/60">
            <div className="flex items-center gap-3 md:px-5 md:first:pl-0">
              <CalendarDays className="size-5 shrink-0 text-primary-glow" />
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Início</div>
                <div className="font-semibold">{fmtDate(p.starts_at)}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 md:px-5">
              <Clock className="size-5 shrink-0 text-primary-glow" />
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Encerramento</div>
                <div className="font-semibold">{fmtDate(p.ends_at)}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 md:px-5">
              <Tag className="size-5 shrink-0 text-primary-glow" />
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Categoria</div>
                <div className="font-semibold">{p.category || "Geral"}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 md:px-5">
              <Users className="size-5 shrink-0 text-primary-glow" />
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Total de candidatos</div>
                <div className="font-semibold">{options.length} participante(s)</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Participantes */}
      <section className="theme-light">
        <div className="mx-auto max-w-7xl px-5 py-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-extrabold md:text-3xl">Conheça os participantes</h2>
              <p className="mt-1 text-sm text-muted-foreground">Confira os candidatos da categoria e vote no seu favorito.</p>
            </div>
            <label className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar candidato..."
                className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
          </div>

          {user && open && (
            <p className="mt-4 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
              {single
                ? used > 0
                  ? "Seu voto já foi registrado. Nesta votação cada participante vota apenas uma vez."
                  : "Voto único: você poderá registrar apenas um voto nesta votação."
                : `Votos ilimitados: vote quantas vezes quiser, inclusive no mesmo candidato.${used > 0 ? ` Você já registrou ${used} voto(s).` : ""}`}
            </p>
          )}

          {options.length === 0 ? (
            <div className="mt-8">
              <EmptyState title="Nenhum participante cadastrado" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="mt-8">
              <EmptyState title="Nenhum participante encontrado" text="Ajuste a busca para localizar um candidato." />
            </div>
          ) : (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((o) => {
                const idx = options.indexOf(o) + 1;
                const c = counts.get(o.id) ?? 0;
                const sel = selected.includes(o.id);
                const already = votedIds.has(o.id);
                const canPick = open && !!user && canVoteMore;
                return (
                  <article
                    key={o.id}
                    data-motion="item"
                    className={`portal-interactive-item flex flex-col overflow-hidden rounded-xl border-2 bg-card shadow-card ${sel ? "border-primary" : "border-transparent"}`}
                  >
                    <div className="relative">
                      {o.image_url ? (
                        <StoredImage src={o.image_url} alt={o.name} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                      ) : (
                        <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted">
                          <UserRound className="size-16 text-muted-foreground/50" />
                        </div>
                      )}
                      <span className="absolute left-3 top-3 flex size-7 items-center justify-center rounded-full bg-navy-deep text-xs font-extrabold text-primary-foreground shadow">
                        {idx}
                      </span>
                      {(sel || (already && single)) && (
                        <span className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                          <Check className="size-4" />
                        </span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="font-bold leading-snug">{o.name}</h3>
                      {o.artistic_name && <p className="mt-0.5 text-xs font-semibold text-primary">{o.artistic_name}</p>}
                      {o.group_name && <p className="mt-0.5 text-xs text-muted-foreground">{o.group_name}</p>}
                      {(o.state || o.city) && (
                        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <span className="size-2 rounded-full bg-primary" />
                          {[o.city, o.state].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {o.description && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{o.description}</p>}
                      {Array.isArray(o.social_links) && (o.social_links as string[]).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(o.social_links as string[]).map((s) => (
                            <a key={s} href={s} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary underline-offset-2 hover:underline">{(() => { try { return new URL(s).hostname.replace(/^www\./, ""); } catch { return "Rede social"; } })()}</a>
                          ))}
                        </div>
                      )}
                      {showResults && (
                        <div className="mt-3">
                          <div className="flex justify-between text-xs font-semibold">
                            <span>{c} voto(s)</span>
                            <span>{percent(c, total)}%</span>
                          </div>
                          <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                            <div className="portal-result-bar h-full rounded-full bg-primary" style={{ width: `${percent(c, total)}%` }} />
                          </div>
                        </div>
                      )}
                      <div className="mt-auto pt-4">
                        <Button
                          type="button"
                          className="w-full"
                          variant={already && single ? "outline" : "default"}
                          disabled={!canPick}
                          onClick={() => pick(o.id)}
                        >
                          {already && single ? (
                            <>
                              <Check /> Voto registrado
                            </>
                          ) : sel && !single ? (
                            "Remover seleção"
                          ) : already ? (
                            "Votar novamente"
                          ) : (
                            "Votar neste candidato"
                          )}
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}

              {/* Card de participação */}
              {!search.trim() && (
                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-card/60 p-8 text-center">
                  <Trophy className="size-10 text-primary" />
                  <h3 className="mt-4 text-lg font-extrabold">Participe!</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Sua participação é muito importante para valorizar e fortalecer a cultura junina da nossa região.
                  </p>
                  <p className="mt-4 font-display text-lg font-bold text-primary">Viva o São João!</p>
                </div>
              )}
            </div>
          )}

          {open && user && (
            <div className="sticky mt-8 flex justify-end" style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
              <Button variant="hero" size="xl" disabled={!selected.length || !canVoteMore || vote.isPending} onClick={() => vote.mutate(selected)}>
                {vote.isPending ? "Registrando…" : `Confirmar voto${selected.length > 1 ? "s" : ""}`}
              </Button>
            </div>
          )}
          {p.rules && (
            <div className="mt-10 rounded-xl border border-border bg-card p-5 text-sm whitespace-pre-line text-muted-foreground">
              <strong className="text-foreground">Regras de participação:</strong>
              <br />
              {p.rules}
            </div>
          )}
          {!showResults && eff !== "ativa" && eff !== "agendada" && (
            <p className="mt-8 text-center text-sm text-muted-foreground">Os resultados desta votação ainda não foram divulgados.</p>
          )}
          {eff === "agendada" && (
            <p className="mt-8 text-center text-sm text-muted-foreground">
              Esta votação ainda não começou. A abertura está prevista para {fmtDate(p.starts_at)}.
            </p>
          )}
        </div>
      </section>
    </SiteShell>
  );
}
