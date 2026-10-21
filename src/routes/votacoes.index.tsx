import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Vote } from "lucide-react";
import { SiteShell, PageHeader, EmptyState, LiveBadge } from "@/components/site/Layout";
import { pollsQuery } from "@/lib/queries";
import { useLiveQueries } from "@/lib/realtime";
import { POLL_STATUS, effectivePollStatus, fmtDate } from "@/lib/format";
import imgVote from "@/assets/card-votacao.jpg";
import { StoredImage } from "@/components/site/StoredImage";

export const Route = createFileRoute("/votacoes/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Votações — Portal Norte Junino" },
      { name: "description", content: "Participe das votações oficiais do movimento junino da Região Norte." },
      { property: "og:title", content: "Votações — Portal Norte Junino" },
      { property: "og:description", content: "Vote nos destaques do movimento junino do Norte." },
    ],
  }),
  component: Polls,
});

function Polls() {
  const { data, isLoading, error } = useQuery(pollsQuery());
  const status = useLiveQueries("polls-list", [{ table: "polls", keys: [["polls"]] }]);
  const list = (data ?? []).map((p) => ({ ...p, eff: effectivePollStatus(p) }));
  const order = { ativa: 0, agendada: 1, encerrada: 2, cancelada: 3, rascunho: 4 };
  list.sort((a, b) => order[a.eff] - order[b.eff]);

  return (
    <SiteShell>
      <PageHeader eyebrow="Votações" title="Sua opinião também" highlight="conta.">
        Escolha uma votação, confira as regras e registre seu voto. <span className="ml-2"><LiveBadge status={status} /></span>
      </PageHeader>
      <section className="theme-light">
        <div className="mx-auto max-w-7xl px-5 py-14">
          {error ? (
            <EmptyState title="Não foi possível carregar as votações" text="Verifique sua conexão e tente novamente." />
          ) : isLoading ? (
            <div className="grid gap-6 md:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-80 animate-pulse rounded-xl bg-muted" />)}</div>
          ) : list.length === 0 ? (
            <EmptyState icon={<Vote />} title="Nenhuma votação publicada" text="Quando uma votação for publicada, ela aparecerá aqui automaticamente." />
          ) : (
            <div className="grid gap-6 md:grid-cols-3">
              {list.map((p) => (
                <Link key={p.id} to="/votacoes/$id" params={{ id: p.id }} data-motion="item" className="portal-interactive-item group overflow-hidden rounded-xl bg-card shadow-card">
                  <div className="relative">
                    <StoredImage src={p.image_url || imgVote} alt="" loading="lazy" className="aspect-[16/10] w-full object-cover" />
                    <span className={`absolute bottom-3 left-3 rounded-md px-3 py-1 text-xs font-semibold ${p.eff === "ativa" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                      {POLL_STATUS[p.eff]}
                    </span>
                  </div>
                  <div className="p-5">
                    {p.category && <div className="text-xs font-semibold uppercase text-primary">{p.category}</div>}
                    <h3 className="mt-1 text-lg font-bold">{p.title}</h3>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                    <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{p.ends_at ? `Até ${fmtDate(p.ends_at)}` : ""}</span>
                      <span className="inline-flex items-center gap-1 font-semibold text-primary">Abrir <ArrowRight className="size-4 transition group-hover:translate-x-1" /></span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </SiteShell>
  );
}
