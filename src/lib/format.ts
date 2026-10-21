export const REG_STATUS = {
  recebida: "Recebida",
  em_analise: "Em análise",
  info_solicitada: "Informações solicitadas",
  aprovada: "Aprovada",
  nao_aprovada: "Não aprovada",
} as const;
export type RegStatus = keyof typeof REG_STATUS;

export const POLL_STATUS = {
  rascunho: "Rascunho",
  agendada: "Agendada",
  ativa: "Ativa",
  encerrada: "Encerrada",
  cancelada: "Cancelada",
} as const;
export type PollStatus = keyof typeof POLL_STATUS;

/** Allowed manual transitions between poll states. */
export const POLL_TRANSITIONS: Record<PollStatus, PollStatus[]> = {
  rascunho: ["agendada", "ativa", "cancelada"],
  agendada: ["ativa", "rascunho", "cancelada"],
  ativa: ["encerrada", "cancelada"],
  encerrada: [],
  cancelada: [],
};

export const VISIBILITY = {
  oculto: "Oculto",
  ao_vivo: "Ao vivo",
  apos_encerramento: "Após o encerramento",
} as const;

export interface PollTimes {
  status: PollStatus;
  starts_at: string | null;
  ends_at: string | null;
}

/** Status as seen by visitors, taking the schedule into account. */
export function effectivePollStatus(p: PollTimes, now = new Date()): PollStatus {
  if (p.status === "ativa" || p.status === "agendada") {
    if (p.ends_at && now > new Date(p.ends_at)) return "encerrada";
    if (p.starts_at && now < new Date(p.starts_at)) return "agendada";
    if (p.status === "ativa") return "ativa";
  }
  return p.status;
}

export interface FormWindow {
  published: boolean;
  opens_at: string | null;
  closes_at: string | null;
}
export function formIsOpen(f: FormWindow, now = new Date()) {
  if (!f.published) return false;
  if (f.opens_at && now < new Date(f.opens_at)) return false;
  if (f.closes_at && now > new Date(f.closes_at)) return false;
  return true;
}

export function percent(votes: number, total: number) {
  if (!total) return 0;
  return Math.round((votes / total) * 1000) / 10;
}

export function fmtDate(d: string | null | undefined, withTime = true) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function errMsg(e: unknown) {
  if (e && typeof e === "object" && "message" in e) {
    const message = String((e as { message: string }).message);
    if (/invalid login/i.test(message)) return "E-mail ou senha incorretos.";
    if (/rate limit|too many/i.test(message)) return "Muitas tentativas. Aguarde alguns minutos.";
    if (/permission denied|row.level security|not authorized|unauthorized/i.test(message)) return "Você não tem permissão para realizar esta operação.";
    if (/fetch|network|timeout/i.test(message)) return "Não foi possível conectar. Verifique sua conexão e tente novamente.";
    if (/already registered/i.test(message)) return "Este e-mail já está cadastrado.";
    if (/email address is not allowed/i.test(message)) return "Informe um e-mail válido que possa receber mensagens.";
    if (/[ãõçáéíóúâêô]/i.test(message)) return message;
    return "Não foi possível concluir a operação. Tente novamente.";
  }
  return "Ocorreu um erro. Tente novamente.";
}

export const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

export interface FormField {
  key: string;
  label: string;
  type: "text" | "textarea" | "email" | "phone" | "number" | "date" | "select" | "radio" | "multiselect" | "checkbox" | "file";
  required: boolean;
  options?: string[];
  help?: string;
}

export const FIELD_TYPES: Record<FormField["type"], string> = { text: "Texto curto", textarea: "Texto longo", email: "E-mail", phone: "Telefone", number: "Número", date: "Data", select: "Lista de seleção", radio: "Seleção única", multiselect: "Seleção múltipla", checkbox: "Confirmação", file: "Arquivo" };
export const DEFAULT_FIELDS: FormField[] = [
 { key: "telefone", label: "Telefone ou WhatsApp", type: "phone", required: false },
 { key: "estado", label: "Estado", type: "select", required: false, options: UFS },
 { key: "municipio", label: "Município", type: "text", required: false },
 { key: "funcao", label: "Função ou categoria", type: "text", required: false },
 { key: "apresentacao", label: "Apresentação ou informações complementares", type: "textarea", required: false },
 { key: "termos", label: "Li e aceito os termos e a política de privacidade", type: "checkbox", required: true },
];
