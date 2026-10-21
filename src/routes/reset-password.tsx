import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { errMsg } from "@/lib/format";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/site/Layout";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Nova senha — Portal Norte Junino" },
      { name: "description", content: "Defina uma nova senha para sua conta." },
      { property: "og:title", content: "Nova senha — Portal Norte Junino" },
      { property: "og:description", content: "Defina uma nova senha para sua conta." },
    ],
  }),
  component: Reset,
});

function Reset() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const pw = String(new FormData(e.currentTarget).get("password"));
    if (pw.length < 8 || !/\d/.test(pw) || !/[A-Za-z]/.test(pw)) return void toast.error("Use ao menos 8 caracteres com letras e números.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return void toast.error(errMsg(error));
    toast.success("Senha atualizada.");
    navigate({ to: "/" });
  }
  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <form onSubmit={submit} className="w-full max-w-md space-y-5">
        <Logo />
        <h1 className="text-3xl font-extrabold">Criar nova senha</h1>
        <div className="space-y-1.5"><Label>Nova senha</Label><PasswordInput name="password" required autoComplete="new-password" /></div>
        <Button type="submit" className="h-11 w-full" disabled={busy}>Salvar</Button>
      </form>
    </div>
  );
}
