import { createFileRoute, redirect } from "@tanstack/react-router";

// A lista pública de inscrições foi substituída pela lista de vagas.
// O endereço antigo continua funcionando e redireciona para /vagas.
export const Route = createFileRoute("/inscricoes/")({
  beforeLoad: () => {
    throw redirect({ to: "/vagas", replace: true });
  },
});
