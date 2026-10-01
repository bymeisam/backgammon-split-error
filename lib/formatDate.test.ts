import { describe, expect, it } from "vitest";
import { formatMatchDate } from "@/lib/formatDate";

// Noon UTC keeps the calendar day the same in every time zone from
// UTC-11 to UTC+11, so these don't depend on the machine's TZ.
describe("formatMatchDate", () => {
  it("formats as 'D Mon YYYY' with a three-letter month", () => {
    expect(formatMatchDate("2026-09-22T12:00:00.000Z")).toBe("22 Sep 2026");
  });

  it("uses 'Sep', not Intl's 'Sept'", () => {
    expect(formatMatchDate("2026-09-01T12:00:00Z")).toMatch(/ Sep /);
  });

  it("doesn't zero-pad the day", () => {
    expect(formatMatchDate("2026-01-05T12:00:00Z")).toBe("5 Jan 2026");
  });

  it("covers every month", () => {
    const months = Array.from({ length: 12 }, (_, m) =>
      formatMatchDate(`2026-${String(m + 1).padStart(2, "0")}-15T12:00:00Z`).split(" ")[1]
    );
    expect(months).toEqual(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]);
  });
});
