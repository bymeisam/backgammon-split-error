import { describe, expect, it } from "vitest";
import { activeNavHref, isNavItemActive, navItems } from "./navItems";

describe("navItems", () => {
  it("lists Galaxy only in write mode", () => {
    expect(navItems(true).map((i) => i.label)).toEqual([
      "Matches",
      "Analysis",
      "Mistakes",
      "Repeated",
      "Review",
      "Galaxy",
      "Settings",
      "Status",
    ]);
    expect(navItems(false).map((i) => i.label)).toEqual([
      "Matches",
      "Analysis",
      "Mistakes",
      "Repeated",
      "Review",
      "Settings",
      "Status",
    ]);
  });

  it("puts Cards under Review, and Settings and Status at the end", () => {
    const review = navItems(false).find((i) => i.label === "Review");
    expect(review?.children?.map((c) => c.href)).toEqual(["/review/cards"]);
    expect(review?.showsDueCount).toBe(true);
    expect(navItems(false).filter((i) => i.end).map((i) => i.href)).toEqual(["/settings", "/status"]);
  });
});

describe("activeNavHref", () => {
  const items = navItems(true);

  it("picks the most specific item", () => {
    expect(activeNavHref("/matches", items)).toBe("/matches");
    expect(activeNavHref("/matches/46576635", items)).toBe("/matches");
    expect(activeNavHref("/matches/46576635/replay/2", items)).toBe("/matches");
    expect(activeNavHref("/matches/analysis", items)).toBe("/matches/analysis");
    expect(activeNavHref("/review", items)).toBe("/review");
    expect(activeNavHref("/review/cards", items)).toBe("/review/cards");
    expect(activeNavHref("/galaxy/matches/123", items)).toBe("/galaxy/matches");
    expect(activeNavHref("/repeated-positions", items)).toBe("/repeated-positions");
    expect(activeNavHref("/settings", items)).toBe("/settings");
  });

  it("needs a whole path segment to match", () => {
    expect(activeNavHref("/matchesfoo", items)).toBeNull();
    expect(activeNavHref("/reviews", items)).toBeNull();
  });

  it("is null on the home page and unknown routes", () => {
    expect(activeNavHref("/", items)).toBeNull();
    expect(activeNavHref("/nope", items)).toBeNull();
  });
});

describe("isNavItemActive", () => {
  const items = navItems(true);
  const review = items.find((i) => i.href === "/review")!;
  const matches = items.find((i) => i.href === "/matches")!;

  it("highlights a parent when its sub-item is active", () => {
    expect(isNavItemActive(review, "/review/cards")).toBe(true);
    expect(isNavItemActive(review, "/review")).toBe(true);
  });

  it("doesn't highlight Matches on Analysis", () => {
    expect(isNavItemActive(matches, activeNavHref("/matches/analysis", items))).toBe(false);
  });

  it("highlights nothing for a null active href", () => {
    expect(items.some((i) => isNavItemActive(i, null))).toBe(false);
  });
});
