import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ analyze: vi.fn(), analyzeCube: vi.fn() }));
vi.mock("@/lib/engine/gnubg", () => ({ analyze: h.analyze, analyzeCube: h.analyzeCube }));

import { analyzePosition, EngineUnavailableError } from "@/lib/engine";

const checker = { kind: "checker" as const, positionId: "4HPwATDgc/ABMA", matchId: "cIkKAAAAAAAA", dice: [5, 2] as [number, number] };

describe("local engine interface", () => {
  beforeEach(() => {
    h.analyze.mockReset();
    h.analyzeCube.mockReset();
  });

  it.each([
    [Object.assign(new Error("spawn docker ENOENT"), { code: "ENOENT" })],
    [new Error("docker run failed: No such image: bg-gnubg:1.07.001")],
    [new Error("Cannot connect to the Docker daemon")],
  ])("normalizes Docker/image unavailability", async (error) => {
    h.analyze.mockRejectedValue(error);
    await expect(analyzePosition(checker)).rejects.toBeInstanceOf(EngineUnavailableError);
  });

  it("keeps unrelated GNU analysis errors distinct", async () => {
    h.analyze.mockRejectedValue(new Error("invalid checker evaluation"));
    await expect(analyzePosition(checker)).rejects.toThrow("invalid checker evaluation");
  });
});
