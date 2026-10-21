import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const schema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/, "Link inválido."), submission: z.object({ full_name: z.string().trim().min(3).max(150), email: z.string().trim().email().max(255), reason: z.string().trim().min(3).max(5000), declaration: z.literal(true) }).optional() });
export interface OffboardingAccess { error?: string; code?: string; success?: boolean; status?: string; submitted_at?: string; title?: string; description?: string; reason_options?: string[]; role_label?: string; state?: string; expires_at?: string }
export const accessOffboarding = createServerFn({ method: "POST" }).inputValidator((input: unknown) => schema.parse(input)).handler(async ({ data }): Promise<OffboardingAccess> => {
  setResponseHeader("Cache-Control", "no-store");
  const ip = getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  try {
    const result = await supabaseAdmin.rpc("access_offboarding", { _token: data.token, _ip: ip, ...(data.submission ? { _submission: data.submission } : {}) });
    if (result.error) {
      console.error("offboarding_rpc_failed", { code: result.error.code });
      return { code: "temporary", error: "Não foi possível comunicar com o serviço. Tente novamente; suas informações foram preservadas." };
    }
    return result.data as OffboardingAccess;
  } catch {
    console.error("offboarding_communication_failed");
    return { code: "temporary", error: "Falha temporária de comunicação. Tente novamente; suas informações foram preservadas." };
  }
});