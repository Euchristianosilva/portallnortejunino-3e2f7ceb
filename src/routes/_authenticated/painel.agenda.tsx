import { createFileRoute } from "@tanstack/react-router";
import { useQuery,useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLiveQueries } from "@/lib/realtime";
import { fmtDate,errMsg } from "@/lib/format";
import { LiveBadge } from "@/components/site/Layout";
import { Button } from "@/components/ui/button";
import { EvDialog } from "./painel.comunicados";
import type { Tables } from "@/integrations/supabase/types";
export const Route=createFileRoute("/_authenticated/painel/agenda")({head:()=>({meta:[{title:"Agenda administrativa — Portal Norte Junino"},{name:"description",content:"Crie e edite eventos da agenda do portal."},{property:"og:title",content:"Agenda administrativa — Portal Norte Junino"},{property:"og:description",content:"Gestão de eventos e datas do Portal Norte Junino."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}]}),component:AgendaAdmin});
function AgendaAdmin(){const qc=useQueryClient();const [editing,setEditing]=useState<Tables<"events">|"new"|null>(null);const list=useQuery({queryKey:["admin","events"],queryFn:async()=>{const r=await supabase.from("events").select("*").order("starts_at",{ascending:false}).limit(100);if(r.error)throw r.error;return r.data;}});const live=useLiveQueries("admin-agenda",[{table:"events",keys:[["admin","events"]]}]);return <div className="space-y-5"><div className="flex flex-wrap justify-between gap-3"><h1 className="text-3xl font-bold">Agenda</h1><div className="flex gap-3"><LiveBadge status={live}/><Button onClick={()=>setEditing("new")}><Plus/>Novo evento</Button></div></div>{list.isPending?<p>Carregando…</p>:list.error?<p role="alert">{errMsg(list.error)}</p>:!list.data?.length?<p>Nenhum evento cadastrado.</p>:list.data.map(item=><Button key={item.id} variant="outline" className="h-auto w-full justify-between whitespace-normal p-4" onClick={()=>setEditing(item)}><strong>{item.title}</strong><span>{fmtDate(item.starts_at)} · {item.published?"Publicado":"Rascunho"}</span></Button>)}{editing&&<EvDialog item={editing==="new"?null:editing} onClose={()=>setEditing(null)} onDone={()=>{setEditing(null);qc.invalidateQueries({queryKey:["admin","events"]});}}/>}</div>;}