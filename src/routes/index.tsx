import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Vote, Users, CalendarDays, ClipboardList, Star, Megaphone } from "lucide-react";
import hero from "@/assets/hero.jpg";
import imgVote from "@/assets/card-votacao.jpg";
import imgReg from "@/assets/card-inscricao.jpg";
import imgAgenda from "@/assets/card-agenda.jpg";
import logoAsset from "@/assets/logo-official.png.asset.json";
import { Button } from "@/components/ui/button";
import { StoredImage } from "@/components/site/StoredImage";
import { SiteShell, Eyebrow, LiveBadge } from "@/components/site/Layout";
import { pollsQuery, announcementsQuery } from "@/lib/queries";
import { opportunitiesQuery, opportunityOpen } from "@/lib/opportunities";
import { useLiveQueries } from "@/lib/realtime";
import { effectivePollStatus, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Portal Norte Junino — O movimento junino também é feito de pessoas" },
      { name: "description", content: "Participe das votações, inscreva-se nas oportunidades e acompanhe o movimento junino da Região Norte." },
      { property: "og:title", content: "Portal Norte Junino — Plataforma Oficial" },
      { property: "og:description", content: "Votações, inscrições e comunicados oficiais do movimento junino do Norte." },
    ],
  }),
  component: Home,
});

function Home() {
  const polls = useQuery(pollsQuery());
  const opps = useQuery(opportunitiesQuery());
  const ann = useQuery(announcementsQuery(3));
  const status = useLiveQueries("home", [
    { table: "polls", keys: [["polls"]] },
    { table: "opportunities", keys: [["opportunities"]] },
    { table: "announcements", keys: [["announcements"]] },
  ]);

  const activePolls = (polls.data ?? []).filter((p) => effectivePollStatus(p) === "ativa");
  const openOpps = (opps.data ?? []).filter((o) => opportunityOpen(o));
  const fallbacks = [imgVote, imgReg, imgAgenda];
  const featured = [
    ...activePolls.map((p) => ({ id: p.id, kind: "poll" as const, title: p.title, text: p.description, img: p.image_url, tag: "Votação aberta" })),
    ...openOpps.map((o) => ({ id: o.id, kind: "form" as const, title: o.title, text: o.description, img: o.image_url, tag: "Candidaturas abertas" })),
  ].slice(0, 3);

  return (
    <SiteShell>
      {/* HERO */}
      <section className="relative overflow-hidden bg-hero">
        <img src={hero} alt="Brincantes juninos do Norte" width={1600} height={1008} className="absolute inset-y-0 right-0 h-full w-full object-cover object-right md:w-[75%]" />
        <div className="absolute inset-0 fade-left" />
        <div className="absolute inset-0 fade-bottom" />
        <div className="relative mx-auto max-w-7xl px-5 pt-16 pb-10 md:pt-24">
          <div className="max-w-xl">
            <Eyebrow>Plataforma oficial</Eyebrow>
            <h1 className="mt-4 text-5xl font-extrabold leading-[1.05] md:text-6xl">
              O movimento junino também é feito <span className="text-highlight">de pessoas.</span>
            </h1>
            <p className="mt-6 text-lg text-foreground/85">
              Participe das votações, inscreva-se nas oportunidades e faça parte do Portal Norte Junino, o espaço que conecta a cultura, os brincantes e o futuro do movimento junino na região Norte.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button asChild variant="hero" size="xl">
                <Link to="/votacoes">Explorar votações <ArrowRight /></Link>
              </Button>
              <Button asChild variant="heroOutline" size="xl">
                <Link to="/vagas"><Users /> Quero participar</Link>
              </Button>
            </div>
          </div>

          <div className="mt-16 grid gap-5 md:grid-cols-3 md:mt-24">
            <QuickCard to="/votacoes" icon={<Vote />} title="Votações" text={activePolls.length ? `${activePolls.length} votação(ões) em andamento.` : "Participe das votações quando abertas."} />
            <QuickCard to="/vagas" icon={<Users />} title="Vagas" text={openOpps.length ? `${openOpps.length} vaga(s) com candidaturas abertas.` : "Conheça as oportunidades e faça parte."} />
            <QuickCard to="/agenda" icon={<CalendarDays />} title="Agenda" text="Confira os próximos eventos e resultados." />
          </div>
        </div>
      </section>

      {/* EM DESTAQUE */}
      <section className="theme-light">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 lg:grid-cols-[1fr_2.4fr]">
          <div>
            <div className="flex items-center gap-3">
              <Eyebrow boxed={false}>Em destaque</Eyebrow>
              <LiveBadge status={status} />
            </div>
            <h2 className="mt-4 text-4xl font-extrabold leading-tight">
              A cultura junina <span className="text-primary">se fortalece com a sua participação.</span>
            </h2>
            <p className="mt-5 text-muted-foreground">Acompanhe as votações, inscreva-se nas seleções e descubra como você pode contribuir para o movimento junino no Norte do Brasil.</p>
            <Button asChild variant="pill" size="lg" className="mt-8">
              <Link to="/vagas">Ver todas as oportunidades <ArrowRight /></Link>
            </Button>
          </div>
          {polls.isLoading || opps.isLoading ? (
            <div className="grid gap-5 sm:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-80 animate-pulse rounded-xl bg-muted" />)}</div>
          ) : featured.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-10 text-center">
              <Star className="size-8 text-primary" />
              <h3 className="mt-3 text-lg font-bold">Nenhuma votação ou inscrição aberta no momento</h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">Assim que novas oportunidades forem publicadas, elas aparecerão aqui automaticamente.</p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-3">
              {featured.map((f, i) => (
                <article key={f.id} className="overflow-hidden rounded-xl bg-card shadow-card">
                  <div className="relative">
                    <StoredImage src={f.img || fallbacks[i % 3]} alt="" loading="lazy" className="aspect-[5/4] w-full object-cover" />
                    <span className="absolute bottom-3 left-3 rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">{f.tag}</span>
                  </div>
                  <div className="p-5">
                    <h3 className="font-bold">{f.title}</h3>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{f.text}</p>
                    {f.kind === "poll" ? (
                      <Link to="/votacoes/$id" params={{ id: f.id }} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">Participar agora <ArrowRight className="size-4" /></Link>
                    ) : (
                      <Link to="/vagas/$id" params={{ id: f.id }} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">Quero participar <ArrowRight className="size-4" /></Link>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* COMUNICADOS */}
      {(ann.data?.length ?? 0) > 0 && (
        <section className="theme-light border-t border-border">
          <div className="mx-auto max-w-7xl px-5 pb-16">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-2xl font-extrabold"><Megaphone className="text-primary" /> Comunicados</h2>
              <Link to="/comunicados" className="text-sm font-semibold text-primary">Ver todos</Link>
            </div>
            <div className="mt-6 grid gap-5 md:grid-cols-3">
              {ann.data?.map((a) => (
                <article key={a.id} className="rounded-xl bg-card p-5 shadow-card">
                  <div className="text-xs text-muted-foreground">{fmtDate(a.published_at, false)}</div>
                  <h3 className="mt-1 font-bold">{a.title}</h3>
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{a.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* POR QUE PARTICIPAR */}
      <section className="relative overflow-hidden bg-hero">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 lg:grid-cols-[1.1fr_2fr]">
          <div>
            <Eyebrow>Por que participar?</Eyebrow>
            <h2 className="mt-4 text-4xl font-extrabold leading-tight md:text-5xl">
              Juntos fazemos o movimento junino ir <span className="text-highlight">mais longe.</span>
            </h2>
            <p className="mt-5 text-foreground/85">O Portal Norte Junino é o ponto de encontro de quem vive, apoia e acredita na cultura junina da região Norte.</p>
            <Button asChild variant="hero" size="lg" className="mt-8">
              <Link to="/sobre">Saiba mais <ArrowRight /></Link>
            </Button>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              { icon: <Users />, t: "Votações", d: "Sua opinião também conta." },
              { icon: <ClipboardList />, t: "Inscrições", d: "Oportunidades em todo o Norte." },
              { icon: <Star />, t: "Cultura", d: "Valorização dos nossos brincantes." },
            ].map((x) => (
              <div key={x.t} className="border-l border-border pl-6">
                <div className="flex size-12 items-center justify-center rounded-full border-2 border-primary text-primary-glow">{x.icon}</div>
                <h3 className="mt-4 text-xl font-bold">{x.t}</h3>
                <p className="mt-1 text-sm text-foreground/80">{x.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-band">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-5 py-12 md:flex-row md:justify-center md:gap-16">
          <img src={logoAsset.url} alt="Logomarca oficial do Portal Norte Junino" loading="lazy" className="hidden h-24 w-auto object-contain md:block" />
          <div className="text-center">
            <span className="rounded-full border border-foreground/50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider">Juntos pelo movimento junino</span>
            <h2 className="mt-3 text-3xl font-extrabold">Faça parte do movimento</h2>
            <p className="mt-1 text-sm text-foreground/85">Cadastre-se agora e participe de votações, inscrições e muito mais.</p>
            <Button asChild variant="light" size="lg" className="mt-5">
              <Link to="/auth" search={{ mode: "signup" }}>Criar minha conta <ArrowRight /></Link>
            </Button>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

function QuickCard({ to, icon, title, text }: { to: "/votacoes" | "/vagas" | "/agenda"; icon: ReactNode; title: string; text: string }) {
  return (
    <Link to={to} data-motion="item" className="portal-interactive-item group flex items-center gap-5 rounded-xl border border-primary/60 bg-navy-deep/70 p-6 backdrop-blur hover:border-primary hover:bg-navy/80">
      <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground [&_svg]:size-6">{icon}</div>
      <div className="flex-1">
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="text-sm text-foreground/80">{text}</p>
      </div>
      <ArrowRight className="text-primary-glow transition group-hover:translate-x-1" />
    </Link>
  );
}
