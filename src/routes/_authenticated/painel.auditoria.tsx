import { createFileRoute } from "@tanstack/react-router";
import { useQuery, keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLiveQueries } from "@/lib/realtime";
import { LiveBadge } from "@/components/site/Layout";
import { Button } from "@/components/ui/button";
import { fmtDate, errMsg } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/painel/auditoria")({ head: () => ({ meta: [{ title: "Auditoria administrativa — Portal Norte Junino" }, { name: "description", content: "Consulte registros de operações administrativas." }, { property: "og:title", content: "Auditoria administrativa — Portal Norte Junino" }, { property: "og:description", content: "Consulte registros de operações administrativas." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), component: Audit });

const PAGE = 30;
const AREAS: Record<string,string> = {registrations:"Inscrições",registration_forms:"Formulários",polls:"Votações",poll_options:"Opções de votação",announcements:"Comunicados",events:"Agenda",user_roles:"Equipe",user_permissions:"Permissões",offboarding_requests:"Desligamentos",offboarding_settings:"Formulário de desligamento",reports:"Relatórios"};
const ACTIONS: Record<string,string> = {insert:"Criação",update:"Alteração",delete:"Exclusão",status_change:"Alteração de status",invite_created:"Link gerado",request_received:"Solicitação recebida",report_viewed:"Relatório consultado"};

function Audit() {
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [entity, setEntity] = useState("");
  const log = useQuery({
    queryKey: ["admin", "audit", page, entity],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = supabase.from("audit_log").select("*", { count: "exact" }).order("created_at", { ascending: false });
      if (entity) q = q.eq("entity", entity);
      const { data, count } = await q.range(page * PAGE, page * PAGE + PAGE - 1);
      const ids = [...new Set((data ?? []).map((d) => d.actor_id).filter(Boolean))] as string[];
      const { data: people } = ids.length ? await supabase.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] };
      const names = new Map((people ?? []).map((p) => [p.id, p.full_name || p.email]));
      return { rows: (data ?? []).map((r) => ({ ...r, actor: r.actor_id ? names.get(r.actor_id) ?? r.actor_id.slice(0, 8) : "sistema" })), count: count ?? 0 };
    },
  });
  const msgs = useQuery({ queryKey: ["admin", "msgs"], queryFn: async () => (await supabase.from("contact_messages").select("*").order("created_at", { ascending: false }).limit(50)).data ?? [] });
  const st = useLiveQueries("admin-audit", [{ table: "audit_log", keys: [["admin", "audit"]] }, {table:"contact_messages",keys:[["admin","msgs"]]}]);
  const pages = Math.max(1, Math.ceil((log.data?.count ?? 0) / PAGE));

  async function markHandled(id: string) {
    const r = await supabase.from("contact_messages").update({ handled: true }).eq("id", id);
    if(r.error) { toast.error(errMsg(r.error)); return; }
    qc.invalidateQueries({ queryKey: ["admin", "msgs"] });
  }

  return (
    <div className="space-y-10">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-extrabold">Auditoria</h1>
          <div className="flex items-center gap-3">
            <select className="h-9 rounded-md border border-input bg-card px-2 text-sm" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(0); }}>
              <option value="">Todas as áreas</option>
              {Object.entries(AREAS).map(([x,label]) => <option key={x} value={x}>{label}</option>)}
            </select>
            <LiveBadge status={st} />
          </div>
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground"><tr><th className="p-3">Quando</th><th className="p-3">Quem</th><th className="p-3">Ação</th><th className="p-3">Área</th><th className="p-3">Registro</th></tr></thead>
            <tbody>
              {!log.data?.rows.length ? <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Sem registros.</td></tr> : log.data.rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="p-3 text-muted-foreground">{fmtDate(r.created_at)}</td><td className="p-3">{r.actor}</td><td className="p-3 font-semibold">{ACTIONS[r.action] ?? "Operação administrativa"}</td><td className="p-3">{AREAS[r.entity] ?? "Sistema"}</td><td className="p-3 font-mono text-xs">{r.entity_id?.slice(0, 8)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex justify-end gap-2 text-sm">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
          <span className="self-center">{page + 1}/{pages}</span>
          <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Próxima</Button>
        </div>
      </div>
      <div>
        <h2 className="text-2xl font-extrabold">Mensagens de contato</h2>
        <div className="mt-4 space-y-3">
          {!msgs.data?.length ? <p className="text-sm text-muted-foreground">Nenhuma mensagem.</p> : msgs.data.map((m) => (
            <div key={m.id} className={`rounded-xl bg-card p-4 shadow-card ${m.handled ? "opacity-60" : ""}`}>
              <div className="flex justify-between gap-3 text-sm"><strong>{m.name} · <a className="text-primary" href={`mailto:${m.email}`}>{m.email}</a></strong><span className="text-muted-foreground">{fmtDate(m.created_at)}</span></div>
              <p className="mt-2 whitespace-pre-line text-sm">{m.message}</p>
              {!m.handled && <Button size="sm" variant="outline" className="mt-2" onClick={() => markHandled(m.id)}>Marcar como respondida</Button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
