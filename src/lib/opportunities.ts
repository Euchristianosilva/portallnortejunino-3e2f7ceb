import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Opportunity {
  id: string; title: string; category: string; modality: string; modality_label: string;
  project: string; description: string; activities: string; requirements: string; profile: string;
  seats: number | null; state: string; city: string; dedication: string; benefits: string;
  selection_criteria: string; opens_at: string | null; closes_at: string | null;
  status: "rascunho" | "publicada" | "pausada" | "encerrada" | "arquivada";
  image_url: string | null; form_id: string | null; created_at: string; updated_at: string;
}

export interface OpportunityDoc {
  link_id: string; document_id: string; version_id: string; title: string; version: number;
  published_at: string | null; body: string; required: boolean; image_choice: boolean; kind: string;
}

export interface OpportunitySource { opportunity: Opportunity; documents: OpportunityDoc[] }

export interface GateState { ok: boolean; missing: string[]; image: "authorized" | "refused" | null }

export const OPP_STATUS: Record<Opportunity["status"], string> = {
  rascunho: "Rascunho", publicada: "Publicada", pausada: "Pausada", encerrada: "Encerrada", arquivada: "Arquivada",
};

export function opportunityOpen(o: Opportunity): boolean {
  if (o.status !== "publicada") return false;
  const now = Date.now();
  if (o.opens_at && new Date(o.opens_at).getTime() > now) return false;
  if (o.closes_at && new Date(o.closes_at).getTime() < now) return false;
  return true;
}

/** Sessão de candidatura: identificador aleatório por vaga, guardado no navegador
 *  e enviado ao servidor, que armazena apenas o hash. */
export function candidacySession(opportunityId: string): string {
  // No servidor (renderização inicial) não há armazenamento do navegador; a sessão
  // real é criada no cliente e nunca é exibida na tela, então não há divergência visual.
  if (typeof window === "undefined") return "";
  const key = `pnj-candidacy-${opportunityId}`;
  let s = sessionStorage.getItem(key);
  if (!s || !/^[0-9a-f-]{36}$/.test(s)) {
    s = crypto.randomUUID();
    sessionStorage.setItem(key, s);
  }
  return s;
}

export const opportunitiesQuery = () =>
  queryOptions({
    queryKey: ["opportunities"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_public_opportunities");
      if (error) throw error;
      return (data ?? []) as Opportunity[];
    },
  });

export const opportunityQuery = (id: string) =>
  queryOptions({
    queryKey: ["opportunity", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("opportunity_public_source", { _id: id });
      if (error) throw error;
      return (data ?? null) as OpportunitySource | null;
    },
  });

export async function fetchGate(opportunityId: string, session: string): Promise<GateState> {
  const { data, error } = await supabase.rpc("opportunity_gate", { _opportunity_id: opportunityId, _session: session });
  if (error) throw error;
  return data as unknown as GateState;
}
