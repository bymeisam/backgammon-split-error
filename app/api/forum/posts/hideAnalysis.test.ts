// POST /api/forum/posts and PATCH /api/forum/posts/[id]: the optional
// hideAnalysis boolean. Auth, the write gate and Prisma are mocked; the
// routes' own validation and lib/forum.ts's helpers run for real.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const db = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  postCreate: vi.fn(),
  studyCreate: vi.fn(),
  linkCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const tx = {
    forumPost: { create: db.postCreate },
    studyPosition: { create: db.studyCreate },
    forumPostPosition: { create: db.linkCreate },
  };
  return {
    prismaApp: {
      forumPost: { update: db.update },
      $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
    },
    prismaReadOnly: { forumPost: { findUnique: db.findUnique } },
  };
});

vi.mock("@/lib/app-auth", () => ({ requireMemberApi: async () => null, getAppAuthState: async () => null }));
vi.mock("@/lib/appWriteGate", () => ({ isAppWriteEnabled: () => true }));

const identity = vi.hoisted(() => ({ current: { id: 7, role: "MEMBER" } as { id: number; role: string } | null }));
vi.mock("@/lib/forum", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/forum")>()),
  forumIdentity: async () => identity.current,
}));

import { POST } from "@/app/api/forum/posts/route";
import { PATCH } from "@/app/api/forum/posts/[id]/route";

// A manual attachment that decodes (the opening position, money game).
const MANUAL = { manual: { positionId: "4HPwATDgc/ABMA", gnuMatchId: "cAkAAAAAAAAA", kind: "CHECKER" } };

function request(body: unknown): NextRequest {
  return new Request("http://localhost/api/forum/posts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const ctx = { params: Promise.resolve({ id: "5" }) };

beforeEach(() => {
  vi.clearAllMocks();
  identity.current = { id: 7, role: "MEMBER" };
  db.postCreate.mockResolvedValue({ id: 99 });
  db.studyCreate.mockResolvedValue({ id: 1 });
  db.findUnique.mockResolvedValue({ authorAppUserId: 7 });
});

describe("POST /api/forum/posts hideAnalysis", () => {
  it("defaults to false when absent", async () => {
    const res = await POST(request({ title: "t", body: "b", positions: [MANUAL] }));
    expect(res.status).toBe(201);
    expect(db.postCreate.mock.calls[0][0].data.hideAnalysis).toBe(false);
  });

  it("stores true", async () => {
    const res = await POST(request({ title: "t", body: "b", positions: [MANUAL], hideAnalysis: true }));
    expect(res.status).toBe(201);
    expect(db.postCreate.mock.calls[0][0].data.hideAnalysis).toBe(true);
  });

  it.each([["true"], [1], [null], [{}]])("rejects a non-boolean (%j)", async (value) => {
    const res = await POST(request({ title: "t", body: "b", positions: [MANUAL], hideAnalysis: value }));
    expect(res.status).toBe(400);
    expect(db.postCreate).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/forum/posts/[id] hideAnalysis", () => {
  it("stores the flag when given", async () => {
    const res = await PATCH(request({ title: "t", body: "b", hideAnalysis: true }), ctx);
    expect(res.status).toBe(200);
    expect(db.update).toHaveBeenCalledWith({ where: { id: 5 }, data: { title: "t", body: "b", hideAnalysis: true } });
  });

  it("leaves it unchanged when absent", async () => {
    await PATCH(request({ title: "t", body: "b" }), ctx);
    expect(db.update).toHaveBeenCalledWith({ where: { id: 5 }, data: { title: "t", body: "b" } });
  });

  it.each([["false"], [0], [null]])("rejects a non-boolean (%j)", async (value) => {
    const res = await PATCH(request({ title: "t", body: "b", hideAnalysis: value }), ctx);
    expect(res.status).toBe(400);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("stays author-only: another member, or the owner, gets 403", async () => {
    for (const viewer of [
      { id: 8, role: "MEMBER" },
      { id: 1, role: "OWNER" },
    ]) {
      identity.current = viewer;
      const res = await PATCH(request({ title: "t", body: "b", hideAnalysis: true }), ctx);
      expect(res.status).toBe(403);
    }
    expect(db.update).not.toHaveBeenCalled();
  });
});
