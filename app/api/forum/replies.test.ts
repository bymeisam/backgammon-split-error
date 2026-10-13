import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { encodeGnuPositionId } from "@/lib/gnuPositionId";
import { legalSequences } from "@/lib/checkerMoves";
import { decodeForumPosition } from "@/lib/forumPosition";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({
  findPost: vi.fn(), findReply: vi.fn(), createReply: vi.fn(), updateReply: vi.fn(),
  createMany: vi.fn(), deleteMany: vi.fn(), deleteReply: vi.fn(), require: vi.fn(), enabled: vi.fn(), identity: vi.fn(),
}));
const tx = {
  forumReply: { create: db.createReply, update: db.updateReply },
  forumMoveProposal: { createMany: db.createMany, deleteMany: db.deleteMany },
};
vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: (fn: (transaction: typeof tx) => unknown) => fn(tx), forumReply: { delete: db.deleteReply } },
  prismaReadOnly: { forumPost: { findUnique: db.findPost }, forumReply: { findUnique: db.findReply } },
  prismaAuth: {},
}));
vi.mock("@/lib/app-auth", () => ({ requireMemberApi: db.require, getAppAuthState: async () => null }));
vi.mock("@/lib/galaxyGate", () => ({ isGalaxyEnabled: db.enabled }));
vi.mock("@/lib/forum", async (actual) => ({ ...(await actual<typeof import("@/lib/forum")>()), forumIdentity: db.identity }));

import { POST } from "@/app/api/forum/posts/[id]/replies/route";
import { DELETE, PATCH } from "@/app/api/forum/replies/[id]/route";

const checker = { studyPositionId: 1, studyPosition: { id: 1, positionId: "4HPwATDgc/ABMA", gnuMatchId: "MAGzAAAACAAE", kind: "CHECKER" as const } };
const cube = { studyPositionId: 2, studyPosition: { id: 2, positionId: "4HPwATDgc/ABMA", gnuMatchId: "MAGzAAAACAAE", kind: "CUBE" as const } };
const decoded = decodeForumPosition(checker.studyPosition.positionId, checker.studyPosition.gnuMatchId, "CHECKER")!;
const sequence = legalSequences(decoded.position, decoded.dice)[0];
const checkerProposal = { studyPositionId: 1, resultPositionId: encodeGnuPositionId(sequence.position) };
const cubeProposal = { studyPositionId: 2, cubeAction: "DOUBLE_TAKE" };
const postContext = { params: Promise.resolve({ id: "5" }) };
const replyContext = { params: Promise.resolve({ id: "12" }) };
function request(value: unknown, raw?: string): NextRequest {
  return new Request("http://localhost/api/forum/replies", { method: "POST", headers: { "content-type": "application/json" }, body: raw ?? JSON.stringify(value) }) as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  db.require.mockResolvedValue(null); db.enabled.mockReturnValue(true); db.identity.mockResolvedValue({ id: 7, role: "MEMBER" });
  db.findPost.mockResolvedValue({ id: 5, positions: [checker, cube] });
  db.findReply.mockResolvedValue({ postId: 5, authorAppUserId: 7, proposals: [], post: { positions: [checker, cube] } });
  db.createReply.mockResolvedValue({ id: 12 });
});

describe("forum reply proposal APIs", () => {
  it.each([
    ["text only", { body: "hello" }, 0],
    ["proposal only", { proposals: [checkerProposal] }, 1],
    ["mixed", { body: "hello", proposals: [checkerProposal, cubeProposal] }, 1],
  ])("creates %s replies", async (_name, payload, proposalCalls) => {
    const response = await POST(request(payload), postContext);
    expect(response.status).toBe(201);
    expect(db.createMany).toHaveBeenCalledTimes(proposalCalls);
  });

  it("rejects invalid inputs before writing", async () => {
    const invalid = [
      {}, { body: " ", proposals: [] },
      { body: "x", proposals: [{ ...checkerProposal, studyPositionId: 99 }] },
      { body: "x", proposals: [{ studyPositionId: 1, cubeAction: "TAKE" }] },
      { body: "x", proposals: [{ studyPositionId: 2, resultPositionId: checkerProposal.resultPositionId }] },
      { body: "x", proposals: [{ studyPositionId: 1, resultPositionId: "invalid" }] },
      { body: "x", proposals: [{ studyPositionId: 2, cubeAction: "BOGUS" }] },
      { body: "x", proposals: [cubeProposal, cubeProposal] },
    ];
    for (const payload of invalid) expect((await POST(request(payload), postContext)).status).toBe(400);
    expect((await POST(request(null, "{"), postContext)).status).toBe(400);
    expect(db.createReply).not.toHaveBeenCalled();
  });

  it("applies auth and write gates", async () => {
    db.require.mockResolvedValueOnce(new Response(null, { status: 401 }));
    expect((await POST(request({ body: "hello" }), postContext)).status).toBe(401);
    db.enabled.mockReturnValueOnce(false);
    expect((await POST(request({ body: "hello" }), postContext)).status).toBe(403);
  });

  it("preserves saved proposals when the existing text-only edit form omits them", async () => {
    db.findReply.mockResolvedValue({ postId: 5, authorAppUserId: 7, proposals: [{ id: 3 }], post: { positions: [checker, cube] } });
    expect((await PATCH(request({ body: "updated" }), replyContext)).status).toBe(200);
    expect(db.deleteMany).not.toHaveBeenCalled();
    expect(db.createMany).not.toHaveBeenCalled();
  });

  it("replaces proposals on edit and leaves cascade deletion to the reply delete", async () => {
    expect((await PATCH(request({ body: "updated", proposals: [cubeProposal] }), replyContext)).status).toBe(200);
    expect(db.deleteMany).toHaveBeenCalledWith({ where: { replyId: 12 } });
    expect(db.createMany).toHaveBeenCalledWith({ data: [{ studyPositionId: 2, resultPositionId: null, notation: null, cubeAction: "DOUBLE_TAKE", replyId: 12 }] });
    expect((await DELETE(request(null), replyContext)).status).toBe(204);
    expect(db.deleteReply).toHaveBeenCalledWith({ where: { id: 12 } });
  });
});
