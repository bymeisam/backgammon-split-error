import type { AppRole } from "@/lib/appRole";

// Who may edit or delete a forum post or reply. Pure, so it's unit-tested;
// used by the forum API routes and the post page's Edit/Delete controls.
// Edit is author-only. Delete is the author's, or the owner's on anyone's
// post or reply (moderation).

type Viewer = { id: number; role: AppRole } | null;

export function canEditForumItem(viewer: Viewer, authorAppUserId: number): boolean {
  return viewer !== null && viewer.id === authorAppUserId;
}

export function canDeleteForumItem(viewer: Viewer, authorAppUserId: number): boolean {
  return viewer !== null && (viewer.id === authorAppUserId || viewer.role === "OWNER");
}
