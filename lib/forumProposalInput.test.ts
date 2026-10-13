import { describe, expect, it } from "vitest";
import { validateReplyProposals } from "@/lib/forumProposalInput";

const positions = [
  { studyPositionId: 1, studyPosition: { id: 1, positionId: "4HPwATDgc/ABMA", gnuMatchId: "cAkAAAAAAAAA", kind: "CHECKER" as const } },
  { studyPositionId: 2, studyPosition: { id: 2, positionId: "4HPwATDgc/ABMA", gnuMatchId: "cAkAAAAAAAAA", kind: "CUBE" as const } },
];

describe("validateReplyProposals", () => {
  it("rejects missing, foreign, duplicate and wrong-kind proposals", () => {
    expect(validateReplyProposals({}, positions)).toBeNull();
    expect(validateReplyProposals([{ studyPositionId: 9, cubeAction: "TAKE" }], positions)).toBeNull();
    expect(validateReplyProposals([{ studyPositionId: 1, resultPositionId: "4HPwATDgc/ABMA" }], positions)).toBeNull();
    expect(validateReplyProposals([{ studyPositionId: 2, cubeAction: "UNKNOWN" }], positions)).toBeNull();
    expect(validateReplyProposals([{ studyPositionId: 1, resultPositionId: "invalid" }, { studyPositionId: 1, resultPositionId: "invalid" }], positions)).toBeNull();
  });
});
