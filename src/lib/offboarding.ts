export const OFFBOARDING_STATUS: Record<string,string> = { aguardando: "Aguardando preenchimento", recebida: "Solicitação recebida", em_analise: "Em análise", concluida: "Concluído", cancelada: "Cancelado", expirada: "Expirado" };
export function offboardingTransitions(status: string) {
  if (status === "aguardando") return ["cancelada"];
  if (status === "recebida" || status === "em_analise") return ["recebida", "em_analise", "concluida", "cancelada"];
  return [];
}
export const OFFBOARDING_COLUMNS = "id,user_id,role_label,state,status,expires_at,full_name,contact_email,reason,declaration,admin_note,submitted_at,completed_at,created_by,created_at,updated_at" as const;