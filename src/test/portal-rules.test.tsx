import { describe,it,expect } from "vitest";
import { validateUpload,MAX_UPLOAD_SIZE } from "@/lib/upload";
import { offboardingTransitions } from "@/lib/offboarding";
describe("Envio de arquivos",()=>{
 it("aceita JPEG, PNG e WebP",()=>{for(const type of ["image/jpeg","image/png","image/webp"])expect(()=>validateUpload({type,size:1024})).not.toThrow();});
 it("rejeita formatos não permitidos",()=>expect(()=>validateUpload({type:"image/svg+xml",size:1024})).toThrow());
 it("rejeita arquivos acima de 5 MB",()=>{expect(MAX_UPLOAD_SIZE).toBe(5242880);expect(()=>validateUpload({type:"image/png",size:5242881})).toThrow();});
 it("aceita PDF somente para anexos",()=>{expect(()=>validateUpload({type:"application/pdf",size:1024})).toThrow();expect(()=>validateUpload({type:"application/pdf",size:1024},true)).not.toThrow();});
});
describe("Desligamento",()=>{
 it("envio recebido não exige conclusão automática",()=>expect(offboardingTransitions("recebida")).toContain("em_analise"));
 it("link aguardando preenchimento não pode ser concluído",()=>expect(offboardingTransitions("aguardando")).not.toContain("concluida"));
 it("solicitação concluída não pode ser reutilizada",()=>expect(offboardingTransitions("concluida")).toEqual([]));
 it("solicitação cancelada não pode ser reutilizada",()=>expect(offboardingTransitions("cancelada")).toEqual([]));
 it("solicitação expirada não pode ser reutilizada",()=>expect(offboardingTransitions("expirada")).toEqual([]));
});