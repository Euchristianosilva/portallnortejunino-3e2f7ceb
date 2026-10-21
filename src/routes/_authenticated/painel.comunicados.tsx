import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLiveQueries } from "@/lib/realtime";
import { useAuth } from "@/lib/auth";
import { LiveBadge } from "@/components/site/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtDate, errMsg } from "@/lib/format";
import { guardedUpdate, toLocalInput, fromLocalInput } from "@/lib/admin";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/painel/comunicados")({ head: () => ({ meta: [{ title: "Comunicados administrativos — Portal Norte Junino" }, { name: "description", content: "Crie comunicados e eventos oficiais." }, { property: "og:title", content: "Comunicados administrativos — Portal Norte Junino" }, { property: "og:description", content: "Crie comunicados e eventos oficiais." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), component: Page });

type Ann = Tables<"announcements">;
type Ev = Tables<"events">;

function Page() {
  const qc = useQueryClient();
  const [ann, setAnn] = useState<Ann | "new" | null>(null);
  const [ev, setEv] = useState<Ev | "new" | null>(null);
  const a = useQuery({ queryKey: ["admin", "ann"], queryFn: async () => (await supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(100)).data ?? [] });
  const e = useQuery({ queryKey: ["admin", "events"], queryFn: async () => (await supabase.from("events").select("*").order("starts_at", { ascending: false }).limit(100)).data ?? [] });
  const st = useLiveQueries("admin-ann", [{ table: "announcements", keys: [["admin", "ann"]] }, { table: "events", keys: [["admin", "events"]] }]);
  const done = () => { qc.invalidateQueries({ queryKey: ["admin"] }); setAnn(null); setEv(null); };

  return (
    <div className="space-y-10">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-extrabold">Comunicados</h1>
          <div className="flex items-center gap-3"><LiveBadge status={st} /><Button onClick={() => setAnn("new")}><Plus /> Novo comunicado</Button></div>
        </div>
        <div className="mt-4 grid gap-3">
          {!a.data?.length ? <p className="text-sm text-muted-foreground">Nenhum comunicado.</p> : a.data.map((x) => (
            <button key={x.id} onClick={() => setAnn(x)} className="flex justify-between gap-3 rounded-xl bg-card p-4 text-left shadow-card">
              <span className="font-semibold">{x.title}</span>
              <span className="text-xs text-muted-foreground">{x.published ? `Publicado ${fmtDate(x.published_at)}` : "Rascunho"}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between"><h2 className="text-2xl font-extrabold">Agenda</h2><Button onClick={() => setEv("new")}><Plus /> Novo evento</Button></div>
        <div className="mt-4 grid gap-3">
          {!e.data?.length ? <p className="text-sm text-muted-foreground">Nenhum evento.</p> : e.data.map((x) => (
            <button key={x.id} onClick={() => setEv(x)} className="flex justify-between gap-3 rounded-xl bg-card p-4 text-left shadow-card">
              <span className="font-semibold">{x.title}</span>
              <span className="text-xs text-muted-foreground">{fmtDate(x.starts_at)} · {x.published ? "Publicado" : "Rascunho"}</span>
            </button>
          ))}
        </div>
      </div>
      {ann && <AnnDialog item={ann === "new" ? null : ann} onDone={done} onClose={() => setAnn(null)} />}
      {ev && <EvDialog item={ev === "new" ? null : ev} onDone={done} onClose={() => setEv(null)} />}
    </div>
  );
}

function AnnDialog({ item, onDone, onClose }: { item: Ann | null; onDone: () => void; onClose: () => void }) {
  const { user } = useAuth();
  const [pub, setPub] = useState(item?.published ?? false);
  const save = useMutation({
    mutationFn: async (fd: FormData) => {
      const title = String(fd.get("title")).trim();
      if (title.length < 3) throw new Error("Informe um título.");
      const v = { title, body: String(fd.get("body") ?? ""), published: pub, published_at: pub ? item?.published_at ?? new Date().toISOString() : null };
      if (item) await guardedUpdate("announcements", item.id, item.updated_at, v);
      else { const { error } = await supabase.from("announcements").insert({ ...v, created_by: user?.id ?? null }); if (error) throw error; }
    },
    onSuccess: () => { toast.success("Salvo."); onDone(); }, onError: (e) => toast.error(errMsg(e)),
  });
  const del = useMutation({ mutationFn: async () => { const { error } = await supabase.from("announcements").delete().eq("id", item!.id); if (error) throw error; }, onSuccess: onDone, onError: (e) => toast.error(errMsg(e)) });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="theme-light max-w-2xl">
        <DialogHeader><DialogTitle>{item ? "Editar comunicado" : "Novo comunicado"}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(new FormData(e.currentTarget)); }} className="space-y-4">
          <div className="space-y-1.5"><Label>Título</Label><Input name="title" defaultValue={item?.title} required maxLength={200} /></div>
          <div className="space-y-1.5"><Label>Texto</Label><Textarea name="body" defaultValue={item?.body} rows={6} maxLength={10000} /></div>
          <label className="flex items-center gap-2 text-sm"><Switch checked={pub} onCheckedChange={setPub} /> Publicado</label>
          <div className="flex justify-between">{item ? <Button type="button" variant="destructive" onClick={() => confirm("Excluir?") && del.mutate()}>Excluir</Button> : <span />}<Button type="submit" disabled={save.isPending}>Salvar</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EvDialog({ item, onDone, onClose }: { item: Ev | null; onDone: () => void; onClose: () => void }) {
  const [pub, setPub] = useState(item?.published ?? false);
  const save = useMutation({
    mutationFn: async (fd: FormData) => {
      const title = String(fd.get("title")).trim();
      const starts_at = fromLocalInput(fd.get("starts_at"));
      if (title.length < 3 || !starts_at) throw new Error("Informe título e data.");
      const v = { title, description: String(fd.get("description") ?? ""), location: String(fd.get("location") ?? ""), starts_at, published: pub };
      if (item) await guardedUpdate("events", item.id, item.updated_at, v);
      else { const { error } = await supabase.from("events").insert(v); if (error) throw error; }
    },
    onSuccess: () => { toast.success("Salvo."); onDone(); }, onError: (e) => toast.error(errMsg(e)),
  });
  const del = useMutation({ mutationFn: async () => { if (!item) throw new Error("Evento não encontrado."); const { error } = await supabase.from("events").delete().eq("id", item.id); if (error) throw error; }, onSuccess: onDone, onError: (e) => toast.error(errMsg(e)) });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="theme-light max-w-2xl">
        <DialogHeader><DialogTitle>{item ? "Editar evento" : "Novo evento"}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(new FormData(e.currentTarget)); }} className="space-y-4">
          <div className="space-y-1.5"><Label>Título</Label><Input name="title" defaultValue={item?.title} required maxLength={200} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Data e hora</Label><Input name="starts_at" type="datetime-local" required defaultValue={toLocalInput(item?.starts_at)} /></div>
            <div className="space-y-1.5"><Label>Local</Label><Input name="location" defaultValue={item?.location} maxLength={200} /></div>
          </div>
          <div className="space-y-1.5"><Label>Descrição</Label><Textarea name="description" defaultValue={item?.description} rows={4} maxLength={5000} /></div>
          <label className="flex items-center gap-2 text-sm"><Switch checked={pub} onCheckedChange={setPub} /> Publicado</label>
          <div className="flex justify-between">{item ? <Button type="button" variant="destructive" onClick={() => confirm("Excluir?") && del.mutate()}>Excluir</Button> : <span />}<Button type="submit" disabled={save.isPending}>Salvar</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
