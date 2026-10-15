// Snaps proof-of-concept: the board layout Gemini reads from a photo
// (scripts/snap-poc.ts), and a light validator for it. Purely visual: rows
// are left to right as seen in the photo, colours are "light"/"dark" as they
// look, with no backgammon perspective (whose home board, direction of play).
// Step 2 (the local review page) reuses these types and adds the
// layout -> position mapping here.

export type SnapColor = "light" | "dark" | "none";

export interface SnapPoint {
  color: SnapColor;
  count: number;
}

export interface SnapLayout {
  topRow: SnapPoint[]; // 12, left to right as seen
  bottomRow: SnapPoint[]; // 12, left to right as seen
  bar: { light: number; dark: number };
  borneOff: { light: number; dark: number };
  dice: number[]; // 0-2 values, 1-6
  cube: {
    visible: boolean;
    value: number;
    location: "center" | "top" | "bottom" | "unknown";
  };
  barSide: string; // normally "middle"; kept so oddities can be reported
  confidence: "high" | "medium" | "low";
  notes: string;
}

export type SnapValidation =
  | { ok: true; layout: SnapLayout }
  | { ok: false; errors: string[] };

const COLORS = new Set(["light", "dark", "none"]);
const CONFIDENCE = new Set(["high", "medium", "low"]);
const CUBE_LOCATIONS = new Set(["center", "top", "bottom", "unknown"]);

function isNonNegInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Light structural check: 12 entries per row, non-negative integer counts,
 * known enum values. Doesn't check 15-per-colour totals; that's for step 2's
 * scoring to judge, not a parse failure. */
export function validateSnapLayout(input: unknown): SnapValidation {
  const errors: string[] = [];
  if (!isObject(input)) return { ok: false, errors: ["layout is not an object"] };

  for (const rowName of ["topRow", "bottomRow"] as const) {
    const row = input[rowName];
    if (!Array.isArray(row)) {
      errors.push(`${rowName} is not an array`);
      continue;
    }
    if (row.length !== 12) errors.push(`${rowName} has ${row.length} entries, expected 12`);
    row.forEach((p: unknown, i) => {
      if (!isObject(p)) {
        errors.push(`${rowName}[${i}] is not an object`);
        return;
      }
      if (typeof p.color !== "string" || !COLORS.has(p.color)) {
        errors.push(`${rowName}[${i}].color is invalid`);
      }
      if (!isNonNegInt(p.count)) errors.push(`${rowName}[${i}].count is not a non-negative integer`);
    });
  }

  for (const key of ["bar", "borneOff"] as const) {
    const v = input[key];
    if (!isObject(v)) {
      errors.push(`${key} is not an object`);
      continue;
    }
    if (!isNonNegInt(v.light)) errors.push(`${key}.light is not a non-negative integer`);
    if (!isNonNegInt(v.dark)) errors.push(`${key}.dark is not a non-negative integer`);
  }

  const dice = input.dice;
  if (!Array.isArray(dice)) errors.push("dice is not an array");
  else {
    if (dice.length > 2) errors.push(`dice has ${dice.length} entries, expected 0-2`);
    dice.forEach((d: unknown, i) => {
      if (!isNonNegInt(d) || d < 1 || d > 6) errors.push(`dice[${i}] is not 1-6`);
    });
  }

  const cube = input.cube;
  if (!isObject(cube)) errors.push("cube is not an object");
  else {
    if (typeof cube.visible !== "boolean") errors.push("cube.visible is not a boolean");
    if (!isNonNegInt(cube.value)) errors.push("cube.value is not a non-negative integer");
    if (typeof cube.location !== "string" || !CUBE_LOCATIONS.has(cube.location)) {
      errors.push("cube.location is invalid");
    }
  }

  if (typeof input.barSide !== "string") errors.push("barSide is not a string");
  if (typeof input.confidence !== "string" || !CONFIDENCE.has(input.confidence)) {
    errors.push("confidence is invalid");
  }
  if (typeof input.notes !== "string") errors.push("notes is not a string");

  return errors.length > 0 ? { ok: false, errors } : { ok: true, layout: input as unknown as SnapLayout };
}

/** Total checkers of each colour the layout shows: points, bar and tray. */
export function snapCheckerTotals(layout: SnapLayout): { light: number; dark: number } {
  let light = layout.bar.light + layout.borneOff.light;
  let dark = layout.bar.dark + layout.borneOff.dark;
  for (const p of [...layout.topRow, ...layout.bottomRow]) {
    if (p.color === "light") light += p.count;
    else if (p.color === "dark") dark += p.count;
  }
  return { light, dark };
}
