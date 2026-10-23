export const BRAZIL_STATES = [
  { code: "AC", name: "Acre" }, { code: "AL", name: "Alagoas" },
  { code: "AP", name: "Amapá" }, { code: "AM", name: "Amazonas" },
  { code: "BA", name: "Bahia" }, { code: "CE", name: "Ceará" },
  { code: "DF", name: "Distrito Federal" }, { code: "ES", name: "Espírito Santo" },
  { code: "GO", name: "Goiás" }, { code: "MA", name: "Maranhão" },
  { code: "MT", name: "Mato Grosso" }, { code: "MS", name: "Mato Grosso do Sul" },
  { code: "MG", name: "Minas Gerais" }, { code: "PA", name: "Pará" },
  { code: "PB", name: "Paraíba" }, { code: "PR", name: "Paraná" },
  { code: "PE", name: "Pernambuco" }, { code: "PI", name: "Piauí" },
  { code: "RJ", name: "Rio de Janeiro" }, { code: "RN", name: "Rio Grande do Norte" },
  { code: "RS", name: "Rio Grande do Sul" }, { code: "RO", name: "Rondônia" },
  { code: "RR", name: "Roraima" }, { code: "SC", name: "Santa Catarina" },
  { code: "SP", name: "São Paulo" }, { code: "SE", name: "Sergipe" },
  { code: "TO", name: "Tocantins" },
] as const;

export function normalizeStateSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

export function searchStates(search: string) {
  const query = normalizeStateSearch(search);
  return BRAZIL_STATES.filter(s => normalizeStateSearch(`${s.code} ${s.name}`).includes(query));
}

export function opportunityStates(o: { states?: string[]; state?: string }): string[] {
  if (o.states?.length) return BRAZIL_STATES.filter(s => o.states?.includes(s.code)).map(s => s.code);
  const legacy = normalizeStateSearch(o.state ?? "");
  return BRAZIL_STATES.filter(s => normalizeStateSearch(s.code) === legacy || normalizeStateSearch(s.name) === legacy).map(s => s.code);
}

export function matchesOpportunityState(o: { states?: string[]; state?: string }, code: string) {
  return !code || opportunityStates(o).includes(code);
}

export function opportunityLocation(o: { states?: string[]; state?: string; city?: string }) {
  const states = opportunityStates(o);
  const label = states.length === 27 ? "Todo o Brasil · 27 UFs" : states.join(", ") || o.state || "Estados não informados";
  return [o.city, label].filter(Boolean).join(" — ");
}