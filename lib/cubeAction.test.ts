import { describe, expect, it } from "vitest";
import { deriveCubeAction, doublerAction, receiverAction } from "@/lib/cubeAction";

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

describe("doublerAction — ties", () => {
  it("DT == ND (both < 1) -> No double/take", () => {
    expect(doublerAction(0.5, 0.5, 1)).toBe("No double/take");
  });

  it("ND == DP -> the too-good branch", () => {
    expect(doublerAction(1, 1.2, 1)).toBe("Too good/pass");
    expect(doublerAction(1, 0.9, 1)).toBe("Too good/take");
  });

  it("DT == DP -> the take side", () => {
    expect(doublerAction(0.9, 1, 1)).toBe("Double/take");
    expect(doublerAction(1.1, 1, 1)).toBe("Too good/take");
  });

  it("compares against DP, not a literal 1", () => {
    expect(doublerAction(0.4, 0.45, 0.5)).toBe("Double/take");
    expect(doublerAction(0.4, 0.6, 0.5)).toBe("Double/pass");
    expect(doublerAction(0.6, 0.7, 0.5)).toBe("Too good/pass");
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
  it("C2, decision 629849 (29939852 g1): Double/take, Galaxy says roll -> doesn't match", () => {
    expect(
      deriveCubeAction("cube_double", {
        no_double: 0.7922,
        double_take: 0.9751,
        double_pass: 1,
        doublers_best_action: "roll",
        receivers_best_action: null as unknown as string,
      })
    ).toEqual({ action: "Double/take", matchesGalaxy: false, galaxyLabel: "roll" });
  });

  it("decision 630045 (same game): Double/pass, Galaxy says roll -> doesn't match", () => {
    expect(
      deriveCubeAction("cube_double", {
        no_double: 0.9214,
        double_take: 1.3626,
        double_pass: 1,
        doublers_best_action: "roll",
      })
    ).toMatchObject({ action: "Double/pass", matchesGalaxy: false });
  });

  it("decision 630049 (same game): Double/pass, Galaxy says roll -> doesn't match", () => {
    expect(
      deriveCubeAction("cube_double", {
        no_double: 0.9265,
        double_take: 1.3521,
        double_pass: 1,
        doublers_best_action: "roll",
      })
    ).toMatchObject({ action: "Double/pass", matchesGalaxy: false });
  });

  it("Galaxy 'double' + 'take' agrees with Double/take", () => {
    expect(
      deriveCubeAction("cube_double", {
        no_double: 0.177,
        double_take: 0.264,
        double_pass: 1,
        doublers_best_action: "double",
        receivers_best_action: "take",
      })
    ).toEqual({ action: "Double/take", matchesGalaxy: true, galaxyLabel: "double, take" });
  });

  it("Galaxy 'roll' agrees with No double/take and both too-good actions", () => {
    for (const [nd, dt] of [
      [0.182, 0.042],
      [1.065, 1.2],
      [1.007, 0.932],
    ]) {
      expect(
        deriveCubeAction("cube_double", { no_double: nd, double_take: dt, double_pass: 1, doublers_best_action: "roll" })
          ?.matchesGalaxy
      ).toBe(true);
    }
  });

  it("a receiver label on the wrong side is a mismatch even when the doubler label agrees", () => {
    expect(
      deriveCubeAction("cube_double", {
        no_double: 1.065,
        double_take: 1.2,
        double_pass: 1,
        doublers_best_action: "roll",
        receivers_best_action: "take",
      })
    ).toMatchObject({ action: "Too good/pass", matchesGalaxy: false, galaxyLabel: "roll, take" });
  });

  it("missing equities -> null (caller falls back to Galaxy's label)", () => {
    expect(deriveCubeAction("cube_double", { no_double: 0.5, double_pass: 1 })).toBeNull();
    expect(deriveCubeAction("move", { no_double: 0.5, double_take: 0.6, double_pass: 1 })).toBeNull();
  });
});

describe("deriveCubeAction — real cube_pass rows (receiver's view, negated)", () => {
  it("decision 1268248: DT −1.1364, DP −1 -> Pass, matches Galaxy's pass", () => {
    expect(
      deriveCubeAction("cube_pass", {
        no_double: -0.5854,
        double_take: -1.1364,
        double_pass: -1,
        doublers_best_action: "double",
        receivers_best_action: "pass",
      })
    ).toEqual({ action: "Pass", matchesGalaxy: true, galaxyLabel: "pass" });
  });

  it("decision 1268285: DT −0.0005, DP −1 -> Take, matches Galaxy's take", () => {
    expect(
      deriveCubeAction("cube_pass", {
        no_double: -0.0005,
        double_take: -0.0005,
        double_pass: -1,
        doublers_best_action: "double",
        receivers_best_action: "take",
      })
    ).toEqual({ action: "Take", matchesGalaxy: true, galaxyLabel: "take" });
  });

  it("decision 652116 (one of 4 un-negated cube_pass rows, DP +1): DT 1.1137 -> Pass", () => {
    expect(
      deriveCubeAction("cube_pass", {
        no_double: 0.885,
        double_take: 1.1137,
        double_pass: 1,
        doublers_best_action: "roll",
        receivers_best_action: "pass",
      })
    ).toMatchObject({ action: "Pass", matchesGalaxy: true });
  });

  it("a take where Galaxy says pass -> doesn't match", () => {
    expect(
      deriveCubeAction("cube_pass", {
        no_double: -0.5,
        double_take: -0.8,
        double_pass: -1,
        receivers_best_action: "pass",
      })
    ).toMatchObject({ action: "Take", matchesGalaxy: false, galaxyLabel: "pass" });
  });
});

describe("deriveCubeAction — exact ties count as matching Galaxy", () => {
  it("662455 (33173703 g2): ND == DP == 1, DT 2.8281, Galaxy 'double, pass' -> no badge", () => {
    expect(
      deriveCubeAction("cube_double", {
        no_double: 1,
        double_take: 2.8281,
        double_pass: 1,
        doublers_best_action: "double",
        receivers_best_action: "pass",
      })
    ).toEqual({ action: "Too good/pass", matchesGalaxy: true, galaxyLabel: "double, pass" });
  });

  it("ND == DP: 'roll' still matches, and a wrong receiver label is still a mismatch", () => {
    const base = { no_double: 1, double_take: 2.8281, double_pass: 1 };
    expect(deriveCubeAction("cube_double", { ...base, doublers_best_action: "roll" })?.matchesGalaxy).toBe(true);
    expect(
      deriveCubeAction("cube_double", { ...base, doublers_best_action: "double", receivers_best_action: "take" })
        ?.matchesGalaxy
    ).toBe(false);
  });

  it("1228774 (33887678 g4): DT == DP == 1, ND 0.7293, Galaxy 'double, pass' -> no badge", () => {
    expect(
      deriveCubeAction("cube_double", {
        no_double: 0.7293,
        double_take: 1,
        double_pass: 1,
        doublers_best_action: "double",
        receivers_best_action: "pass",
      })
    ).toEqual({ action: "Double/take", matchesGalaxy: true, galaxyLabel: "double, pass" });
  });

  it("1020878 (42234245 g2): DT == ND == 0.5242 < DP, Galaxy 'double, take' -> no badge", () => {
    expect(
      deriveCubeAction("cube_double", {
        no_double: 0.5242,
        double_take: 0.5242,
        double_pass: 1,
        doublers_best_action: "double",
        receivers_best_action: "take",
      })
    ).toEqual({ action: "No double/take", matchesGalaxy: true, galaxyLabel: "double, take" });
  });

  it("DT == ND: 'roll' still matches too", () => {
    expect(
      deriveCubeAction("cube_double", { no_double: 0.5242, double_take: 0.5242, double_pass: 1, doublers_best_action: "roll" })
        ?.matchesGalaxy
    ).toBe(true);
  });

  it("cube_pass with DT == DP: take and pass both match", () => {
    const base = { no_double: -0.6, double_take: -1, double_pass: -1 };
    expect(deriveCubeAction("cube_pass", { ...base, receivers_best_action: "take" })).toMatchObject({ action: "Take", matchesGalaxy: true });
    expect(deriveCubeAction("cube_pass", { ...base, receivers_best_action: "pass" })).toMatchObject({ action: "Take", matchesGalaxy: true });
  });

  it("C2 (629849) is not a tie and stays a mismatch", () => {
    expect(
      deriveCubeAction("cube_double", { no_double: 0.7922, double_take: 0.9751, double_pass: 1, doublers_best_action: "roll" })
        ?.matchesGalaxy
    ).toBe(false);
  });
});
