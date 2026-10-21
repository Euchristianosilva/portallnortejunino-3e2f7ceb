import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell, PageHeader } from "@/components/site/Layout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Sobre — Portal Norte Junino" },
      { name: "description", content: "Conheça o propósito do Portal Norte Junino." },
      { property: "og:title", content: "Sobre o Portal Norte Junino" },
      { property: "og:description", content: "Fortalecendo e dando visibilidade ao movimento junino da Região Norte." },
    ],
  }),
  component: () => (
    <SiteShell>
      <PageHeader eyebrow="Sobre" title="Fortalecer e dar visibilidade ao movimento junino do" highlight="Norte." />
      <section className="theme-light">
        <div className="mx-auto max-w-3xl space-y-5 px-5 py-14 text-muted-foreground">
          <p>O Portal Norte Junino tem como propósito fortalecer e dar visibilidade ao movimento junino da Região Norte do Brasil, valorizando suas tradições, quadrilhas, brincantes, eventos e manifestações culturais.</p>
          <p>Nesta plataforma oficial você participa das votações, se inscreve nas oportunidades e acompanha cada etapa com transparência e em tempo real.</p>
          <div className="flex gap-3 pt-4">
            <Button asChild><Link to="/votacoes">Ver votações</Link></Button>
            <Button asChild variant="pill"><Link to="/inscricoes">Ver inscrições</Link></Button>
          </div>
        </div>
      </section>
    </SiteShell>
  ),
});
