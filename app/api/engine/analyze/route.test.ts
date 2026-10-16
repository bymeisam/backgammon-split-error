import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ denied: null as Response | null, analyze: vi.fn() }));
vi.mock("@/lib/app-auth", () => ({ requireMemberApi: async () => h.denied }));
vi.mock("@/lib/engine", () => ({
  analyzePosition: h.analyze,
  EngineUnavailableError: class EngineUnavailableError extends Error { constructor(message: string) { super(message); } },
}));

import { POST } from "@/app/api/engine/analyze/route";
import { EngineUnavailableError } from "@/lib/engine";

const checkerBody = { kind: "checker", positionId: "4HPwATDgc/ABMA", matchId: "cIkKAAAAAAAA", dice: [5, 2] };
const cubeBody = { kind: "cube", positionId: "4HPwATDgc/ABMA", matchId: "cAkAAAAAAAAA" };

function request(body: unknown) {
  return new Request("http://localhost/api/engine/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

describe("POST /api/engine/analyze", () => {
  beforeEach(() => {
    h.denied = null;
    h.analyze.mockReset();
    h.analyze.mockImplementation(async (input) => ({ kind: input.kind, analysis: {} }));
  });

  it.each(["member", "owner"])("allows %s after member authorization", async () => {
    h.denied = null;
    const response = await POST(request(checkerBody));
    expect(response.status).toBe(200);
    expect(h.analyze).toHaveBeenCalledWith({ ...checkerBody, dice: [5, 2] });
  });

  it.each([401, 404])("returns the authorization denial (%i) before processing input", async (status) => {
    h.denied = Response.json({ error: "denied" }, { status });
    const response = await POST(request({ invalid: true }));
    expect(response.status).toBe(status);
    expect(h.analyze).not.toHaveBeenCalled();
  });

  it("supports cube input without dice", async () => {
    const response = await POST(request(cubeBody));
    expect(response.status).toBe(200);
    expect(h.analyze).toHaveBeenCalledWith(cubeBody);
  });

  it("rejects game-state-zero Match IDs and malformed input", async () => {
    expect((await POST(request({ ...checkerBody, matchId: "cIgFAAAAAAAA" }))).status).toBe(400);
    expect((await POST(request({ ...cubeBody, dice: [1, 2] }))).status).toBe(400);
    expect(h.analyze).not.toHaveBeenCalled();
  });

  it("returns a stable unavailable response without leaking internal details", async () => {
    h.analyze.mockRejectedValue(new EngineUnavailableError());
    const response = await POST(request(checkerBody));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "engine_unavailable" });
  });
});
