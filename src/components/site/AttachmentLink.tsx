import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { errMsg } from "@/lib/format";
export function AttachmentLink({ path }: { path:string }) {
 const [busy,setBusy]=useState(false);
 async function open(){try{setBusy(true);const r=await supabase.storage.from("registration-files").download(path);if(r.error)throw r.error;const url=URL.createObjectURL(r.data);const a=document.createElement("a");a.href=url;a.download=path.split("/").at(-1)??"anexo";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){toast.error(errMsg(e));}finally{setBusy(false);}}
 return <Button type="button" variant="outline" size="sm" disabled={busy} onClick={open}><Download/>{busy?"Baixando…":"Baixar anexo"}</Button>;
}