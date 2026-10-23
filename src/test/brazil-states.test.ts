import { describe, expect, it } from "vitest";
import { BRAZIL_STATES, matchesOpportunityState, opportunityStates, searchStates } from "@/lib/brazil-states";

describe("Estados de atuação", () => {
  it("oferece exatamente as 27 UFs solicitadas sem duplicatas", () => {
    expect(BRAZIL_STATES.map(s => s.code)).toEqual(["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"]);
  });
  it("pesquisa por sigla e nome com ou sem acento", () => {
    expect(searchStates("RO").some(s => s.code === "RO")).toBe(true);
    expect(searchStates("rondonia").map(s => s.code)).toEqual(["RO"]);
    expect(searchStates("Amazonas").map(s => s.code)).toEqual(["AM"]);
  });
  it("uma vaga em RO e AM aparece nos dois filtros, mas não em AC", () => {
    const vaga = { states: ["RO", "AM"] };
    expect(matchesOpportunityState(vaga, "RO")).toBe(true);
    expect(matchesOpportunityState(vaga, "AM")).toBe(true);
    expect(matchesOpportunityState(vaga, "AC")).toBe(false);
  });
  it("uma única UF não é expandida para outras", () => {
    expect(opportunityStates({ states: ["AM"] })).toEqual(["AM"]);
    expect(matchesOpportunityState({ states: ["AM"] }, "RO")).toBe(false);
  });
  it("todas as 27 UFs correspondem a todos os filtros", () => {
    const vaga = { states: BRAZIL_STATES.map(s => s.code) };
    expect(BRAZIL_STATES.every(s => matchesOpportunityState(vaga, s.code))).toBe(true);
  });
  it("sem estados não significa nacional e legado mantém a localização conhecida", () => {
    expect(matchesOpportunityState({ states: [], state: "" }, "RO")).toBe(false);
    expect(opportunityStates({ state: "Rondônia" })).toEqual(["RO"]);
    expect(opportunityStates({ state: "Local a definir" })).toEqual([]);
  });
});