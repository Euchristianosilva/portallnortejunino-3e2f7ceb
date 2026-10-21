import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { errMsg } from "@/lib/format";
import { z } from "zod";

export interface TrackingResult {
  full_name: string;
  protocol: string;
  form_title: string;
  status: string;
  public_note: string | null;
  created_at: string;
  updated_at: string;
  tracking_token: string;
}

export const lookupRegistration = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        protocol: z.string().regex(/^\d{4}$/, "O protocolo tem 4 dígitos."),
        email: z.string().trim().email("E-mail inválido.").max(255),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ results: TrackingResult[]; error?: string }> => {
    setResponseHeader("Cache-Control", "no-store");
    const ip =
      getRequestHeader("cf-connecting-ip") ??
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("lookup_registration", {
      _protocol: data.protocol,
      _email: data.email,
      _ip: ip,
    });
    if (error) return { results: [], error: errMsg(error) };
    return { results: (rows ?? []) as TrackingResult[] };
  });

export const refreshTracking = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<TrackingResult | null> => {
    setResponseHeader("Cache-Control", "no-store");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin.rpc("lookup_by_token", { _token: data.token });
    return ((rows ?? [])[0] as TrackingResult) ?? null;
  });
