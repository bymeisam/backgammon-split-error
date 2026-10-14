import { decodeForumPosition, forumPositionCaption } from "@/lib/forumPosition";
import type { DecodedPosition } from "@/lib/gnuPositionId";
import type { BoardCube } from "@/lib/boardFrame";

export const FORUM_HANDOFF_KEY = "forum-board-handoff";
export type ForumHandoff =
  | { match: { decisionId: number }; preview: { position: DecodedPosition; cube: BoardCube | null; dice: number[]; caption: string } }
  | { manual: { positionId: string; gnuMatchId: string; kind: "CHECKER" | "CUBE" }; preview: { position: DecodedPosition; cube: BoardCube; dice: number[]; caption: string } };

export function storeForumHandoff(value: ForumHandoff): boolean {
  try {
    window.sessionStorage.setItem(FORUM_HANDOFF_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function readForumHandoff(): unknown {
  try {
    const value = window.sessionStorage.getItem(FORUM_HANDOFF_KEY);
    return value === null ? null : JSON.parse(value);
  } catch {
    return undefined;
  }
}

export function clearForumHandoff(): void {
  try {
    window.sessionStorage.removeItem(FORUM_HANDOFF_KEY);
  } catch {
    // Storage may be unavailable; posting remains usable.
  }
}

export function isForumHandoff(value: unknown): value is ForumHandoff {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  const preview = item.preview;
  if (!preview || typeof preview !== "object") return false;
  const data = preview as Record<string, unknown>;
  const position = data.position as Record<string, unknown> | null;
  const cube = data.cube as Record<string, unknown> | null;
  if (!position || (data.cube !== null && (typeof data.cube !== "object" || !cube))) return false;
  if (!Array.isArray(position.mine) || position.mine.length !== 24 || !position.mine.every((count) => Number.isInteger(count) && Number(count) >= 0 && Number(count) <= 15)) return false;
  if (!Array.isArray(position.opponent) || position.opponent.length !== 24 || !position.opponent.every((count) => Number.isInteger(count) && Number(count) >= 0 && Number(count) <= 15)) return false;
  if (![position.mineBar, position.opponentBar, position.mineOff, position.opponentOff].every((count) => Number.isInteger(count) && Number(count) >= 0 && Number(count) <= 15)) return false;
  if (cube && (!["owned", "offered"].includes(String(cube.kind)) || !Number.isInteger(cube.value) || Number(cube.value) < 1)) return false;
  if (cube?.kind === "owned" && !["center", "mine", "opponent"].includes(String(cube.owner))) return false;
  if (cube?.kind === "offered" && !["mine", "opponent"].includes(String(cube.side))) return false;
  if (!Array.isArray(data.dice) || !data.dice.every((die) => Number.isInteger(die) && Number(die) >= 1 && Number(die) <= 6) || typeof data.caption !== "string") return false;
  if (item.match && typeof item.match === "object") {
    const match = item.match as Record<string, unknown>;
    return Object.keys(item).every((key) => key === "match" || key === "preview") && Number.isInteger(match.decisionId) && Number(match.decisionId) > 0;
  }
  if (item.manual && typeof item.manual === "object") {
    const manual = item.manual as Record<string, unknown>;
    return Object.keys(item).every((key) => key === "manual" || key === "preview") && cube !== null && typeof manual.positionId === "string" && typeof manual.gnuMatchId === "string" && (manual.kind === "CHECKER" || manual.kind === "CUBE");
  }
  return false;
}
export function resolveForumHandoff(value: unknown):
  | { kind: "absent" }
  | { kind: "invalid" }
  | { kind: "attached"; handoff: ForumHandoff } {
  if (value === null) return { kind: "absent" };
  if (!isForumHandoff(value)) return { kind: "invalid" };
  if ("match" in value) {
    return {
      kind: "attached",
      handoff: { ...value, preview: { ...value.preview, caption: "Match position" } },
    };
  }
  const decoded = decodeForumPosition(value.manual.positionId, value.manual.gnuMatchId, value.manual.kind);
  if (!decoded) return { kind: "invalid" };
  return {
    kind: "attached",
    handoff: {
      ...value,
      preview: {
        position: decoded.position,
        cube: decoded.cube,
        dice: decoded.dice,
        caption: forumPositionCaption(decoded.match, value.manual.kind),
      },
    },
  };
}
