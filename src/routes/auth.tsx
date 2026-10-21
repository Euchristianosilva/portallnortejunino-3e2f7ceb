import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/site/Layout";
import { useAuth } from "@/lib/auth";
import { UFS, errMsg } from "@/lib/format";
import hero from "@/assets/hero.jpg";

const search = z.object({ mode: z.enum(["signin", "signup", "forgot"]).optional(), next: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: search,
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Entrar ou criar conta — Portal Norte Junino" },
      { name: "description", content: "Acesse sua conta no Portal Norte Junino para votar e se inscrever." },
      { property: "og:title", content: "Entrar — Portal Norte Junino" },
      { property: "og:description", content: "Acesse ou crie sua conta no Portal Norte Junino." },
    ],
  }),
  component: AuthPage,
});

const signupSchema = z.object({
  full_name: z.string().trim().min(3, "Informe o nome completo.").max(150),
  email: z.string().trim().email("E-mail inválido.").max(255),
  password: z.string().min(8, "A senha deve ter ao menos 8 caracteres.").regex(/[A-Za-z]/, "Inclua letras.").regex(/\d/, "Inclua números."),
  city: z.string().trim().min(2, "Informe a cidade.").max(100),
  state: z.string().length(2, "Selecione o estado."),
});

function safeNext(n?: string) {
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/";
}

function AuthPage() {
  const { mode = "signin", next } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    if (user) navigate({ to: safeNext(next), replace: true });
  }, [user, next, navigate]);

  async function google() {
    if (next) sessionStorage.setItem("pnj_next", safeNext(next));
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error("Não foi possível entrar com o Google.");
  }

  async function onSignin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: String(fd.get("email")).trim(), password: String(fd.get("password")) });
    setBusy(false);
    if (error) toast.error(error.message.includes("Invalid") ? "E-mail ou senha incorretos." : error.message.includes("confirm") ? "Confirme seu e-mail antes de entrar." : errMsg(error));
  }

  async function onSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = signupSchema.safeParse(fd);
    if (!parsed.success) return void toast.error(parsed.error.issues[0]?.message);
    setBusy(true);
    const { full_name, email, password, city, state } = parsed.data;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin, data: { full_name, city, state } },
    });
    setBusy(false);
    if (error) return void toast.error(error.message.includes("registered") ? "Este e-mail já está cadastrado. Faça login." : errMsg(error));
    if (data.user && data.user.identities?.length === 0) return void toast.error("Este e-mail já está cadastrado. Faça login.");
    setSent(email);
  }

  async function onForgot(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email")).trim();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false);
    if (error) return void toast.error(errMsg(error));
    setSent(email);
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden lg:block">
        <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 fade-bottom" />
        <div className="absolute bottom-12 left-12 right-12">
          <h2 className="text-4xl font-extrabold">O movimento junino também é feito <span className="text-highlight">de pessoas.</span></h2>
        </div>
      </div>
      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <Logo />
          {sent ? (
            <div data-motion="state" className="mt-10 rounded-xl border border-border bg-card p-6">
              <h1 className="text-2xl font-bold">Verifique seu e-mail</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Enviamos um link para <strong>{sent}</strong>. {mode === "forgot" ? "Use-o para criar uma nova senha." : "Confirme seu cadastro para entrar."}
              </p>
              <Button className="mt-6" variant="outline" onClick={() => { setSent(null); navigate({ to: "/auth", search: { mode: "signin", next } }); }}>Voltar ao login</Button>
            </div>
          ) : (
            <>
              <h1 className="mt-10 text-3xl font-extrabold">
                {mode === "signup" ? "Criar conta" : mode === "forgot" ? "Recuperar senha" : "Entrar"}
              </h1>
              {mode !== "forgot" && (
                <>
                  <Button type="button" variant="outline" className="mt-6 h-11 w-full" onClick={google}>
                    <svg viewBox="0 0 24 24" className="size-4"><path fill="currentColor" d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.57-2.47C16.7 3.72 14.56 2.8 12 2.8 6.92 2.8 2.8 6.92 2.8 12s4.12 9.2 9.2 9.2c5.31 0 8.83-3.73 8.83-8.99 0-.6-.06-1.06-.14-1.51z" /></svg>
                    Continuar com Google
                  </Button>
                  <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><div className="h-px flex-1 bg-border" />ou<div className="h-px flex-1 bg-border" /></div>
                </>
              )}
              {mode === "signin" && (
                <form onSubmit={onSignin} className="portal-form-state space-y-4">
                  <Field label="E-mail"><Input name="email" type="email" required autoComplete="email" /></Field>
                  <Field label="Senha"><PasswordInput name="password" required autoComplete="current-password" /></Field>
                  <Button type="submit" className="h-11 w-full" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</Button>
                  <div className="flex justify-between text-sm">
                    <Link to="/auth" search={{ mode: "forgot", next }} className="text-primary-glow">Esqueci minha senha</Link>
                    <Link to="/auth" search={{ mode: "signup", next }} className="text-primary-glow">Criar conta</Link>
                  </div>
                </form>
              )}
              {mode === "signup" && (
                <form onSubmit={onSignup} className="portal-form-state space-y-4">
                  <Field label="Nome completo"><Input name="full_name" required maxLength={150} /></Field>
                  <Field label="E-mail"><Input name="email" type="email" required maxLength={255} /></Field>
                  <Field label="Senha (mín. 8 caracteres, letras e números)"><PasswordInput name="password" required autoComplete="new-password" /></Field>
                  <div className="grid grid-cols-[1fr_110px] gap-3">
                    <Field label="Cidade"><Input name="city" required maxLength={100} /></Field>
                    <Field label="Estado">
                      <select name="state" required defaultValue="" className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm">
                        <option value="" disabled>UF</option>
                        {UFS.map((u) => <option key={u} value={u} className="bg-popover">{u}</option>)}
                      </select>
                    </Field>
                  </div>
                  <Button type="submit" className="h-11 w-full" disabled={busy}>{busy ? "Criando…" : "Criar conta"}</Button>
                  <p className="text-center text-sm">Já tem conta? <Link to="/auth" search={{ mode: "signin", next }} className="text-primary-glow">Entrar</Link></p>
                </form>
              )}
              {mode === "forgot" && (
                <form onSubmit={onForgot} className="portal-form-state mt-6 space-y-4">
                  <Field label="E-mail"><Input name="email" type="email" required /></Field>
                  <Button type="submit" className="h-11 w-full" disabled={busy}>Enviar link</Button>
                  <Link to="/auth" search={{ mode: "signin", next }} className="block text-center text-sm text-primary-glow">Voltar</Link>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
