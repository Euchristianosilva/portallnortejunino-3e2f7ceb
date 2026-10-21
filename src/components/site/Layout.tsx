import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Menu, UserRound, UserPlus, LogOut, LayoutDashboard, Instagram, Facebook, Youtube, Star, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import logoAsset from "@/assets/logo-official.png.asset.json";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import type { RtStatus } from "@/lib/realtime";

const NAV = [
  { to: "/", label: "Início" },
  { to: "/votacoes", label: "Votações" },
  { to: "/vagas", label: "Vagas" },
  { to: "/acompanhar", label: "Acompanhar" },
  { to: "/sobre", label: "Sobre" },
  { to: "/contato", label: "Contato" },
] as const;

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2.5 sm:gap-3">
      <img src={logoAsset.url} alt="Portal Norte Junino" className={compact ? "h-8 w-10 shrink-0 object-contain" : "h-9 w-12 shrink-0 object-contain sm:h-11 sm:w-14"} />
      <div className="leading-tight">
        <div className="whitespace-nowrap font-display text-xs font-bold sm:text-sm">PORTAL NORTE JUNINO</div>
        <div className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground">PLATAFORMA OFICIAL</div>
      </div>
    </Link>
  );
}

export function SiteHeader() {
  const { user, isStaff } = useAuth();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="portal-safe-top sticky top-0 z-40 border-b border-border bg-navy-deep/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:h-20 sm:gap-6">
        <Logo />
        <nav className="hidden items-center gap-8 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/" }}
              className="portal-nav-link relative py-2 text-sm font-semibold text-foreground/85 hover:text-foreground data-[status=active]:text-foreground"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          {user ? (
            <>
              {isStaff && (
                <Button asChild variant="outline" className="border-primary">
                  <Link to="/painel"><LayoutDashboard /> Painel</Link>
                </Button>
              )}
              <span className="max-w-40 truncate text-sm text-muted-foreground">{user.email}</span>
              <Button variant="ghost" onClick={signOut}><LogOut /> Sair</Button>
            </>
          ) : (
            <>
              <Button asChild variant="outline" className="h-10 border-primary px-5">
                <Link to="/auth"><UserRound /> Entrar</Link>
              </Button>
              <Button asChild className="h-10 px-5">
                <Link to="/auth" search={{ mode: "signup" }}><UserPlus /> Criar conta</Link>
              </Button>
            </>
          )}
        </div>
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(!open)} aria-label={open ? "Fechar menu" : "Abrir menu"} aria-expanded={open}>
          {open ? <X /> : <Menu />}
        </Button>
      </div>
      <div className="portal-mobile-menu lg:hidden" data-open={open} inert={!open} aria-hidden={!open}>
        <div className="min-h-0 overflow-hidden">
          <div className="portal-safe-x portal-safe-bottom flex flex-col gap-1 border-t border-border py-3">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} activeOptions={{ exact: n.to === "/" }} onClick={() => setOpen(false)} className="portal-mobile-link flex min-h-11 items-center rounded-lg px-3 font-semibold data-[status=active]:bg-accent data-[status=active]:text-primary-glow">
                {n.label}
              </Link>
            ))}
            {user ? (
              <>
                {isStaff && <Link to="/painel" onClick={() => setOpen(false)} className="flex min-h-11 items-center rounded-lg px-3 font-semibold text-primary-glow">Painel</Link>}
                <button onClick={signOut} className="flex min-h-11 items-center rounded-lg px-3 text-left font-semibold">Sair</button>
              </>
            ) : (
              <Button asChild className="mt-2 min-h-11"><Link to="/auth" onClick={() => setOpen(false)}>Entrar / Criar conta</Link></Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="portal-safe-bottom bg-navy-deep">
      <div className="mx-auto max-w-7xl px-5 py-8">
        <div className="flex flex-col items-center justify-between gap-6 border-b border-border pb-6 md:flex-row">
          <Logo compact />
          <div className="flex gap-8 text-sm text-foreground/85">
            <Link to="/privacidade">Privacidade</Link>
            <Link to="/regulamentos">Regulamentos</Link>
            <Link to="/contato">Contato</Link>
          </div>
          <div className="flex gap-4">
            <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram className="size-5" /></a>
            <a href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook className="size-5" /></a>
            <a href="https://youtube.com" target="_blank" rel="noreferrer" aria-label="YouTube"><Youtube className="size-5" /></a>
          </div>
        </div>
        <div className="flex flex-col justify-between gap-2 pt-5 text-xs text-muted-foreground md:flex-row">
          <span>© {new Date().getFullYear()} Portal Norte Junino. Todos os direitos reservados.</span>
          <span>Cultura · Tradição · Norte</span>
        </div>
      </div>
    </footer>
  );
}

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

export function Eyebrow({ children, boxed = true }: { children: ReactNode; boxed?: boolean }) {
  return (
    <span
      className={
        boxed
          ? "inline-flex items-center gap-2 rounded-full border border-primary/70 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary-glow"
          : "inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider"
      }
    >
      <Star className="size-3.5 fill-primary text-primary" /> {children}
    </span>
  );
}

export function PageHeader({ eyebrow, title, highlight, children }: { eyebrow: string; title: string; highlight?: string; children?: ReactNode }) {
  return (
    <section className="bg-hero border-b border-border">
      <div className="mx-auto max-w-7xl px-5 py-14 md:py-20">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-tight md:text-5xl">
          {title} {highlight && <span className="text-highlight">{highlight}</span>}
        </h1>
        {children && <div className="mt-4 max-w-2xl text-foreground/85">{children}</div>}
      </div>
    </section>
  );
}

export function EmptyState({ title, text, icon }: { title: string; text?: string; icon?: ReactNode }) {
  return (
    <div data-motion="state" className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-14 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary">
        {icon ?? <Star className="size-6" />}
      </div>
      <h3 className="text-lg font-bold">{title}</h3>
      {text && <p className="mt-1 max-w-md text-sm text-muted-foreground">{text}</p>}
    </div>
  );
}

export function LiveBadge({ status }: { status: RtStatus }) {
  const label = status === "live" ? "Ao vivo" : status === "connecting" ? "Conectando…" : "Reconectando…";
  const dot = status === "live" ? "bg-success" : status === "connecting" ? "bg-warning" : "bg-destructive";
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-semibold">
      <span className={`size-2 rounded-full ${dot} ${status === "live" ? "animate-pulse" : ""}`} /> {label}
    </span>
  );
}
