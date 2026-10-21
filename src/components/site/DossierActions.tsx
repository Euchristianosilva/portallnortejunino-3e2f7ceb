import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { FileText, Download, Printer, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prepareDossier } from "@/lib/dossier.functions";
import { deliverFile, pdfBlob } from "@/lib/download";
import { toast } from "sonner";

export function DossierActions({token}:{token:string}){
 const prepare=useServerFn(prepareDossier);const navigate=useNavigate();
 const [ready,setReady]=useState<Awaited<ReturnType<typeof prepareDossier>>|null>(null);const [error,setError]=useState("");const [attempt,setAttempt]=useState(0);
 useEffect(()=>{let active=true;setReady(null);setError("");prepare({data:{token}}).then(r=>{if(active)setReady(r);}).catch(e=>{if(active)setError(e instanceof Error?e.message:"Não foi possível gerar o documento.");});return()=>{active=false;};},[token,prepare,attempt]);
 function view(print=false){if(!ready)return;sessionStorage.setItem("pnj-dossier-access",JSON.stringify({token,generationId:ready.dossier.id,print}));void navigate({to:"/documento"});}
 return <div className="mt-5 space-y-3 text-left"><div className="flex flex-wrap gap-3"><Button variant="outline" disabled={!ready} onClick={()=>view()}><FileText/>Visualizar documento completo</Button><Button disabled={!ready} onClick={()=>{if(ready)void deliverFile(pdfBlob(ready.pdf),`dossie-inscricao-${ready.dossier.snapshot.protocol}.pdf`).catch(()=>toast.error("Não foi possível baixar. Tente novamente."));}}><Download/>Gerar e baixar PDF</Button><Button variant="outline" disabled={!ready} onClick={()=>view(true)}><Printer/>Imprimir documento</Button></div>{!ready&&!error&&<p className="text-sm text-muted-foreground">Recuperando inscrição e preparando documento completo…</p>}{error&&<div role="alert" className="text-sm text-destructive">{error}<Button type="button" variant="ghost" onClick={()=>setAttempt(a=>a+1)}><RefreshCw/>Tentar novamente</Button></div>}<p className="text-sm text-muted-foreground">Guarde o arquivo e o protocolo. O documento não substitui a análise da coordenação.</p></div>;
}