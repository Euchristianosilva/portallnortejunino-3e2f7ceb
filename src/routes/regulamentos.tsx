import { createFileRoute } from "@tanstack/react-router";
import { SiteShell, PageHeader } from "@/components/site/Layout";

export const Route = createFileRoute("/regulamentos")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Regulamentos — Portal Norte Junino" },
      { name: "description", content: "Regras gerais das votações e inscrições do Portal Norte Junino." },
      { property: "og:title", content: "Regulamentos — Portal Norte Junino" },
      { property: "og:description", content: "Regras gerais de participação." },
    ],
  }),
  component: () => (
    <SiteShell>
      <PageHeader eyebrow="Regulamentos" title="Regras gerais de" highlight="participação." />
      <section className="theme-light">
        <div className="mx-auto max-w-3xl space-y-4 px-5 py-14 text-sm text-muted-foreground">
          <p>Cada votação e cada inscrição possui regras próprias, exibidas na sua página: período, público autorizado, limite de votos e forma de divulgação dos resultados.</p>
          <p>Para votar é necessário ter uma conta. Os limites de voto são aplicados pelo sistema e não podem ser contornados.</p>
          <p>Inscrições só são aceitas dentro do período definido. Cada inscrição recebe um protocolo de 4 dígitos para acompanhamento.</p>
        </div>
      </section>
    </SiteShell>
  ),
});
