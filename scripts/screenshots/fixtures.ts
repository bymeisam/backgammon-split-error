// The review cards the default and review sets put into review for their
// /review shots, and take out again afterwards.
import { BASE_URL, REVIEW_DECISIONS } from "./config";

// Pushes each new card id into `created` as soon as it exists, so a failure
// part-way still lets the caller remove the ones already added.
export async function addReviewCards(created: number[]): Promise<void> {
  for (const decisionId of REVIEW_DECISIONS) {
    const res = await fetch(`${BASE_URL}/api/review/cards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decisionId }),
    });
    const json = (await res.json().catch(() => null)) as { cardId?: number; error?: string } | null;
    if (res.status === 201 && json?.cardId) {
      created.push(json.cardId);
      console.log(`review: added decision ${decisionId} as card ${json.cardId}`);
    } else if (res.status === 409) {
      console.log(`review: decision ${decisionId} is already in review; using it, not removing it`);
    } else {
      throw new Error(`Adding decision ${decisionId} to review failed: HTTP ${res.status} ${json?.error ?? ""}`);
    }
  }
}

export async function removeReviewCards(cardIds: number[]): Promise<void> {
  for (const id of cardIds) {
    const res = await fetch(`${BASE_URL}/api/review/cards/${id}`, { method: "DELETE" });
    console.log(`review: removed card ${id} (HTTP ${res.status})`);
    if (!res.ok) process.exitCode = 1;
  }
}
