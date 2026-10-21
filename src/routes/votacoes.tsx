import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/votacoes")({
  head: () => ({ meta: [{ title: "Processos de votação — Portal Norte Junino" }, { name: "description", content: "Processos de votação do Portal Norte Junino." }, { property: "og:title", content: "Processos de votação — Portal Norte Junino" }, { property: "og:description", content: "Participe das votações oficiais do portal." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: () => <Outlet />,
});
