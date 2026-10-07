import { describe, expect, it } from "vitest";
import { GALAXY_SOURCE, externalMatchUrl } from "@/lib/externalMatchUrl";

describe("externalMatchUrl", () => {
  it("Galaxy matches link to Galaxy's match-level review page", () => {
    expect(externalMatchUrl(GALAXY_SOURCE, "45282503")).toBe(
      "https://www.backgammongalaxy.com/play/page_analysis_match_details?match_id=45282503"
    );
  });

  it("any other source gets no link", () => {
    expect(externalMatchUrl("xg", "45282503")).toBeNull();
    expect(externalMatchUrl("", "45282503")).toBeNull();
    expect(externalMatchUrl("Galaxy", "45282503")).toBeNull();
  });

  it("no link without an id; the id is URL-encoded", () => {
    expect(externalMatchUrl(GALAXY_SOURCE, "")).toBeNull();
    expect(externalMatchUrl(GALAXY_SOURCE, "a&b")).toBe(
      "https://www.backgammongalaxy.com/play/page_analysis_match_details?match_id=a%26b"
    );
  });
});
