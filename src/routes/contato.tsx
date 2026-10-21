import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell, PageHeader } from "@/components/site/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/contato")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Contato — Portal Norte Junino" },
      { name: "description", content: "Fale com a equipe do Portal Norte Junino." },
      { property: "og:title", content: "Contato — Portal Norte Junino" },
      { property: "og:description", content: "Envie sua mensagem para a equipe." },
    ],
  }),
  component: Contact,
});

const schema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(100),
  email: z.string().trim().email("E-mail inválido.").max(255),
  message: z.string().trim().min(5, "Escreva sua mensagem.").max(2000),
});

function Contact() {
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const p = schema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!p.success) return void toast.error(p.error.issues[0]?.message);
    setBusy(true);
    const { error } = await supabase.from("contact_messages").insert({ name: p.data.name, email: p.data.email, message: p.data.message });
    setBusy(false);
    if (error) return void toast.error("Não foi possível enviar. Tente novamente.");
    setOk(true);
  }
  return (
    <SiteShell>
      <PageHeader eyebrow="Contato" title="Fale com a" highlight="equipe." />
      <section className="theme-light">
        <div className="mx-auto max-w-2xl px-5 py-12">
          {ok ? (
            <div className="rounded-2xl bg-card p-8 text-center shadow-card"><CheckCircle2 className="mx-auto size-10 text-primary" /><h2 className="mt-3 text-xl font-bold">Mensagem enviada!</h2><p className="text-sm text-muted-foreground">A equipe responderá pelo e-mail informado.</p></div>
          ) : (
            <form onSubmit={submit} className="space-y-4 rounded-2xl bg-card p-6 shadow-card">
              <div className="space-y-1.5"><Label>Nome</Label><Input name="name" required maxLength={100} /></div>
              <div className="space-y-1.5"><Label>E-mail</Label><Input name="email" type="email" required maxLength={255} /></div>
              <div className="space-y-1.5"><Label>Mensagem</Label><Textarea name="message" required maxLength={2000} rows={5} /></div>
              <Button type="submit" className="w-full" disabled={busy}>{busy ? "Enviando…" : "Enviar mensagem"}</Button>
            </form>
          )}
        </div>
      </section>
    </SiteShell>
  );
}
