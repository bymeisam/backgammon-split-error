// Snaps PoC: the prompt versions sent to Gemini by scripts/snaps/snap-poc.ts.
// Tracked so every cached answer (snap-poc/results/<model>/<version>/) can be
// traced back to the exact text it was asked with. Never edit a published
// version: add a new one, and log it in reports/snaps-prompt-eval.md.

// v1: the original prompt (2026-10-15 review: 4/10 perfect on set1).
const V1 = `You are reading a photo of a backgammon board. Describe the board exactly as it appears in the photo, purely visually. Do not reason about whose turn it is, which side is whose home board, or the direction of play.

Board facts:
- A backgammon board has 24 triangular points: 12 along the top edge of the photo and 12 along the bottom edge.
- Each row of 12 is split 6 + 6 by the central bar.
- Each side has 15 checkers in total (on points, on the bar, or borne off into a tray).
- "light" means the lighter checker colour in the photo and "dark" means the darker one, whatever the actual colours are.

Sideways photos:
- If the board is photographed sideways, i.e. the central bar runs horizontally across the photo instead of vertically, first mentally rotate the photo 90° so that the bar runs vertically (top to bottom), as on a normal board.
- Then report topRow and bottomRow left to right as seen in that rotated frame, never ordered by quadrant in the original photo. Everything else (bar, trays, dice, cube "top"/"bottom") is also described in the rotated frame.
- Say in notes which way you rotated it (clockwise or counter-clockwise).

What to return:
- topRow: exactly 12 entries for the top points, left to right as seen in the photo. Each is { color, count }: the colour of the checkers on that point ("none" with count 0 if empty) and how many there are.
- bottomRow: exactly 12 entries for the bottom points, left to right as seen in the photo, same shape.
- bar: how many light and dark checkers sit on the central bar.
- borneOff: how many light and dark checkers are in the bear-off trays. Use 0 when no tray is visible.
- dice: the values (1-6) of the dice showing on the board, 0 to 2 entries. Empty if none are visible.
- cube: whether the doubling cube is visible, its value (the number showing; 64 on a centred cube means 1, use 1 then), and where it is: "center" (on the bar), "top", "bottom", or "unknown".
- barSide: "middle" when the bar is in the middle between the two 6-point halves, as on a normal board. Otherwise describe where it is.
- confidence: "high", "medium" or "low" for the whole reading.
- notes: any doubts, e.g. stacks cut off by the frame, tall stacks that are hard to count, glare, overlapping checkers.

Count stacked checkers carefully, one by one, including stacks that overlap or run far toward the middle of the board. If a stack is cut off by the frame, estimate its count using the 15-per-colour total and say so in notes.`;

// v2 (2026-10-16): v1 plus a stack-counting section, nothing else changed,
// so the v1 vs v2 comparison isolates it.
const V2 = `${V1}

Counting stacks:
- If a checker in a stack shows a printed number (as many apps and stream overlays draw for tall stacks), use that number as the stack's count.
- Count a stack by counting the visible checker rims from the edge of the board toward the middle; checkers may overlap or be drawn in a second layer on top of the first.
- Self-check before answering: for each colour, points + bar + borne off must equal 15. If it doesn't, recount the tallest stacks first and fix them; only if it still doesn't add up, say so in notes.
- Clocks, score cards, player names and other overlays are not part of the board; ignore them except to avoid confusing them with checkers or dice.`;

/** Every prompt version, oldest first. Keys are the results folder names. */
export const PROMPTS = { v1: V1, v2: V2 } as const;

export type PromptVersion = keyof typeof PROMPTS;

export const PROMPT_VERSIONS = Object.keys(PROMPTS) as PromptVersion[];

/** The newest version (the default for snap-poc.ts). */
export const LATEST_PROMPT_VERSION: PromptVersion = PROMPT_VERSIONS[PROMPT_VERSIONS.length - 1];

export function isPromptVersion(v: string): v is PromptVersion {
  return Object.prototype.hasOwnProperty.call(PROMPTS, v);
}
