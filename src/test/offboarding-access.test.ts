import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const builder = { inputValidator: () => builder, handler: (handler: unknown) => handler };
  return builder;
} }));
vi.mock("@tanstack/react-start/server", () => ({ setResponseHeader: vi.fn(), getRequestHeader: () => "127.0.0.1" }));
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc } }));
import { accessOffboarding, type OffboardingAccess } from "@/lib/offboarding.functions";
const handler = accessOffboarding as unknown as (input: { data: { token: string; submission?: { full_name: string; email: string; reason: string; declaration: true } } }) => Promise<OffboardingAccess>;
beforeEach(() => rpc.mockReset());
describe("Confirmação de desligamento", () => {
  it("encaminha somente o token e os dados revisados, nunca outro vínculo ou identificador", async () => {
    const submission = { full_name: "Pessoa da equipe", email: "pessoa@example.org", reason: "Motivo voluntário", declaration: true as const };
    rpc.mockResolvedValue({ data: { code: "confirmed", success: true, status: "recebida" }, error: null });
    expect(await handler({ data: { token: "a".repeat(64), submission } })).toMatchObject({ success: true, status: "recebida" });
    expect(rpc).toHaveBeenCalledWith("access_offboarding", { _token: "a".repeat(64), _ip: "127.0.0.1", _submission: submission });
  });
  it("preserva recusa de identidade como falha e não sucesso", async () => {
    rpc.mockResolvedValue({ data: { code: "identity", error: "Informe seu nome completo e o e-mail vinculado à equipe." }, error: null });
    const result = await handler({ data: { token: "a".repeat(64) } });
    expect(result.code).toBe("identity"); expect(result.success).not.toBe(true);
  });
  it("preserva o recibo de uma solicitação já confirmada para recarga idempotente", async () => {
    rpc.mockResolvedValue({ data: { code: "already_confirmed", success: true, status: "recebida", submitted_at: "2026-10-17T06:05:00Z" }, error: null });
    expect(await handler({ data: { token: "a".repeat(64) } })).toMatchObject({ code: "already_confirmed", success: true, submitted_at: "2026-10-17T06:05:00Z" });
  });
  it("não declara sucesso quando a gravação falha", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { code: "42702", message: "private database detail" } });
    const result = await handler({ data: { token: "a".repeat(64) } });
    expect(result.code).toBe("temporary"); expect(result.success).not.toBe(true); expect(JSON.stringify(result)).not.toContain("private database detail");
    vi.restoreAllMocks();
  });
});