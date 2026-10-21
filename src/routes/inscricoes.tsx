import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/inscricoes")({
  head: () => ({ meta: [{ title: "Processos de inscrição — Portal Norte Junino" }, { name: "description", content: "Processos de inscrição do Portal Norte Junino." }, { property: "og:title", content: "Processos de inscrição — Portal Norte Junino" }, { property: "og:description", content: "Participe das oportunidades do portal." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: () => <Outlet />,
});
