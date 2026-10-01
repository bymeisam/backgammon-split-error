import { afterEach, describe, expect, it, vi } from "vitest";
import { galaxyPost, jsonOrThrow } from "@/lib/galaxyPost";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("galaxyPost", () => {
  it("POSTs JSON with the token as authorization plus any extra fields", async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    await galaxyPost("/api/galaxy/matches/1/sync", "Bearer t", { indexData: { a: 1 } });

    expect(fetchMock).toHaveBeenCalledWith("/api/galaxy/matches/1/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorization: "Bearer t", indexData: { a: 1 } }),
    });
  });

  it("sends just the token when there's nothing extra", async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    await galaxyPost("/api/galaxy/matches/list/2", "Bearer t");

    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({ authorization: "Bearer t" });
  });
});

describe("jsonOrThrow", () => {
  const res = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

  it("returns the body of an OK response", async () => {
    await expect(jsonOrThrow(res(200, { page: 1 }))).resolves.toEqual({ page: 1 });
  });

  it("throws the route's own error message", async () => {
    await expect(jsonOrThrow(res(502, { error: "Galaxy said no" }))).rejects.toThrow("Galaxy said no");
  });

  it("falls back to the status code when there's no error message", async () => {
    await expect(jsonOrThrow(res(500, {}))).rejects.toThrow("Request failed (500).");
  });
});
