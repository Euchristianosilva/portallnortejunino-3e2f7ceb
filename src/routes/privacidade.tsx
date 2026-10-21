import { createFileRoute } from "@tanstack/react-router";
import { SiteShell, PageHeader } from "@/components/site/Layout";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Privacidade — Portal Norte Junino" },
      { name: "description", content: "Como o Portal Norte Junino trata seus dados pessoais." },
      { property: "og:title", content: "Política de privacidade — Portal Norte Junino" },
      { property: "og:description", content: "Como tratamos seus dados." },
    ],
  }),
  component: () => (
    <SiteShell>
      <PageHeader eyebrow="Privacidade" title="Política de" highlight="privacidade." />
      <section className="theme-light">
        <div className="mx-auto max-w-3xl space-y-4 px-5 py-14 text-sm text-muted-foreground">
          <p>Coletamos apenas os dados necessários para cadastro, inscrições e votações: nome, e-mail, cidade, estado e as respostas enviadas nos formulários.</p>
          <p>Os votos são registrados de forma vinculada à conta apenas para impedir duplicidades; os resultados divulgados mostram somente totais.</p>
          <p>O acompanhamento de inscrições exige protocolo e e-mail, e possui limite de tentativas para proteger seus dados.</p>
          <p>A equipe administrativa acessa as inscrições somente conforme as permissões concedidas, e toda alteração é registrada.</p>
        </div>
      </section>
    </SiteShell>
  ),
});
