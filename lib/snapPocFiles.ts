// Snaps proof-of-concept: the local files behind app/snap-poc (a dev-only
// review page). Photos are snap-poc/*.jpg|jpeg|png (gitignored), Gemini's
// cached answers snap-poc/results/<model>/<image>.json (scripts/snaps/snap-poc.ts),
// and the user's corrected boards snap-poc/truth/<image>.json.
//
// Every name that reaches the filesystem is first matched exactly against a
// directory listing (allowlist); raw request input is never joined into a path.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { validateSnapLayout, type SnapLayout, type SnapOrientation } from "./snapPocLayout";

const SNAP_DIR = path.join(process.cwd(), "snap-poc");
const RESULTS_DIR = path.join(SNAP_DIR, "results");
const TRUTH_DIR = path.join(SNAP_DIR, "truth");

export const SNAP_IMAGE_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

/** The page and its routes exist only outside production. */
export function isSnapPocEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}

function listDir(dir: string): import("node:fs").Dirent[] {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

export function listSnapImages(): string[] {
  return listDir(SNAP_DIR)
    .filter((d) => d.isFile() && SNAP_IMAGE_TYPES[path.extname(d.name).toLowerCase()])
    .map((d) => d.name)
    .sort();
}

/** The listed image whose name is exactly `name`, or null. */
export function allowedImage(name: unknown): string | null {
  if (typeof name !== "string") return null;
  return listSnapImages().find((image) => image === name) ?? null;
}

export function snapImageContentType(image: string): string {
  return SNAP_IMAGE_TYPES[path.extname(image).toLowerCase()] ?? "application/octet-stream";
}

export function readSnapImage(image: string): Buffer {
  return readFileSync(path.join(SNAP_DIR, image));
}

/** Model folders under results/, with how many cached answers each holds. */
export function listSnapModels(): { model: string; count: number }[] {
  return listDir(RESULTS_DIR)
    .filter((d) => d.isDirectory())
    .map((d) => ({
      model: d.name,
      count: listDir(path.join(RESULTS_DIR, d.name)).filter((f) => f.isFile() && f.name.endsWith(".json")).length,
    }))
    .sort((a, b) => b.count - a.count || a.model.localeCompare(b.model));
}

/** The listed model folder whose name is exactly `name`, or null. */
export function allowedModel(name: unknown): string | null {
  if (typeof name !== "string") return null;
  return listSnapModels().find((m) => m.model === name)?.model ?? null;
}

export interface SnapResult {
  layout: SnapLayout | null;
  parseError: string | null;
  createdAt: string | null;
}

function readJson(file: string): unknown {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

/** Both arguments must already be allowlisted names. */
export function readSnapResult(model: string, image: string): SnapResult | null {
  const json = readJson(path.join(RESULTS_DIR, model, `${image}.json`)) as Record<string, unknown> | null;
  if (!json) return null;
  const v = validateSnapLayout(json.parsed);
  return {
    layout: v.ok ? v.layout : null,
    parseError: v.ok ? (typeof json.parseError === "string" ? json.parseError : null) : v.errors.join("; "),
    createdAt: typeof json.createdAt === "string" ? json.createdAt : null,
  };
}

export interface SnapTruth {
  image: string;
  model: string;
  orientation: SnapOrientation;
  layout: SnapLayout;
  savedAt: string;
}

export function isSnapOrientation(v: unknown): v is SnapOrientation {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    (o.bottomColor === "light" || o.bottomColor === "dark") &&
    (o.bottomHome === "right" || o.bottomHome === "left") &&
    (o.mirroredNumbers === undefined || typeof o.mirroredNumbers === "boolean") &&
    (o.rotated === undefined || typeof o.rotated === "boolean")
  );
}

/** `image` must already be an allowlisted name. */
export function readSnapTruth(image: string): SnapTruth | null {
  const json = readJson(path.join(TRUTH_DIR, `${image}.json`)) as Record<string, unknown> | null;
  if (!json) return null;
  const v = validateSnapLayout(json.layout);
  if (!v.ok || !isSnapOrientation(json.orientation)) return null;
  return {
    image,
    model: typeof json.model === "string" ? json.model : "",
    orientation: json.orientation,
    layout: v.layout,
    savedAt: typeof json.savedAt === "string" ? json.savedAt : "",
  };
}

/** `truth.image` must already be an allowlisted name. */
export function writeSnapTruth(truth: SnapTruth): void {
  mkdirSync(TRUTH_DIR, { recursive: true });
  writeFileSync(path.join(TRUTH_DIR, `${truth.image}.json`), JSON.stringify(truth, null, 2) + "\n");
}
