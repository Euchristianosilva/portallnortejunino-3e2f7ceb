import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, FileText, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell, EmptyState, Eyebrow } from "@/components/site/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DynamicField } from "@/components/site/DynamicField";
import { DossierActions } from "@/components/site/DossierActions";
import { opportunityQuery, opportunityOpen, candidacySession, fetchGate } from "@/lib/opportunities";
import { formQuery } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { fmtDate, errMsg, type FormField } from "@/lib/format";

export const Route = createFileRoute("/vagas/$id_/candidatura")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Formulário de candidatura — Portal Norte Junino" },
      { name: "description", content: "Formulário de candidatura vinculado à vaga, liberado após o aceite dos termos." },
      { property: "og:title", content: "Candidatura — Portal Norte Junino" },
      { property: "og:description", content: "Candidatura a vaga do movimento junino do Norte." },
    ],
  }),
  component: CandidacyPage,
});

function CandidacyPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const session = useMemo(() => candidacySession(id), [id]);
  const opp = useQuery(opportunityQuery(id));
  const formId = opp.data?.opportunity.form_id ?? "";
  const form = useQuery({ ...formQuery(formId), enabled: !!formId });
  const [gate, setGate] = useState<"checking" | "ok" | "blocked">("checking");
  const [done, setDone] = useState<{ protocol: string; email: string; token: string } | null>(null);

  // Validação real no servidor: sem os aceites registrados, o formulário não abre.
  useEffect(() => {
    let alive = true;
    fetchGate(id, session)
      .then((g) => { if (alive) setGate(g.ok ? "ok" : "blocked"); })
      .catch(() => { if (alive) setGate("blocked"); });
    return () => { alive = false; };
  }, [id, session]);

  const submit = useMutation({
    mutationFn: async (v: { full_name: string; email: string; answers: Record<string, string> }) => {
      const { data, error } = await supabase.rpc("submit_opportunity_registration", {
        _opportunity_id: id, _session: session, _full_name: v.full_name, _email: v.email, _answers: v.answers,
      });
      if (error) throw error;
      const row = data?.[0];
      if (!row?.protocol || !row.document_token) throw new Error("A confirmação não foi recuperada. Consulte o acompanhamento antes de reenviar.");
      return { protocol: row.protocol, email: v.email, token: row.document_token };
    },
    onSuccess: (r) => setDone(r),
    onError: (e) => toast.error(errMsg(e)),
  });

  if (opp.isLoading || gate === "checking" || (formId && form.isLoading))
    return <SiteShell><div className="mx-auto max-w-3xl px-5 py-20"><div className="h-96 animate-pulse rounded-xl bg-muted" /></div></SiteShell>;

  if (!opp.data) return <SiteShell><div className="mx-auto max-w-3xl px-5 py-20"><EmptyState title="Vaga não encontrada" /></div></SiteShell>;
  const o = opp.data.opportunity;

  if (gate === "blocked")
    return (
      <SiteShell>
        <div className="mx-auto max-w-xl px-5 py-20">
          <EmptyState
            icon={<ShieldAlert />}
            title="Etapa de termos pendente"
            text="Para acessar o formulário desta vaga é preciso antes ler e registrar sua decisão em cada termo obrigatório."
          />
          <div className="mt-6 text-center">
            <Button asChild variant="hero"><Link to="/vagas/$id/termos" params={{ id }}>Ir para os termos da vaga</Link></Button>
          </div>
        </div>
      </SiteShell>
    );

  if (!opportunityOpen(o))
    return (
      <SiteShell>
        <div className="mx-auto max-w-xl px-5 py-20">
          <EmptyState title="Candidaturas indisponíveis" text="Esta vaga não está recebendo candidaturas no momento. Nenhuma candidatura foi criada." />
          <div className="mt-6 text-center"><Button asChild variant="outline"><Link to="/vagas/$id" params={{ id }}>Voltar aos detalhes da vaga</Link></Button></div>
        </div>
      </SiteShell>
    );

  const f = form.data;
  if (!f || !f.published) return <SiteShell><div className="mx-auto max-w-3xl px-5 py-20"><EmptyState title="Formulário indisponível" text="Esta vaga não possui um formulário de inscrição disponível no momento." /></div></SiteShell>;
  const fields = (f.fields as unknown as FormField[]) ?? [];

  // Formulários que exigem conta: orienta o login antes do preenchimento,
  // em vez de deixar a pessoa preencher tudo e falhar no envio.
  if (f.require_login && !user)
    return (
      <SiteShell>
        <div className="mx-auto max-w-xl px-5 py-20">
          <EmptyState icon={<ShieldAlert />} title="Entre na sua conta para continuar" text="Esta vaga exige uma conta no portal. Seus aceites dos termos continuam registrados nesta sessão." />
          <div className="mt-6 text-center">
            <Button asChild variant="hero"><Link to="/auth" search={{ next: `/vagas/${id}/candidatura` }}>Entrar ou criar conta</Link></Button>
          </div>
        </div>
      </SiteShell>
    );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (fd.has("upload_pending")) return void toast.error("Aguarde o envio dos arquivos.");
    const answers: Record<string, string> = {};
    for (const fl of fields) {
      const v = fl.type === "multiselect" ? JSON.stringify(fd.getAll(`f_${fl.key}`)) : String(fd.get(`f_${fl.key}`) ?? "").trim();
      if (fl.required && (!v || v === "[]")) return void toast.error(`Preencha: ${fl.label}`);
      if (v.length > 5000) return void toast.error(`Resposta muito longa: ${fl.label}`);
      answers[fl.key] = v;
    }
    const full_name = String(fd.get("full_name") ?? "").trim();
    const email = String(fd.get("email") ?? "").trim();
    if (full_name.length < 3) return void toast.error("Informe o nome completo.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return void toast.error("E-mail inválido.");
    submit.mutate({ full_name, email, answers });
  }

  return (
    <SiteShell>
      <section className="bg-hero border-b border-border">
        <div className="mx-auto max-w-3xl px-5 py-12">
          <Eyebrow>Candidatura — {o.category || "Vaga"}</Eyebrow>
          <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">{o.title}</h1>
          {o.description && <p className="mt-3 line-clamp-3 text-sm text-foreground/80">{o.description}</p>}
          <p className="mt-3 text-sm text-foreground/70">Esta candidatura refere-se especificamente a esta vaga e fica vinculada a ela.</p>
          <Link to="/vagas/$id/termos" params={{ id }} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            <FileText className="size-4" /> Consultar novamente os termos aceitos
          </Link>
        </div>
      </section>
      <section className="theme-light">
        <div className="mx-auto max-w-3xl px-5 py-12">
          {done ? (
            <div className="rounded-2xl bg-card p-8 text-center shadow-card">
              <CheckCircle2 className="mx-auto size-12 text-primary" />
              <h2 className="mt-4 text-2xl font-extrabold">Candidatura recebida!</h2>
              <p className="mt-2 text-muted-foreground">Guarde seu protocolo. Você vai precisar dele e do e-mail <strong>{done.email}</strong> para acompanhar.</p>
              <div className="mx-auto mt-6 inline-block rounded-xl border-2 border-primary px-8 py-4 font-display text-5xl font-extrabold tracking-[0.3em] text-primary">{done.protocol}</div>
              <div className="mt-6"><Button asChild><Link to="/acompanhar" search={{ protocolo: done.protocol }}>Acompanhar inscrição</Link></Button></div>
              <DossierActions token={done.token} />
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5 rounded-2xl bg-card p-6 shadow-card md:p-8">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-1.5"><Label>Nome completo *</Label><Input name="full_name" required maxLength={150} defaultValue={(user?.user_metadata?.["full_name"] as string) ?? ""} /></div>
                <div className="space-y-1.5"><Label>E-mail *</Label><Input name="email" type="email" required maxLength={255} defaultValue={user?.email ?? ""} /></div>
              </div>
              {fields.map((fl) => <DynamicField key={fl.key} field={fl} />)}
              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={submit.isPending}>
                {submit.isPending ? "Enviando…" : "Enviar candidatura"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">A confirmação e o protocolo só aparecem depois que a gravação for confirmada pelo sistema.</p>
            </form>
          )}
        </div>
      </section>
    </SiteShell>
  );
}
