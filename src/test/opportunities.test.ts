import { describe, it, expect } from "vitest";
import { opportunityOpen, type Opportunity } from "@/lib/opportunities";

const base: Opportunity = {
  id: "o1", title: "Brincante de Ouro", category: "Cultural", modality: "voluntaria",
  modality_label: "Participação voluntária", project: "", description: "", activities: "",
  requirements: "", profile: "", seats: null, state: "", city: "", dedication: "",
  benefits: "", selection_criteria: "", opens_at: null, closes_at: null,
  status: "publicada", image_url: null, form_id: "f1", created_at: "", updated_at: "",
};

describe("opportunityOpen — regras de disponibilidade da vaga", () => {
  it("vaga publicada sem datas está aberta", () => {
    expect(opportunityOpen(base)).toBe(true);
  });

  it("rascunho, pausada, encerrada e arquivada nunca aceitam candidatura", () => {
    for (const status of ["rascunho", "pausada", "encerrada", "arquivada"] as const) {
      expect(opportunityOpen({ ...base, status })).toBe(false);
    }
  });

  it("vaga com abertura futura ainda não aceita candidatura", () => {
    expect(opportunityOpen({ ...base, opens_at: new Date(Date.now() + 86_400_000).toISOString() })).toBe(false);
  });

  it("vaga com encerramento passado não aceita candidatura", () => {
    expect(opportunityOpen({ ...base, closes_at: new Date(Date.now() - 86_400_000).toISOString() })).toBe(false);
  });

  it("vaga dentro da janela de candidaturas está aberta", () => {
    expect(opportunityOpen({
      ...base,
      opens_at: new Date(Date.now() - 86_400_000).toISOString(),
      closes_at: new Date(Date.now() + 86_400_000).toISOString(),
    })).toBe(true);
  });
});
