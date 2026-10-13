import { describe, expect, it } from "vitest";
import { canDeleteForumItem, canEditForumItem } from "./forumPermissions";

const owner = { id: 1, role: "OWNER" as const };
const member = { id: 2, role: "MEMBER" as const };

describe("forum permissions", () => {
  it("lets only the author edit", () => {
    expect(canEditForumItem(member, 2)).toBe(true);
    expect(canEditForumItem(owner, 1)).toBe(true);
    expect(canEditForumItem(owner, 2)).toBe(false);
    expect(canEditForumItem(member, 1)).toBe(false);
    expect(canEditForumItem(null, 1)).toBe(false);
  });

  it("lets the author delete, and the owner delete anyone's", () => {
    expect(canDeleteForumItem(member, 2)).toBe(true);
    expect(canDeleteForumItem(member, 1)).toBe(false);
    expect(canDeleteForumItem(owner, 2)).toBe(true);
    expect(canDeleteForumItem(owner, 1)).toBe(true);
    expect(canDeleteForumItem(null, 1)).toBe(false);
  });
});
