import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell, EmptyState, Eyebrow } from "@/components/site/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DynamicField } from "@/components/site/DynamicField";
import { DossierActions } from "@/components/site/DossierActions";
import type { LegalDocument } from "@/lib/dossier";
import { StoredImage } from "@/components/site/StoredImage";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formQuery } from "@/lib/queries";
import { useLiveQueries } from "@/lib/realtime";
import { useAuth } from "@/lib/auth";
import { formIsOpen, fmtDate, errMsg, type FormField } from "@/lib/format";

export const Route = createFileRoute("/inscricoes/$id")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Formulário de inscrição — Portal Norte Junino" },
      { name: "description", content: "Preencha o formulário e receba seu protocolo de acompanhamento." },
      { property: "og:title", content: "Inscrição — Portal Norte Junino" },
      { property: "og:description", content: "Inscreva-se nesta oportunidade do movimento junino." },
    ],
  }),
  component: FormPage,
});

function FormPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const form = useQuery(formQuery(id));
  useLiveQueries(`form-${id}`, [{ table: "registration_forms", filter: `id=eq.${id}`, keys: [["form", id]] }]);
  const [done, setDone] = useState<{ protocol: string; email: string; token: string } | null>(null);

  const submit = useMutation({
    mutationFn: async (v: { full_name: string; email: string; answers: Record<string, string> }) => {
      const { data, error } = await supabase.rpc("submit_registration_with_dossier", { _form_id: id, _full_name: v.full_name, _email: v.email, _answers: v.answers });
      if (error) throw error;
      const row=data?.[0];
      if(!row?.protocol||!row.document_token)throw new Error("A confirmação não foi recuperada. Consulte o acompanhamento antes de reenviar.");
      return { protocol: row.protocol, email: v.email, token: row.document_token };
    },
    onSuccess: (r) => setDone(r),
    onError: (e) => toast.error(errMsg(e)),
  });

  if (form.isLoading) return <SiteShell><div className="mx-auto max-w-3xl px-5 py-20"><div className="h-64 animate-pulse rounded-xl bg-muted" /></div></SiteShell>;
  const f = form.data;
  if (!f) return <SiteShell><div className="mx-auto max-w-3xl px-5 py-20"><EmptyState title="Inscrição não encontrada" /></div></SiteShell>;
  const fields = (f.fields as unknown as FormField[]) ?? [];
  const documents = (f.legal_documents as unknown as LegalDocument[]) ?? [];
  const open = formIsOpen(f);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (fd.has("upload_pending")) return void toast.error("Aguarde o envio dos arquivos.");
    const answers: Record<string, string> = {};
    for(const doc of documents){answers[`consent_${doc.id}`]=fd.get(`consent_${doc.id}`)==="true"?"true":"false";answers[`consent_document_${doc.id}`]=JSON.stringify(doc);}
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
        <div className="mx-auto max-w-3xl px-5 py-14">
          <Eyebrow>{f.category || "Inscrição"}</Eyebrow>
          <h1 className="mt-4 text-4xl font-extrabold">{f.title}</h1>
          {f.image_url && <StoredImage src={f.image_url} alt={f.title} className="mt-5 max-h-72 w-full rounded-lg object-contain" />}
          <p className="mt-4 whitespace-pre-line text-foreground/85">{f.description}</p>
          <p className="mt-4 text-sm text-foreground/70">Período: {fmtDate(f.opens_at)} — {fmtDate(f.closes_at)}</p>
        </div>
      </section>
      <section className="theme-light">
        <div className="mx-auto max-w-3xl px-5 py-12">
          {done ? (
            <div className="rounded-2xl bg-card p-8 text-center shadow-card">
              <CheckCircle2 className="mx-auto size-12 text-primary" />
              <h2 className="mt-4 text-2xl font-extrabold">Inscrição recebida!</h2>
              <p className="mt-2 text-muted-foreground">Guarde seu protocolo. Você vai precisar dele e do e-mail <strong>{done.email}</strong> para acompanhar.</p>
              <div className="mx-auto mt-6 inline-block rounded-xl border-2 border-primary px-8 py-4 font-display text-5xl font-extrabold tracking-[0.3em] text-primary">{done.protocol}</div>
              <div className="mt-6"><Button asChild><Link to="/acompanhar" search={{ protocolo: done.protocol }}>Acompanhar inscrição</Link></Button></div>
              <DossierActions token={done.token}/>
            </div>
          ) : !open ? (
            <EmptyState title="Inscrições indisponíveis" text={f.opens_at && new Date(f.opens_at) > new Date() ? `Abrem em ${fmtDate(f.opens_at)}.` : "O período de inscrições está encerrado."} />
          ) : f.require_login && !user ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card p-6 shadow-card">
              <span className="flex items-center gap-2"><Lock className="size-4 text-primary" /> Esta inscrição exige login.</span>
              <Button asChild><Link to="/auth" search={{ next: `/inscricoes/${id}` }}>Entrar</Link></Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5 rounded-2xl bg-card p-6 shadow-card md:p-8">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-1.5"><Label>Nome completo *</Label><Input name="full_name" required maxLength={150} defaultValue={(user?.user_metadata?.["full_name"] as string) ?? ""} /></div>
                <div className="space-y-1.5"><Label>E-mail *</Label><Input name="email" type="email" required maxLength={255} defaultValue={user?.email ?? ""} /></div>
              </div>
              {fields.map((fl) => <DynamicField key={fl.key} field={fl} />)}
              {documents.map(doc=><section key={doc.id} className="border-t border-border pt-5"><h2 className="font-bold">{doc.title}</h2><p className="mt-1 text-xs text-muted-foreground">Versão {doc.version} · Publicação/vigência: {fmtDate(doc.published_at)}</p><div className="my-4 whitespace-pre-wrap break-words text-sm leading-6">{doc.content}</div><label className="flex items-start gap-3 text-sm"><input name={`consent_${doc.id}`} type="checkbox" value="true" required={doc.required} className="mt-1 size-5 shrink-0 accent-primary"/>Concordo expressamente com este documento{doc.required?" *":" (opcional)"}.</label></section>)}
              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={submit.isPending}>
                {submit.isPending ? "Enviando…" : "Enviar inscrição"}
              </Button>
            </form>
          )}
        </div>
      </section>
    </SiteShell>
  );
}
