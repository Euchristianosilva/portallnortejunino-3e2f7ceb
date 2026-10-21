import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useRef } from "react";
import { Download, Printer, ArrowLeft } from "lucide-react";
import { SiteShell } from "@/components/site/Layout";
import { Button } from "@/components/ui/button";
import { prepareDossier, prepareAdminDossier } from "@/lib/dossier.functions";
import { dossierSections, DOSSIER_TITLE } from "@/lib/dossier";
import { deliverFile, pdfBlob } from "@/lib/download";
import logo from "@/assets/logo-official.png.asset.json";
import { toast } from "sonner";
import { z } from "zod";

export const Route=createFileRoute("/documento")({validateSearch:z.object({admin:z.boolean().optional()}),head:()=>({meta:[{title:"Dossiê individual de inscrição — Portal Norte Junino"},{name:"description",content:"Documento individual com ficha e registros históricos de participação."},{property:"og:title",content:"Dossiê de inscrição — Portal Norte Junino"},{property:"og:description",content:"Consulta privada dos documentos e aceites da inscrição."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"},{name:"robots",content:"noindex, nofollow"}]}),component:DocumentPage});
function DocumentPage(){
 const {admin}=Route.useSearch();const prepareAdmin=useServerFn(prepareAdminDossier);
 const prepare=useServerFn(prepareDossier);const [ready,setReady]=useState<Awaited<ReturnType<typeof prepareDossier>>|null>(null);const [error,setError]=useState("");
 const functions=useRef({prepare,prepareAdmin});functions.current={prepare,prepareAdmin};
 const request=useRef<{key:string;promise:Promise<Awaited<ReturnType<typeof prepareDossier>>>}|null>(null);
 useEffect(()=>{let active=true;let timer:ReturnType<typeof setTimeout>|undefined;setReady(null);setError("");setDownloadReady(false);async function load(){try{const key=admin?"pnj-admin-dossier-access":"pnj-dossier-access";const raw=sessionStorage.getItem(key);if(!raw)throw new Error("Consulte sua inscrição para acessar o documento.");const access=JSON.parse(raw);if(request.current?.key!==key+raw){request.current={key:key+raw,promise:admin?functions.current.prepareAdmin({data:{registrationId:access.registrationId,generationId:access.generationId,action:access.action??"view"}}):functions.current.prepare({data:{token:access.token,generationId:access.generationId}})};}const r=await request.current.promise;if(active){setReady(r);sessionStorage.setItem(key,JSON.stringify({...access,generationId:r.dossier.id,action:"view",print:false}));if(access.action==="consents")timer=setTimeout(()=>document.getElementById("secao-5")?.scrollIntoView(),100);if(access.print||access.action==="print")timer=setTimeout(()=>window.print(),500);}}catch(e){if(active)setError(e instanceof Error?e.message:"Não foi possível recuperar o documento.");}}void load();return()=>{active=false;if(timer)clearTimeout(timer);};},[admin]);
 async function auditAction(action: "pdf" | "print") {
  if (!admin || !ready) return;
  const raw=sessionStorage.getItem("pnj-admin-dossier-access");
  if (!raw) throw new Error("Consulte a inscrição novamente.");
  const access=JSON.parse(raw);
  await prepareAdmin({data:{registrationId:access.registrationId,generationId:ready.dossier.id,action}});
 }
 async function download() {
  if (!ready) return;
  try { await auditAction("pdf"); setDownloadReady(true); } catch(e) {toast.error(e instanceof Error?e.message:"Não foi possível preparar o download.");}
 }
 const [downloadReady,setDownloadReady]=useState(false);
 const sections=ready?dossierSections(ready.dossier):[];
 return <SiteShell><section className="theme-light dossier-page"><div className="mx-auto max-w-4xl px-5 py-10"><div className="dossier-controls mb-8 flex flex-wrap items-center gap-3"><Button asChild variant="outline"><Link to={admin?"/painel/inscricoes":"/acompanhar"}><ArrowLeft/>{admin?"Voltar às inscrições":"Acompanhamento"}</Link></Button><Button disabled={!ready} onClick={()=>{if(!ready)return;if(admin&&!downloadReady){void download();return;}void deliverFile(pdfBlob(ready.pdf),`dossie-inscricao-${ready.dossier.snapshot.protocol}.pdf`).catch(()=>toast.error("Não foi possível baixar o PDF."));}}><Download/>{admin&&!downloadReady?"Preparar PDF":"Baixar PDF"}</Button><Button variant="outline" disabled={!ready} onClick={()=>{void auditAction("print").then(()=>window.print()).catch(()=>toast.error("Não foi possível autorizar a impressão."));}}><Printer/>Imprimir documento</Button></div>{error?<p role="alert">{error}</p>:!ready?<p>Recuperando documento completo…</p>:<><header className="bg-primary px-6 py-8 text-primary-foreground"><img src={logo.url} alt="Portal Norte Junino" className="mb-5 h-20 w-auto object-contain"/><h1 className="text-2xl font-extrabold">{DOSSIER_TITLE}</h1><p className="mt-3">Protocolo {ready.dossier.snapshot.protocol}</p></header><nav aria-label="Sumário do documento" className="dossier-controls border-b border-border py-6"><ol className="space-y-2 text-sm">{sections.map((s,i)=><li key={s.title}><a className="text-primary underline" href={`#secao-${i}`}>{s.title}</a></li>)}</ol></nav><p className="border-b border-border py-4 text-sm text-muted-foreground">Dados e situação consultados na geração deste relatório. Gerado em {new Date(ready.dossier.generated_at).toLocaleString("pt-BR")}.</p><article>{sections.map((s,i)=><section id={`secao-${i}`} key={s.title} className="dossier-section border-b border-border py-8"><h2 className="mb-5 text-xl font-bold">{s.title}</h2><div className="whitespace-pre-wrap break-words text-sm leading-7">{s.text}</div></section>)}</article></>}</div></section></SiteShell>;
}