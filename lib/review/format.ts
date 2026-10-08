// Display text for the review feature. Pure.
import type { DecisionMatchContext } from "@/lib/analysis/types";

// "now", "in 5 min", "in 3 h", "tomorrow", "in 4 days" — for "In review ·
// due …" and the cards list. Past due reads "now".
export function formatRelativeDue(due: Date, now: Date): string {
  const ms = due.getTime() - now.getTime();
  if (ms < 60_000) return "now";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.round(ms / 3_600_000);
  if (hours < 24) return `in ${hours} h`;
  // Calendar days between the two local dates.
  const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startDue = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const days = Math.round((startDue - startNow) / 86_400_000);
  if (days <= 1) return "tomorrow";
  return `in ${days} days`;
}

// "5-point match · you 3 – opp 2 · Crawford", from the decision-maker's
// view (the card always says "you" for whoever made the decision);
// "money game" for a money game; "" when unknown.
export function formatMatchContext(ctx: DecisionMatchContext | null): string {
  if (!ctx) return "";
  if (ctx.matchLength === 0) return "money game";
  const parts = [`${ctx.matchLength}-point match`];
  if (ctx.deciderScore !== null && ctx.opponentScore !== null) {
    parts.push(`you ${ctx.deciderScore} – opp ${ctx.opponentScore}`);
  }
  if (ctx.crawford === "crawford") parts.push("Crawford");
  if (ctx.crawford === "post_crawford") parts.push("post-Crawford");
  return parts.join(" · ");
}

export type CardQuestionKind = "checker" | "doubler" | "receiver";

// The question header, always second person — even for an opponent's
// decision: the user is learning to make that decision themselves. Two
// parts: the situation, and the question (set in italics).
export function questionFor(kind: CardQuestionKind): { lead: string; ask: string } {
  switch (kind) {
    case "checker":
      return { lead: "Your move.", ask: "What do you play?" };
    case "doubler":
      return { lead: "Cube action.", ask: "What do you do?" };
    case "receiver":
      return { lead: "Opponent doubles.", ask: "Take or pass?" };
  }
}

// "+0.000" style is overkill for losses (always ≤ 0): "0.000", "−0.183".
export function formatLoss(loss: number): string {
  if (loss === 0) return "0.000";
  return `−${Math.abs(loss).toFixed(3)}`;
}

export function formatEquity(e: number): string {
  return e.toFixed(3);
}
