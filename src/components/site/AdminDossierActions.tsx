import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { MoreHorizontal, Eye, FileText, Download, Printer, ShieldCheck, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { prepareAdminDossier } from "@/lib/dossier.functions";
import { deliverFile, pdfBlob } from "@/lib/download";
import { toast } from "sonner";

export function AdminDossierActions({ registrationId, protocol }: { registrationId: string; protocol: string }) {
  const navigate = useNavigate();
  const prepare = useServerFn(prepareAdminDossier);
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState<Awaited<ReturnType<typeof prepareAdminDossier>> | null>(null);
  const [error, setError] = useState("");
  async function action(kind: "view" | "generate" | "pdf" | "print" | "consents") {
    if (kind !== "pdf") {
      sessionStorage.setItem("pnj-admin-dossier-access", JSON.stringify({ registrationId, action: kind }));
      await navigate({ to: "/documento", search: { admin: true } });
      return;
    }
    setPending(true); setError("");
    try { setReady(await prepare({ data: { registrationId, action: kind } })); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível gerar o documento."); }
    finally { setPending(false); }
  }
  return <div onClick={e => e.stopPropagation()}>
    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Documentos da inscrição ${protocol}`} disabled={pending}>{pending ? <LoaderCircle className="animate-spin"/> : <MoreHorizontal/>}</Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="theme-light">
        <DropdownMenuItem onSelect={() => void action("view")}><Eye/>Visualizar relatório</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void action("generate")}><FileText/>Gerar relatório</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void action("pdf")}><Download/>Gerar PDF</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void action("print")}><Printer/>Imprimir inscrição</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void action("consents")}><ShieldCheck/>Consultar termos aceitos</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <Dialog open={pending || !!ready || !!error} onOpenChange={open => { if (!open && !pending) { setReady(null); setError(""); } }}><DialogContent className="theme-light"><DialogHeader><DialogTitle>PDF da inscrição {protocol}</DialogTitle></DialogHeader>
      {pending ? <p role="status">Gerando documento completo…</p> : error ? <p role="alert" className="text-destructive">{error}</p> : ready ? <><p className="break-words font-semibold">{ready.dossier.snapshot.full_name} · {ready.dossier.snapshot.protocol}</p><Button onClick={() => void deliverFile(pdfBlob(ready.pdf), `dossie-inscricao-${ready.dossier.snapshot.protocol}.pdf`).catch(() => toast.error("Não foi possível baixar o PDF."))}><Download/>Baixar PDF</Button></> : null}
    </DialogContent></Dialog>
  </div>;
}