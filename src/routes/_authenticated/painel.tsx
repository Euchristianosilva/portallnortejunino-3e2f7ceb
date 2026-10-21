import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { LayoutDashboard, ClipboardList, FileText, Vote, Megaphone, Users, ShieldCheck, ShieldAlert, ChartNoAxesCombined, UserMinus, CalendarDays, Mail, KeyRound, Briefcase, ScrollText } from "lucide-react";
import { SiteHeader, EmptyState } from "@/components/site/Layout";
import { useAuth, type Permission } from "@/lib/auth";
import { PageTransition } from "@/components/site/PageTransition";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Painel Master — Portal Norte Junino" },
      { name: "description", content: "Painel administrativo do Portal Norte Junino." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Painel — Portal Norte Junino" },
      { property: "og:description", content: "Área administrativa." },
    ],
  }),
  component: PanelLayout,
});

const ITEMS: { to: string; label: string; icon: React.ReactNode; perm?: Permission; master?: boolean }[] = [
  { to: "/painel", label: "Visão geral", icon: <LayoutDashboard /> },
  { to: "/painel/inscricoes", label: "Inscrições", icon: <ClipboardList />, perm: "registrations" },
  { to: "/painel/vagas", label: "Vagas", icon: <Briefcase />, perm: "forms" },
  { to: "/painel/termos", label: "Termos e documentos", icon: <ScrollText />, perm: "forms" },
  { to: "/painel/formularios", label: "Formulários", icon: <FileText />, perm: "forms" },
  { to: "/painel/votacoes", label: "Votações", icon: <Vote />, perm: "polls" },
  { to: "/painel/comunicados", label: "Comunicados e agenda", icon: <Megaphone />, perm: "announcements" },
  { to: "/painel/agenda", label: "Agenda", icon: <CalendarDays />, perm: "announcements" },
  { to: "/painel/equipe", label: "Equipe e permissões", icon: <Users />, master: true },
  { to: "/painel/permissoes", label: "Permissões", icon: <KeyRound />, master: true },
  { to: "/painel/relatorios", label: "Relatórios", icon: <ChartNoAxesCombined />, master: true },
  { to: "/painel/desligamentos", label: "Desligamento da equipe", icon: <UserMinus />, master: true },
  { to: "/painel/auditoria", label: "Auditoria e mensagens", icon: <ShieldCheck />, master: true },
  { to: "/painel/mensagens", label: "Mensagens", icon: <Mail />, master: true },
];

function PanelLayout() {
  const { loading, isStaff, isMaster, can } = useAuth();
  if (loading) return <div className="p-10 text-center text-muted-foreground">Carregando…</div>;
  if (!isStaff)
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-xl px-5 py-20">
          <EmptyState icon={<ShieldAlert />} title="Acesso restrito" text="Esta área é exclusiva da administração do Portal Norte Junino." />
        </div>
      </div>
    );
  const items = ITEMS.filter((i) => (i.master ? isMaster : i.perm ? can(i.perm) : true));
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto grid max-w-[1400px] gap-6 px-5 py-6 sm:py-8 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="mb-3 hidden px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground lg:block">{isMaster ? "Master" : "Coordenação"}</div>
          <nav aria-label="Navegação do painel" className="portal-panel-nav -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0 lg:pb-0">
            {items.map((i) => (
              <Link
                key={i.to}
                to={i.to}
                activeOptions={{ exact: i.to === "/painel" }}
                className="portal-panel-link flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground/80 hover:bg-accent data-[status=active]:border-primary data-[status=active]:bg-primary data-[status=active]:text-primary-foreground lg:min-h-0 lg:rounded-lg lg:border-0 lg:px-3 [&_svg]:size-4"
              >
                {i.icon} {i.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="theme-light min-w-0 rounded-xl p-4 sm:p-5 md:p-8">
          <PageTransition panel><Outlet /></PageTransition>
        </div>
      </div>
    </div>
  );
}
