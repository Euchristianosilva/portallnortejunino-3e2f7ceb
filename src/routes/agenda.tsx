import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, MapPin } from "lucide-react";
import { SiteShell, PageHeader, EmptyState, LiveBadge } from "@/components/site/Layout";
import { eventsQuery } from "@/lib/queries";
import { useLiveQueries } from "@/lib/realtime";

export const Route = createFileRoute("/agenda")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Agenda — Portal Norte Junino" },
      { name: "description", content: "Próximos eventos, prazos e resultados do movimento junino do Norte." },
      { property: "og:title", content: "Agenda — Portal Norte Junino" },
      { property: "og:description", content: "Confira os próximos eventos e datas." },
    ],
  }),
  component: Page,
});

function Page() {
  const { data, isLoading } = useQuery(eventsQuery());
  const st = useLiveQueries("events", [{ table: "events", keys: [["events"]] }]);
  const now = new Date();
  const upcoming = (data ?? []).filter((e) => new Date(e.starts_at) >= new Date(now.toDateString()));
  return (
    <SiteShell>
      <PageHeader eyebrow="Agenda" title="Próximos" highlight="eventos."><LiveBadge status={st} /></PageHeader>
      <section className="theme-light">
        <div className="mx-auto max-w-4xl space-y-4 px-5 py-12">
          {isLoading ? <div className="h-40 animate-pulse rounded-xl bg-muted" /> : !upcoming.length ? (
            <EmptyState icon={<CalendarDays />} title="Nenhum evento agendado" text="Datas e eventos aparecerão aqui assim que forem publicados." />
          ) : upcoming.map((e) => {
            const d = new Date(e.starts_at);
            return (
              <article key={e.id} className="flex gap-5 rounded-xl bg-card p-5 shadow-card">
                <div className="flex w-20 shrink-0 flex-col items-center justify-center rounded-lg bg-primary py-3 text-primary-foreground">
                  <span className="font-display text-3xl font-extrabold">{d.getDate().toString().padStart(2, "0")}</span>
                  <span className="text-xs uppercase">{d.toLocaleString("pt-BR", { month: "short" })}</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold">{e.title}</h2>
                  <div className="mt-1 flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span>{d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                    {e.location && <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{e.location}</span>}
                  </div>
                  {e.description && <p className="mt-2 text-sm text-muted-foreground">{e.description}</p>}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </SiteShell>
  );
}
