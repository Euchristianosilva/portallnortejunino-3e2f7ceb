import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Dossier } from "@/lib/dossier";

async function digest(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,"0")).join("");}

export const authorizeDossier=createServerFn({method:"POST"})
 .middleware([requireSupabaseAuth])
 .inputValidator(z.object({protocol:z.string().regex(/^\d{4}$/)}))
 .handler(async({data,context})=>{
  setResponseHeader("Cache-Control","no-store");
  const r=await context.supabase.rpc("authorize_registration_dossier",{_protocol:data.protocol});
  if(r.error||!r.data)throw new Error("Nenhuma inscrição autorizada para esta conta. Entre com o e-mail confirmado usado na inscrição.");
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
  const token=crypto.randomUUID().replaceAll("-","")+crypto.randomUUID().replaceAll("-","");
  const a=await supabaseAdmin.from("registration_dossier_access").insert({registration_id:r.data,token_hash:await digest(token)});
  if(a.error)throw new Error("Não foi possível liberar o documento agora.");
  return {token};
 });

export const prepareDossier=createServerFn({method:"POST"})
 .inputValidator(z.object({token:z.string().regex(/^[a-f0-9]{64}$/),generationId:z.string().uuid().optional()}))
 .handler(async({data}):Promise<{dossier:Dossier;pdf:string}>=>{
  setResponseHeader("Cache-Control","no-store");
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
  // The public tracking token is intentionally never accepted here.
  const tokenHash=await digest(data.token);
  const allowed=await supabaseAdmin.rpc("check_dossier_request",{_token_hash:tokenHash});
  if(allowed.error||!allowed.data)throw new Error("Acesso ao documento expirado ou limite de consultas atingido. Consulte novamente com sua conta.");
  const source=await supabaseAdmin.rpc("registration_dossier_source",{_token_hash:tokenHash});
  if(source.error||!source.data||typeof source.data!=="object"||Array.isArray(source.data))throw new Error("Acesso ao documento expirado ou não autorizado. Consulte novamente com sua conta.");
  const {generateDossier}=await import("@/lib/dossier-generation.server");
  return generateDossier(source.data as Record<string,unknown>,data.generationId);
 });

export const prepareAdminDossier=createServerFn({method:"POST"})
 .middleware([requireSupabaseAuth])
 .inputValidator(z.object({registrationId:z.string().uuid(),generationId:z.string().uuid().optional(),action:z.enum(["view","generate","pdf","print","consents"])}))
 .handler(async({data,context}):Promise<{dossier:Dossier;pdf:string}>=>{
  setResponseHeader("Cache-Control","no-store");
  // The permission-checked RPC is the boundary, before any privileged reads.
  const source=await context.supabase.rpc("admin_registration_dossier_source",{_id:data.registrationId});
  if(source.error||!source.data||typeof source.data!=="object"||Array.isArray(source.data))throw new Error("Inscrição não encontrada ou sem permissão para consultar documentos.");
  const {generateDossier}=await import("@/lib/dossier-generation.server");
  const result=await generateDossier(source.data as Record<string,unknown>,data.generationId);
  const audit=await context.supabase.rpc("audit_registration_dossier",{_id:data.registrationId,_generation_id:result.dossier.id,_action:data.action});
  if(audit.error)throw new Error("Não foi possível registrar o acesso autorizado. Tente novamente.");
  return result;
 });