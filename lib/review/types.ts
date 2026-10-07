// Shapes the review feature passes between server and client (props and
// API JSON). Types only.
import type { Decision } from "@/lib/mistakes";
import type { ReviewOption } from "@/lib/review/options";
import type { CardQuestionKind } from "@/lib/review/format";

// A tag on a decision.
export interface DecisionTagRef {
  id: number;
  name: string;
}

// A decision's review card, as boards show it ("In review · due …").
// `due` is an ISO string (it crosses JSON).
export interface DecisionReviewStatus {
  cardId: number;
  due: string;
  suspended: boolean;
}

// One card as /review shows it. Every value is derived from the decision's
// raw through lib/analysis/index.ts's dispatchers (lib/review/cardPayload.ts).
export interface ReviewCardPayload {
  cardId: number;
  decisionId: number;
  // ReviewCard.state (lib/review/cardState.ts) when the batch was loaded.
  state: number;
  // The board's data (lib/decisionFromRow.ts), drawn in quiz mode.
  decision: Decision;
  question: CardQuestionKind;
  // In display order: checker candidates shuffled, cube options fixed.
  options: ReviewOption[];
  bestKey: string;
  // The option the game's player chose, when the analysis tells it (checker
  // moves); null for cube cards.
  playedKey: string | null;
  // What was played in the game, in the app's usual wording.
  playedLabel: string;
  // Cube cards: the doubler-view equities for the ND / DT / DP table.
  cube: { nd: number; dt: number; dp: number } | null;
  // "5-point match · you 3 – opp 2 · Crawford" / "money game" / "".
  matchContext: string;
  classification: string;
  replayHref: string;
  // "View on Galaxy" (lib/externalMatchUrl.ts), null for other sources.
  externalHref: string | null;
}

export interface ReviewQueueResponse {
  cards: ReviewCardPayload[];
  // Due counts after the daily limits, including this batch.
  due: { new: number; review: number };
  batchNew: number;
}

export interface ReviewAnswerResponse {
  correct: boolean;
  rating: "again" | "hard" | "good" | "easy";
  loss: number;
  due: string;
  state: number;
}

export interface ReviewSummaryResponse {
  // The earliest due time among the filter's unsuspended cards that aren't
  // due yet, or null.
  nextDue: string | null;
}

export interface BulkAddResponse {
  dryRun: boolean;
  // Decisions added (or that would be added).
  added: number;
  alreadyInReview: number;
  ineligible: number;
  // True when more eligible decisions match the filter beyond the cap.
  capped: boolean;
}
