import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLiveQueries } from "@/lib/realtime";
import { LiveBadge } from "@/components/site/Layout";
import { REG_STATUS, fmtDate, type RegStatus } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/painel/")({ head: () => ({ meta: [{ title: "Visão geral administrativa — Portal Norte Junino" }, { name: "description", content: "Indicadores reais do Portal Norte Junino." }, { property: "og:title", content: "Visão geral administrativa — Portal Norte Junino" }, { property: "og:description", content: "Indicadores reais do Portal Norte Junino." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), component: Overview });

async function count(table: "registrations" | "polls" | "registration_forms" | "announcements" | "profiles", f?: (q: any) => any) {
  let q = supabase.from(table).select("id", { count: "exact", head: true });
  if (f) q = f(q);
  const { count } = await q;
  return count ?? 0;
}

function Overview() {
  const stats = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const statuses = Object.keys(REG_STATUS) as RegStatus[];
      const [total, users, activePolls, openForms, published, ...byStatus] = await Promise.all([
        count("registrations"),
        count("profiles"),
        count("polls", (q) => q.eq("status", "ativa")),
        count("registration_forms", (q) => q.eq("published", true)),
        count("announcements", (q) => q.eq("published", true)),
        ...statuses.map((s) => count("registrations", (q) => q.eq("status", s))),
      ]);
      const { data: latest } = await supabase.from("registrations").select("id, full_name, protocol, status, created_at, registration_forms(title)").order("created_at", { ascending: false }).limit(8);
      return { total, users, activePolls, openForms, published, byStatus: statuses.map((s, i) => [s, byStatus[i]] as const), latest: latest ?? [] };
    },
  });
  const st = useLiveQueries("admin-overview", [
    { table: "registrations", keys: [["admin", "stats"]] },
    { table: "polls", keys: [["admin", "stats"]] },
    { table: "registration_forms", keys: [["admin", "stats"]] },
    { table: "announcements", keys: [["admin", "stats"]] },
  ]);
  const d = stats.data;
  return (
    <div>
      <div className="flex items-center justify-between"><h1 className="text-3xl font-extrabold">Visão geral</h1><LiveBadge status={st} /></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[["Inscrições", d?.total], ["Usuários (visíveis)", d?.users], ["Votações ativas", d?.activePolls], ["Formulários publicados", d?.openForms], ["Comunicados", d?.published]].map(([l, v]) => (
          <div key={l as string} data-motion="item" className="rounded-xl bg-card p-5 shadow-card"><div className="text-xs text-muted-foreground">{l}</div><div className="mt-1 font-display text-3xl font-extrabold">{v ?? "—"}</div></div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div data-motion="item" className="rounded-xl bg-card p-5 shadow-card">
          <h2 className="font-bold">Inscrições por status</h2>
          <div className="mt-4 space-y-3">
            {d?.byStatus.map(([s, n]) => (
              <div key={s}>
                <div className="flex justify-between text-sm"><span>{REG_STATUS[s]}</span><strong>{n}</strong></div>
                <div className="mt-1 h-2 rounded-full bg-muted"><div className="portal-result-bar h-full rounded-full bg-primary" style={{ width: `${d.total ? ((n ?? 0) / d.total) * 100 : 0}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div data-motion="item" className="rounded-xl bg-card p-5 shadow-card">
          <h2 className="font-bold">Últimas inscrições</h2>
          {!d?.latest.length ? <p className="mt-4 text-sm text-muted-foreground">Nenhuma inscrição recebida ainda.</p> : (
            <ul className="mt-3 divide-y divide-border text-sm">
              {d.latest.map((r) => (
                <li key={r.id} className="flex justify-between gap-3 py-2">
                  <span className="truncate"><strong>{r.protocol}</strong> · {r.full_name} <span className="text-muted-foreground">— {(r.registration_forms as { title: string } | null)?.title}</span></span>
                  <span className="shrink-0 text-muted-foreground">{fmtDate(r.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
