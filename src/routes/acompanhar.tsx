import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell, PageHeader, EmptyState, LiveBadge } from "@/components/site/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lookupRegistration, refreshTracking, type TrackingResult } from "@/lib/tracking.functions";
import { REG_STATUS, fmtDate, type RegStatus } from "@/lib/format";
import type { RtStatus } from "@/lib/realtime";
import { authorizeDossier } from "@/lib/dossier.functions";
import { DossierActions } from "@/components/site/DossierActions";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/acompanhar")({
  validateSearch: z.object({ protocolo: z.coerce.string().optional() }),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Acompanhar inscrição — Portal Norte Junino" },
      { name: "description", content: "Consulte o andamento da sua inscrição com o protocolo e o e-mail." },
      { property: "og:title", content: "Acompanhar inscrição — Portal Norte Junino" },
      { property: "og:description", content: "Veja o status da sua inscrição em tempo real." },
    ],
  }),
  component: Track,
});

const STEPS: RegStatus[] = ["recebida", "em_analise", "info_solicitada", "aprovada"];

function Track() {
  const { protocolo } = Route.useSearch();
  const lookup = useServerFn(lookupRegistration);
  const authorize=useServerFn(authorizeDossier);
  const {user}=useAuth();
  const [documentToken,setDocumentToken]=useState("");
  const [requestedProtocol,setRequestedProtocol]=useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<TrackingResult[] | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const protocol = String(fd.get("protocol")).trim();
    const email = String(fd.get("email")).trim();
    if (!/^\d{4}$/.test(protocol)) return void toast.error("O protocolo tem 4 dígitos.");
    setBusy(true);
    setDocumentToken("");setRequestedProtocol(protocol);
    try {
      if(!email){
        setResults(null);
        if(user){const a=await authorize({data:{protocol}});setDocumentToken(a.token);}
        return;
      }
      const r = await lookup({ data: { protocol, email } });
      if (r.error) toast.error(r.error);
      setResults(r.results);
    } catch(e) {
      toast.error(e instanceof Error?e.message:"Não foi possível consultar agora. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SiteShell>
      <PageHeader eyebrow="Acompanhamento" title="Acompanhe sua" highlight="inscrição.">
        Informe o protocolo de 4 dígitos da inscrição.
      </PageHeader>
      <section className="theme-light">
        <div className="mx-auto max-w-3xl px-5 py-12">
          <form onSubmit={onSubmit} className="grid gap-4 rounded-2xl bg-card p-6 shadow-card md:grid-cols-[150px_1fr_auto] md:items-end">
            <div className="space-y-1.5"><Label>Protocolo</Label><Input name="protocol" inputMode="numeric" maxLength={4} pattern="\d{4}" required defaultValue={protocolo ?? ""} className="text-center text-lg font-bold tracking-[0.3em]" /></div>
            <div className="space-y-1.5"><Label>E-mail (opcional para consultar o status)</Label><Input name="email" type="email" maxLength={255} /></div>
            <Button type="submit" disabled={busy} className="h-9"><Search /> {busy ? "Consultando…" : "Consultar"}</Button>
          </form>
          <div className="mt-8 space-y-6">
            {requestedProtocol&&!user&&<div className="border-b border-border pb-5"><p className="mb-3 text-sm">Para acessar o documento completo, entre com a conta do e-mail confirmado utilizado na inscrição.</p><Button asChild><Link to="/auth" search={{next:`/acompanhar?protocolo=${requestedProtocol}`}}>Entrar para acessar documento</Link></Button></div>}
            {documentToken&&<DossierActions token={documentToken}/>}
            {results && results.length === 0 && (
              <EmptyState title="Nenhuma inscrição encontrada" text="Confira o protocolo e o e-mail informados." />
            )}
            {results?.map((r) => <TrackingCard key={r.tracking_token} initial={r} />)}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

function TrackingCard({ initial }: { initial: TrackingResult }) {
  const authorize=useServerFn(authorizeDossier);const {user}=useAuth();const [documentToken,setDocumentToken]=useState("");const [busy,setBusy]=useState(false);
  async function access(){setBusy(true);try{const a=await authorize({data:{protocol:initial.protocol}});setDocumentToken(a.token);}catch(e){toast.error(e instanceof Error?e.message:"Não foi possível acessar o documento.");}finally{setBusy(false);}}
  const [r, setR] = useState(initial);
  const [rt, setRt] = useState<RtStatus>("connecting");
  const refresh = useServerFn(refreshTracking);

  useEffect(() => {
    let wasOff = false;
    const resync = () => refresh({ data: { token: initial.tracking_token } }).then((x) => x && setR(x)).catch(() => {});
    const ch = supabase
      .channel(`track-${initial.tracking_token}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "registration_live_status", filter: `tracking_token=eq.${initial.tracking_token}` }, resync)
      .subscribe((s) => {
        if (s === "SUBSCRIBED") { setRt("live"); if (wasOff) resync(); wasOff = false; }
        else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") { setRt("offline"); wasOff = true; }
      });
    return () => { supabase.removeChannel(ch); };
  }, [initial.tracking_token, refresh]);

  const st = r.status as RegStatus;
  const idx = st === "nao_aprovada" ? 3 : STEPS.indexOf(st);
  return (
    <div className="rounded-2xl bg-card p-6 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">Inscrito(a)</div>
          <h2 className="text-2xl font-extrabold">{r.full_name}</h2>
          <div className="mt-1 text-sm text-muted-foreground">{r.form_title}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Protocolo</div>
          <div className="font-display text-3xl font-extrabold tracking-[0.2em] text-primary">{r.protocol}</div>
          <LiveBadge status={rt} />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-4 gap-2">
        {STEPS.map((s, i) => {
          const label = i === 3 && st === "nao_aprovada" ? REG_STATUS.nao_aprovada : REG_STATUS[s];
          const active = i <= idx;
          const bad = i === 3 && st === "nao_aprovada";
          return (
            <div key={s}>
              <div className={`h-2 rounded-full ${active ? (bad ? "bg-destructive" : "bg-primary") : "bg-muted"}`} />
              <div className={`mt-2 text-xs font-semibold ${active ? "" : "text-muted-foreground"}`}>{label}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
        <div><span className="text-muted-foreground">Status atual</span><div className="font-bold">{REG_STATUS[st]}</div></div>
        <div><span className="text-muted-foreground">Recebida em</span><div className="font-bold">{fmtDate(r.created_at)}</div></div>
        <div><span className="text-muted-foreground">Última atualização</span><div className="font-bold">{fmtDate(r.updated_at)}</div></div>
      </div>
      {r.public_note && <div className="mt-5 rounded-lg bg-accent p-4 text-sm"><strong>Orientações:</strong> <span className="whitespace-pre-line">{r.public_note}</span></div>}
      {documentToken?<DossierActions token={documentToken}/>:user?<Button className="mt-5" variant="outline" disabled={busy} onClick={access}>{busy?"Verificando acesso…":"Acessar documento completo"}</Button>:<Button className="mt-5" asChild variant="outline"><Link to="/auth" search={{next:`/acompanhar?protocolo=${r.protocol}`}}>Entrar para acessar documento completo</Link></Button>}
    </div>
  );
}
