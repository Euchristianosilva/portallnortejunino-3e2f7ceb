import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, FileText, MapPin, Users, Clock, CalendarX } from "lucide-react";
import { SiteShell, EmptyState, Eyebrow } from "@/components/site/Layout";
import { Button } from "@/components/ui/button";
import { opportunityQuery, opportunityOpen, OPP_STATUS } from "@/lib/opportunities";
import { useLiveQueries } from "@/lib/realtime";
import { fmtDate } from "@/lib/format";
import { StoredImage } from "@/components/site/StoredImage";
import { opportunityLocation } from "@/lib/brazil-states";

export const Route = createFileRoute("/vagas/$id")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Detalhes da vaga — Portal Norte Junino" },
      { name: "description", content: "Conheça os detalhes, os termos aplicáveis e candidate-se a esta vaga." },
      { property: "og:title", content: "Vaga — Portal Norte Junino" },
      { property: "og:description", content: "Detalhes da oportunidade no movimento junino do Norte." },
    ],
  }),
  component: OpportunityPage,
});

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-card p-6 shadow-card">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-3 whitespace-pre-line text-sm leading-6 text-foreground/85">{children}</div>
    </section>
  );
}

function OpportunityPage() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery(opportunityQuery(id));
  useLiveQueries(`opportunity-${id}`, [{ table: "opportunities", filter: `id=eq.${id}`, keys: [["opportunity", id]] }]);

  if (isLoading) return <SiteShell><div className="mx-auto max-w-4xl px-5 py-20"><div className="h-96 animate-pulse rounded-xl bg-muted" /></div></SiteShell>;
  if (!data) return <SiteShell><div className="mx-auto max-w-3xl px-5 py-20"><EmptyState title="Vaga não encontrada" text="Esta vaga não existe ou não está publicada." /></div></SiteShell>;

  const o = data.opportunity;
  const open = opportunityOpen(o);

  return (
    <SiteShell>
      <section className="bg-hero border-b border-border">
        <div className="mx-auto max-w-4xl px-5 py-14">
          <Eyebrow>{o.category || "Vaga"}</Eyebrow>
          <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">{o.title}</h1>
          {o.project && <p className="mt-2 text-sm font-semibold text-primary">{o.project}</p>}
          {o.image_url && <StoredImage src={o.image_url} alt={o.title} className="mt-5 max-h-72 w-full rounded-lg object-contain" />}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-border p-3 text-sm"><MapPin className="mb-1 size-4 text-primary" />{opportunityLocation(o)}</div>
            <div className="rounded-lg border border-border p-3 text-sm"><Users className="mb-1 size-4 text-primary" />{o.seats ? `${o.seats} vaga(s)` : "Vagas conforme seleção"}</div>
            <div className="rounded-lg border border-border p-3 text-sm"><Clock className="mb-1 size-4 text-primary" />{o.dedication || "Disponibilidade descrita nos termos"}</div>
            <div className="rounded-lg border border-border p-3 text-sm"><CalendarX className="mb-1 size-4 text-primary" />{o.closes_at ? `Até ${fmtDate(o.closes_at)}` : "Sem encerramento definido"}</div>
          </div>
          <p className="mt-4 text-sm text-foreground/70">
            Modalidade: <strong>{o.modality_label}</strong> · Situação: <strong>{open ? "Candidaturas abertas" : OPP_STATUS[o.status]}</strong>
          </p>
        </div>
      </section>
      <section className="theme-light">
        <div className="mx-auto max-w-4xl space-y-5 px-5 py-12">
          {o.description && <Block title="Sobre a oportunidade">{o.description}</Block>}
          {o.activities && <Block title="Atividades e responsabilidades">{o.activities}</Block>}
          {o.requirements && <Block title="Requisitos para candidatura">{o.requirements}</Block>}
          {o.profile && <Block title="Perfil desejado">{o.profile}</Block>}
          {o.benefits && <Block title="Benefícios e condições">{o.benefits}</Block>}
          {o.selection_criteria && <Block title="Seleção e critérios de avaliação">{o.selection_criteria}</Block>}

          <section className="rounded-xl bg-card p-6 shadow-card">
            <h2 className="text-lg font-bold">Termos e documentos desta vaga</h2>
            <p className="mt-1 text-sm text-muted-foreground">Antes do formulário, você lerá e aceitará individualmente cada documento obrigatório.</p>
            <ul className="mt-4 space-y-2">
              {data.documents.map((d) => (
                <li key={d.link_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                  <span className="flex items-center gap-2 font-semibold"><FileText className="size-4 shrink-0 text-primary" />{d.title} <span className="text-xs font-normal text-muted-foreground">v{d.version}</span></span>
                  <span className="flex items-center gap-3">
                    <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${d.required ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{d.required ? "Obrigatório" : "Informativo"}</span>
                    <Link to="/vagas/$id/termos" params={{ id }} className="text-xs font-semibold text-primary hover:underline">Ler termo completo</Link>
                  </span>
                </li>
              ))}
              {data.documents.length === 0 && <li className="text-sm text-muted-foreground">Nenhum documento vinculado ainda.</li>}
            </ul>
          </section>

          {open ? (
            <Button asChild variant="hero" size="lg" className="w-full">
              <Link to="/vagas/$id/termos" params={{ id }}>Continuar para os termos e inscrição <ArrowRight className="size-4" /></Link>
            </Button>
          ) : (
            <EmptyState
              title="Candidaturas indisponíveis"
              text={o.status === "publicada" && o.opens_at && new Date(o.opens_at) > new Date()
                ? `As candidaturas abrem em ${fmtDate(o.opens_at)}.`
                : "Esta vaga não está recebendo candidaturas no momento."}
            />
          )}
        </div>
      </section>
    </SiteShell>
  );
}
