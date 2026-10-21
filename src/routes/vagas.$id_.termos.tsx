import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, ChevronDown, FileText, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell, EmptyState, Eyebrow } from "@/components/site/Layout";
import { Button } from "@/components/ui/button";
import { opportunityQuery, opportunityOpen, candidacySession, type OpportunityDoc } from "@/lib/opportunities";
import { fmtDate, errMsg } from "@/lib/format";

export const Route = createFileRoute("/vagas/$id_/termos")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Leia e aceite os termos da vaga — Portal Norte Junino" },
      { name: "description", content: "Leia integralmente cada documento e registre seu aceite antes de acessar o formulário." },
      { property: "og:title", content: "Termos da vaga — Portal Norte Junino" },
      { property: "og:description", content: "Etapa obrigatória de leitura e aceite dos termos." },
    ],
  }),
  component: TermsPage,
});

function DocSection({ doc, open, onToggle, children }: { doc: OpportunityDoc; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-card shadow-card">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center justify-between gap-3 p-5 text-left">
        <span className="flex items-center gap-3">
          <FileText className="size-5 shrink-0 text-primary" />
          <span>
            <span className="block font-bold">{doc.title}</span>
            <span className="block text-xs text-muted-foreground">Versão {doc.version} · Publicação/vigência: {fmtDate(doc.published_at)}</span>
          </span>
        </span>
        <ChevronDown className={`size-5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="max-h-96 overflow-y-auto whitespace-pre-wrap break-words border-t border-border p-5 text-sm leading-6">{doc.body}</div>}
      <div className="border-t border-border p-5">{children}</div>
    </section>
  );
}

function TermsPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery(opportunityQuery(id));
  const session = useMemo(() => candidacySession(id), [id]);
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [imageChoice, setImageChoice] = useState<Record<string, "authorized" | "refused" | null>>({});
  const [refusedRequired, setRefusedRequired] = useState(false);

  const docs = data?.documents ?? [];
  const requiredDocs = docs.filter((d) => d.required && !d.image_choice);
  const imageDocs = docs.filter((d) => d.image_choice);
  const allAccepted = requiredDocs.every((d) => accepted[d.version_id]) && imageDocs.every((d) => imageChoice[d.version_id]);

  const record = useMutation({
    mutationFn: async (events: { version_id: string; event: "viewed" | "accepted" | "refused" }[]) => {
      if (events.length === 0) return;
      const { error } = await supabase.rpc("record_consent", { _opportunity_id: id, _session: session, _events: events });
      if (error) throw error;
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  // Registra a disponibilização (visualização) de cada documento ao abrir
  useEffect(() => {
    const pending = docs.filter((d) => opened[d.version_id] && !sessionStorage.getItem(`pnj-viewed-${d.version_id}`));
    if (pending.length === 0) return;
    pending.forEach((d) => sessionStorage.setItem(`pnj-viewed-${d.version_id}`, "1"));
    record.mutate(pending.map((d) => ({ version_id: d.version_id, event: "viewed" as const })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  if (isLoading) return <SiteShell><div className="mx-auto max-w-3xl px-5 py-20"><div className="h-96 animate-pulse rounded-xl bg-muted" /></div></SiteShell>;
  if (!data) return <SiteShell><div className="mx-auto max-w-3xl px-5 py-20"><EmptyState title="Vaga não encontrada" /></div></SiteShell>;
  const o = data.opportunity;

  if (!opportunityOpen(o))
    return (
      <SiteShell>
        <div className="mx-auto max-w-3xl px-5 py-20">
          <EmptyState title="Candidaturas indisponíveis" text="Esta vaga não está recebendo candidaturas no momento." />
          <div className="mt-6 text-center"><Button asChild variant="outline"><Link to="/vagas/$id" params={{ id }}>Voltar aos detalhes da vaga</Link></Button></div>
        </div>
      </SiteShell>
    );

  function toggleAccept(doc: OpportunityDoc, value: boolean) {
    setAccepted((p) => ({ ...p, [doc.version_id]: value }));
    record.mutate([{ version_id: doc.version_id, event: value ? "accepted" : "refused" }]);
  }

  function chooseImage(doc: OpportunityDoc, choice: "authorized" | "refused") {
    setImageChoice((p) => ({ ...p, [doc.version_id]: choice }));
    record.mutate([{ version_id: doc.version_id, event: choice === "authorized" ? "accepted" : "refused" }]);
    if (choice === "refused" && doc.required) setRefusedRequired(true); else setRefusedRequired(false);
  }

  async function proceed() {
    if (!allAccepted) return;
    navigate({ to: "/vagas/$id/candidatura", params: { id } });
  }

  return (
    <SiteShell>
      <section className="bg-hero border-b border-border">
        <div className="mx-auto max-w-3xl px-5 py-12">
          <Eyebrow>Etapa obrigatória</Eyebrow>
          <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">Leia e aceite os termos da vaga</h1>
          <p className="mt-3 text-foreground/80"><strong>{o.title}</strong>{o.category ? ` · ${o.category}` : ""}</p>
          <p className="mt-3 text-sm text-foreground/70">
            Abra cada documento, leia o texto integral e registre sua decisão em cada item. O sistema registra que o texto foi
            disponibilizado e a declaração que você fizer — ele não comprova leitura ou compreensão.
          </p>
        </div>
      </section>
      <section className="theme-light">
        <div className="mx-auto max-w-3xl space-y-5 px-5 py-12">
          {requiredDocs.map((d) => (
            <DocSection key={d.link_id} doc={d} open={!!opened[d.version_id]} onToggle={() => setOpened((p) => ({ ...p, [d.version_id]: !p[d.version_id] }))}>
              <label className="flex items-start gap-3 text-sm font-semibold">
                <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-primary" checked={!!accepted[d.version_id]} onChange={(e) => toggleAccept(d, e.target.checked)} />
                Li e concordo com este documento: {d.title}.
              </label>
            </DocSection>
          ))}
          {imageDocs.map((d) => (
            <DocSection key={d.link_id} doc={d} open={!!opened[d.version_id]} onToggle={() => setOpened((p) => ({ ...p, [d.version_id]: !p[d.version_id] }))}>
              <div className="space-y-3" role="radiogroup" aria-label={`Decisão sobre ${d.title}`}>
                <label className="flex items-start gap-3 text-sm font-semibold">
                  <input type="radio" name={`img_${d.version_id}`} className="mt-0.5 size-5 shrink-0 accent-primary" checked={imageChoice[d.version_id] === "authorized"} onChange={() => chooseImage(d, "authorized")} />
                  Autorizo o uso da minha imagem, voz e nome nos limites descritos no termo.
                </label>
                <label className="flex items-start gap-3 text-sm font-semibold">
                  <input type="radio" name={`img_${d.version_id}`} className="mt-0.5 size-5 shrink-0 accent-primary" checked={imageChoice[d.version_id] === "refused"} onChange={() => chooseImage(d, "refused")} />
                  Não autorizo o uso da minha imagem, voz e nome.
                </label>
                <p className="text-xs text-muted-foreground">A escolha sobre imagem é independente dos demais termos e fica registrada separadamente.</p>
              </div>
            </DocSection>
          ))}
          {docs.filter((d) => !d.required && !d.image_choice).map((d) => (
            <DocSection key={d.link_id} doc={d} open={!!opened[d.version_id]} onToggle={() => setOpened((p) => ({ ...p, [d.version_id]: !p[d.version_id] }))}>
              <p className="text-sm text-muted-foreground">Documento informativo — não exige aceite.</p>
            </DocSection>
          ))}

          {refusedRequired && (
            <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-5 text-sm">
              Você não autorizou um termo obrigatório para esta modalidade de candidatura. Nas condições atuais não será possível prosseguir.
              Sua recusa foi registrada e não será convertida em aceite. Você pode voltar aos detalhes da vaga.
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="outline" size="lg" className="flex-1"><Link to="/vagas/$id" params={{ id }}><ArrowLeft className="size-4" /> Voltar aos detalhes</Link></Button>
            <Button size="lg" variant="hero" className="flex-1" disabled={!allAccepted || refusedRequired || record.isPending} onClick={proceed}>
              <ShieldCheck className="size-4" /> Continuar para o formulário <ArrowRight className="size-4" />
            </Button>
          </div>
          {!allAccepted && <p className="text-center text-xs text-muted-foreground">O botão será liberado quando todos os termos obrigatórios tiverem sua decisão registrada.</p>}
        </div>
      </section>
    </SiteShell>
  );
}
