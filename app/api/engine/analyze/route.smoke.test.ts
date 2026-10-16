import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/app-auth", () => ({ requireMemberApi: async () => null }));

import { POST } from "@/app/api/engine/analyze/route";

function request(body: unknown) {
  return new Request("http://localhost/api/engine/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

describe("POST /api/engine/analyze live GNU smoke", () => {
  it("returns top-four checker analysis for a game-state-one Match ID", async () => {
    const response = await POST(request({ kind: "checker", positionId: "4HPwATDgc/ABMA", matchId: "cIkKAAAAAAAA", dice: [5, 2] }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.kind).toBe("checker");
    expect(body.analysis.candidates).toHaveLength(4);
    expect(body.analysis.candidates[0].plies).toBe(2);
  });

  it("returns a cube action and all three equities without dice", async () => {
    const response = await POST(request({ kind: "cube", positionId: "4HPwATDgc/ABMA", matchId: "cAkAAAAAAAAA" }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.kind).toBe("cube");
    expect(body.analysis.action).toEqual(expect.any(String));
    expect(body.analysis.equities).toEqual({ noDouble: expect.any(Number), doubleTake: expect.any(Number), doublePass: expect.any(Number) });
  });
});
