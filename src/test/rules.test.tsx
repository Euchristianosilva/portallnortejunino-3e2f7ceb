import { describe, it, expect } from "vitest";
import { effectivePollStatus, formIsOpen, percent, POLL_TRANSITIONS, REG_STATUS } from "@/lib/format";

const now = new Date("2026-06-15T12:00:00Z");

describe("poll schedule", () => {
  it("active poll past its end date shows as closed", () => {
    expect(effectivePollStatus({ status: "ativa", starts_at: null, ends_at: "2026-06-14T00:00:00Z" }, now)).toBe("encerrada");
  });
  it("active poll before its start shows as scheduled", () => {
    expect(effectivePollStatus({ status: "ativa", starts_at: "2026-06-16T00:00:00Z", ends_at: null }, now)).toBe("agendada");
  });
  it("closed and cancelled polls cannot be reopened", () => {
    expect(POLL_TRANSITIONS.encerrada).toEqual([]);
    expect(POLL_TRANSITIONS.cancelada).toEqual([]);
  });
});

describe("registration window", () => {
  it("unpublished form is closed", () => {
    expect(formIsOpen({ published: false, opens_at: null, closes_at: null }, now)).toBe(false);
  });
  it("form past closing date is closed", () => {
    expect(formIsOpen({ published: true, opens_at: null, closes_at: "2026-06-15T11:59:00Z" }, now)).toBe(false);
  });
  it("published form inside window is open", () => {
    expect(formIsOpen({ published: true, opens_at: "2026-06-01T00:00:00Z", closes_at: "2026-06-30T00:00:00Z" }, now)).toBe(true);
  });
});

describe("results", () => {
  it("percent is computed from valid votes", () => {
    expect(percent(1, 3)).toBe(33.3);
    expect(percent(0, 0)).toBe(0);
  });
  it("has the five required statuses", () => {
    expect(Object.values(REG_STATUS)).toEqual(["Recebida", "Em análise", "Informações solicitadas", "Aprovada", "Não aprovada"]);
  });
});
