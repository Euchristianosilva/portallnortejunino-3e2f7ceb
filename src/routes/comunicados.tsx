import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Megaphone } from "lucide-react";
import { SiteShell, PageHeader, EmptyState, LiveBadge } from "@/components/site/Layout";
import { announcementsQuery } from "@/lib/queries";
import { useLiveQueries } from "@/lib/realtime";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/comunicados")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Comunicados — Portal Norte Junino" },
      { name: "description", content: "Comunicados oficiais do Portal Norte Junino." },
      { property: "og:title", content: "Comunicados — Portal Norte Junino" },
      { property: "og:description", content: "Avisos e comunicados oficiais do movimento junino do Norte." },
    ],
  }),
  component: Page,
});

function Page() {
  const { data, isLoading } = useQuery(announcementsQuery(50));
  const st = useLiveQueries("ann", [{ table: "announcements", keys: [["announcements"]] }]);
  return (
    <SiteShell>
      <PageHeader eyebrow="Comunicados" title="Avisos" highlight="oficiais."><LiveBadge status={st} /></PageHeader>
      <section className="theme-light">
        <div className="mx-auto max-w-3xl space-y-5 px-5 py-12">
          {isLoading ? <div className="h-40 animate-pulse rounded-xl bg-muted" /> : !data?.length ? (
            <EmptyState icon={<Megaphone />} title="Nenhum comunicado publicado" />
          ) : data.map((a) => (
            <article key={a.id} className="rounded-xl bg-card p-6 shadow-card">
              <div className="text-xs text-muted-foreground">{fmtDate(a.published_at)}</div>
              <h2 className="mt-1 text-xl font-bold">{a.title}</h2>
              <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{a.body}</p>
            </article>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
