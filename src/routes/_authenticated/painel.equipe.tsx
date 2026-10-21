import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type Permission } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { errMsg } from "@/lib/format";
import { useLiveQueries } from "@/lib/realtime";
import { LiveBadge } from "@/components/site/Layout";

export const Route = createFileRoute("/_authenticated/painel/equipe")({ head: () => ({ meta: [{ title: "Equipe administrativa — Portal Norte Junino" }, { name: "description", content: "Gerencie vínculos e acessos da equipe." }, { property: "og:title", content: "Equipe administrativa — Portal Norte Junino" }, { property: "og:description", content: "Gerencie vínculos e acessos da equipe." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), component: Team });

const PERMS: [Permission, string][] = [["registrations", "Inscrições"], ["forms", "Formulários"], ["polls", "Votações"], ["announcements", "Comunicados e agenda"]];
const ROLES = [["coordenacao", "Coordenação"], ["operador", "Operador"]] as const;

export function Team() {
  const { isMaster } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const live = useLiveQueries("admin-team", [{table:"user_roles",keys:[["admin","team"]]},{table:"user_permissions",keys:[["admin","team"]]}],isMaster);
  const data = useQuery({
    queryKey: ["admin", "team", q],
    enabled: isMaster,
    queryFn: async () => {
      const s = q.trim().replace(/[%,()]/g, "");
      let pq = supabase.from("profiles").select("id, full_name, email, city, state").order("created_at", { ascending: false }).limit(30);
      if (s) pq = pq.or(`full_name.ilike.%${s}%,email.ilike.%${s}%`);
      const [p, r, pe] = await Promise.all([pq, supabase.from("user_roles").select("user_id, role"), supabase.from("user_permissions").select("user_id, permission")]);
      if (p.error) throw p.error; if (r.error) throw r.error; if (pe.error) throw pe.error;
      return { people: p.data ?? [], roles: r.data ?? [], perms: pe.data ?? [] };
    },
  });
  const toggle = useMutation({
    mutationFn: async (a: { kind: "role" | "perm"; user_id: string; value: string; on: boolean }) => {
      const t = a.kind === "role" ? "user_roles" : "user_permissions";
      const col = a.kind === "role" ? "role" : "permission";
      const { error } = a.on
        ? await supabase.from(t).insert({ user_id: a.user_id, [col]: a.value } as never)
        : await supabase.from(t).delete().eq("user_id", a.user_id).eq(col as never, a.value as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "team"] }),
    onError: (e) => toast.error(errMsg(e)),
  });
  if (!isMaster) return <p>Apenas o master pode gerenciar a equipe.</p>;

  return (
    <div>
      <div className="flex flex-wrap justify-between gap-3"><h1 className="text-3xl font-extrabold">Equipe e permissões</h1><LiveBadge status={live}/></div>
      <p className="mt-1 text-sm text-muted-foreground">Atribua um perfil administrativo e marque somente as áreas que cada pessoa pode gerenciar.</p>
      <Input className="mt-5 max-w-md" placeholder="Buscar por nome ou e-mail" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-5 space-y-3">
        {data.isPending ? <p>Carregando equipe…</p> : data.error ? <p role="alert">Não foi possível carregar a equipe.</p> : !data.data?.people.length ? <p>Nenhuma pessoa encontrada.</p> : null}
        {data.data?.people.map((p) => {
          const roles = data.data?.roles.filter((r) => r.user_id === p.id).map((r) => r.role) ?? [];
          const perms = data.data?.perms.filter((r) => r.user_id === p.id).map((r) => r.permission) ?? [];
          const master = roles.includes("master");
          const staff = roles.some((r) => r === "coordenacao" || r === "operador");
          return (
            <div key={p.id} className="rounded-xl bg-card p-4 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><div className="font-bold">{p.full_name || "—"} {master && <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">Master</span>}</div><div className="text-xs text-muted-foreground">{p.email} · {[p.city, p.state].filter(Boolean).join("/")}</div></div>
                {!master && (
                  <div className="flex gap-2">
                    {ROLES.map(([r, l]) => (
                      <Button key={r} size="sm" variant={roles.includes(r) ? "default" : "outline"} onClick={() => toggle.mutate({ kind: "role", user_id: p.id, value: r, on: !roles.includes(r) })}>{l}</Button>
                    ))}
                  </div>
                )}
              </div>
              {staff && !master && (
                <div className="mt-3 flex flex-wrap gap-5 border-t border-border pt-3 text-sm">
                  {PERMS.map(([k, l]) => (
                    <label key={k} className="flex items-center gap-2"><Switch checked={perms.includes(k)} onCheckedChange={(v) => toggle.mutate({ kind: "perm", user_id: p.id, value: k, on: v })} /> {l}</label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
