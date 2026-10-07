import { describe, expect, it } from "vitest";
import {
  cubeBestDisplay,
  cubePlayedLabel,
  deriveCubeAction,
  doublerAction,
  receiverAction,
} from "@/lib/cubeAction";

describe("doublerAction — the user's table (DP = 1)", () => {
  it("ND < 1, DT < 1, DT > ND -> Double/take", () => {
    expect(doublerAction(0.177, 0.264, 1)).toBe("Double/take");
  });

  it("ND < 1, DT < 1, DT < ND -> No double/take", () => {
    expect(doublerAction(0.182, 0.042, 1)).toBe("No double/take");
  });

  it("ND < 1, DT > 1 -> Double/pass", () => {
    expect(doublerAction(0.81, 1.007, 1)).toBe("Double/pass");
  });

  it("ND > 1, DT > 1 -> Too good/pass", () => {
    expect(doublerAction(1.065, 1.2, 1)).toBe("Too good/pass");
  });

  it("ND > 1, DT < 1 -> Too good/take", () => {
    expect(doublerAction(1.007, 0.932, 1)).toBe("Too good/take");
  });
});

describe("doublerAction — ties (Galaxy's rule: too good only when ND > DP)", () => {
  it("DT == ND (both < 1) -> No double/take", () => {
    expect(doublerAction(0.5, 0.5, 1)).toBe("No double/take");
  });

  it("ND == DP is not too good: Double/pass when DT > DP", () => {
    // 662455 (33173703 g2): ND = DP = 1, DT 2.8281 — was Too good/pass.
    expect(doublerAction(1, 2.8281, 1)).toBe("Double/pass");
    expect(doublerAction(1, 1.2, 1)).toBe("Double/pass");
  });

  it("ND == DP is not too good: No double/take when DT <= DP (DT > ND can't hold)", () => {
    expect(doublerAction(1, 0.9, 1)).toBe("No double/take");
    expect(doublerAction(1, 1, 1)).toBe("No double/take");
  });

  it("DT == DP -> the take side", () => {
    expect(doublerAction(0.9, 1, 1)).toBe("Double/take");
    expect(doublerAction(1.1, 1, 1)).toBe("Too good/take");
  });

  it("compares against DP, not a literal 1", () => {
    expect(doublerAction(0.4, 0.45, 0.5)).toBe("Double/take");
    expect(doublerAction(0.4, 0.6, 0.5)).toBe("Double/pass");
    expect(doublerAction(0.6, 0.7, 0.5)).toBe("Too good/pass");
    expect(doublerAction(0.5, 0.7, 0.5)).toBe("Double/pass");
  });
});

describe("receiverAction", () => {
  it("take if DT <= DP (doubler's view), pass otherwise", () => {
    expect(receiverAction(0.9, 1)).toBe("Take");
    expect(receiverAction(1, 1)).toBe("Take");
    expect(receiverAction(1.1, 1)).toBe("Pass");
  });
});

describe("deriveCubeAction — real cube_double rows", () => {
  it("C2, decision 629849 (29939852 g1): Double/take (Galaxy's stored label says roll)", () => {
    expect(deriveCubeAction("cube_double", { no_double: 0.7922, double_take: 0.9751, double_pass: 1 })).toBe(
      "Double/take"
    );
  });

  it("decisions 630045 and 630049 (same game): Double/pass", () => {
    expect(deriveCubeAction("cube_double", { no_double: 0.9214, double_take: 1.3626, double_pass: 1 })).toBe(
      "Double/pass"
    );
    expect(deriveCubeAction("cube_double", { no_double: 0.9265, double_take: 1.3521, double_pass: 1 })).toBe(
      "Double/pass"
    );
  });

  it("662455: ND == DP == 1, DT 2.8281 -> Double/pass", () => {
    expect(deriveCubeAction("cube_double", { no_double: 1, double_take: 2.8281, double_pass: 1 })).toBe(
      "Double/pass"
    );
  });

  it("missing equities -> null (caller falls back to Galaxy's label)", () => {
    expect(deriveCubeAction("cube_double", { no_double: 0.5, double_pass: 1 })).toBeNull();
    expect(deriveCubeAction("move", { no_double: 0.5, double_take: 0.6, double_pass: 1 })).toBeNull();
  });
});

describe("deriveCubeAction — real cube_pass rows (receiver's view, negated)", () => {
  it("decision 1268248: DT −1.1364, DP −1 -> Pass", () => {
    expect(deriveCubeAction("cube_pass", { no_double: -0.5854, double_take: -1.1364, double_pass: -1 })).toBe(
      "Pass"
    );
  });

  it("decision 1268285: DT −0.0005, DP −1 -> Take", () => {
    expect(deriveCubeAction("cube_pass", { no_double: -0.0005, double_take: -0.0005, double_pass: -1 })).toBe(
      "Take"
    );
  });

  it("decision 652116 (one of 4 un-negated cube_pass rows, DP +1): DT 1.1137 -> Pass", () => {
    expect(deriveCubeAction("cube_pass", { no_double: 0.885, double_take: 1.1137, double_pass: 1 })).toBe("Pass");
  });

  it("DT == DP -> Take", () => {
    expect(deriveCubeAction("cube_pass", { no_double: -0.6, double_take: -1, double_pass: -1 })).toBe("Take");
  });
});

describe("cubeBestDisplay — Galaxy's best-action words, plus the opponent's half", () => {
  it("maps every derived action", () => {
    expect(cubeBestDisplay("No double/take")).toEqual({ label: "No Double", detail: null });
    expect(cubeBestDisplay("Double/take")).toEqual({ label: "Double", detail: "opponent should take" });
    expect(cubeBestDisplay("Double/pass")).toEqual({ label: "Double", detail: "opponent should pass" });
    expect(cubeBestDisplay("Too good/take")).toEqual({ label: "Too good", detail: "opponent should take" });
    expect(cubeBestDisplay("Too good/pass")).toEqual({ label: "Too good", detail: "opponent should pass" });
    expect(cubeBestDisplay("Take")).toEqual({ label: "Take", detail: null });
    expect(cubeBestDisplay("Pass")).toEqual({ label: "Pass", detail: null });
  });
});

describe("cubePlayedLabel — Galaxy's played words", () => {
  it("maps the stored played labels", () => {
    expect(cubePlayedLabel("did not double", "Double/take", "error")).toBe("No Double");
    expect(cubePlayedLabel("doubled", "Double/take", "none")).toBe("Double");
    expect(cubePlayedLabel("took", "Take", "none")).toBe("Take");
    expect(cubePlayedLabel("passed", "Pass", "none")).toBe("Pass");
    expect(cubePlayedLabel("resigned", null, "none")).toBe("Resign");
  });

  it("a no-double check that's too good to double reads Too good when graded none or doubtful", () => {
    expect(cubePlayedLabel("did not double", "Too good/pass", "none")).toBe("Too good");
    expect(cubePlayedLabel("did not double", "Too good/take", "doubtful")).toBe("Too good");
  });

  it("…but No Double when graded an error or blunder, or not too good", () => {
    expect(cubePlayedLabel("did not double", "Too good/pass", "error")).toBe("No Double");
    expect(cubePlayedLabel("did not double", "Too good/pass", "blunder")).toBe("No Double");
    expect(cubePlayedLabel("did not double", "No double/take", "none")).toBe("No Double");
    expect(cubePlayedLabel("did not double", null, "none")).toBe("No Double");
  });

  it("a double that was too good is still Double", () => {
    expect(cubePlayedLabel("doubled", "Too good/pass", "none")).toBe("Double");
  });

  it("passes an unknown label through, including Object.prototype names", () => {
    expect(cubePlayedLabel("?", null, "none")).toBe("?");
    expect(cubePlayedLabel("toString", null, "none")).toBe("toString");
  });
});
