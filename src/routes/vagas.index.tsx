import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Briefcase, MapPin } from "lucide-react";
import { SiteShell, PageHeader, EmptyState, LiveBadge } from "@/components/site/Layout";
import { opportunitiesQuery, opportunityOpen, OPP_STATUS } from "@/lib/opportunities";
import { useLiveQueries } from "@/lib/realtime";
import { fmtDate } from "@/lib/format";
import { StoredImage } from "@/components/site/StoredImage";
import imgReg from "@/assets/card-inscricao.jpg";

export const Route = createFileRoute("/vagas/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Vagas e oportunidades — Portal Norte Junino" },
      { name: "description", content: "Conheça as vagas abertas do movimento junino da Região Norte, leia os termos e candidate-se." },
      { property: "og:title", content: "Vagas e oportunidades — Portal Norte Junino" },
      { property: "og:description", content: "Oportunidades abertas no movimento junino do Norte." },
    ],
  }),
  component: Opportunities,
});

function Opportunities() {
  const { data, isLoading } = useQuery(opportunitiesQuery());
  const status = useLiveQueries("opportunities-list", [{ table: "opportunities", keys: [["opportunities"]] }]);
  const list = (data ?? []).map((o) => ({ ...o, open: opportunityOpen(o) })).sort((a, b) => Number(b.open) - Number(a.open));

  return (
    <SiteShell>
      <PageHeader eyebrow="Vagas" title="Oportunidades em todo o" highlight="Norte.">
        Escolha uma vaga, conheça os detalhes, leia e aceite os termos e envie sua candidatura. <span className="ml-2"><LiveBadge status={status} /></span>
      </PageHeader>
      <section className="theme-light">
        <div className="mx-auto max-w-7xl px-5 py-14">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card p-5 shadow-card">
            <span className="text-sm">Já se candidatou? Consulte o andamento com seu protocolo.</span>
            <Link to="/acompanhar" className="inline-flex items-center gap-2 text-sm font-semibold text-primary">Acompanhar inscrição <ArrowRight className="size-4" /></Link>
          </div>
          {isLoading ? (
            <div className="grid gap-6 md:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-72 animate-pulse rounded-xl bg-muted" />)}</div>
          ) : list.length === 0 ? (
            <EmptyState icon={<Briefcase />} title="Nenhuma vaga publicada" text="Novas oportunidades aparecerão aqui assim que forem abertas." />
          ) : (
            <div className="grid gap-6 md:grid-cols-3">
              {list.map((o) => (
                <Link key={o.id} to="/vagas/$id" params={{ id: o.id }} data-motion="item" className="portal-interactive-item group flex flex-col overflow-hidden rounded-xl bg-card shadow-card">
                  <div className="relative">
                    <StoredImage src={o.image_url || imgReg} alt="" loading="lazy" className="aspect-[16/10] w-full object-cover" />
                    <span className={`absolute bottom-3 left-3 rounded-md px-3 py-1 text-xs font-semibold ${o.open ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                      {o.open ? "Candidaturas abertas" : o.status === "publicada" && o.opens_at && new Date(o.opens_at) > new Date() ? "Em breve" : OPP_STATUS[o.status]}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    {o.category && <div className="text-xs font-semibold uppercase text-primary">{o.category}</div>}
                    <h3 className="mt-1 text-lg font-bold">{o.title}</h3>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{o.description}</p>
                    <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 text-xs text-muted-foreground">
                      {(o.city || o.state) && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{[o.city, o.state].filter(Boolean).join(" — ")}</span>}
                      <span>{o.closes_at ? `Até ${fmtDate(o.closes_at)}` : "Sem data de encerramento"}</span>
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
