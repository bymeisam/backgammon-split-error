// Snaps proof-of-concept, step 1: ask Gemini (free tier) to read the
// backgammon position in each photo under snap-poc/ and cache its answers.
// Step 2 (a local review page) scores them against the user's corrections.
//
// No DB. Reads GEMINI_API_KEY from .env (dotenv), sends it only in the
// x-goog-api-key header, never prints it.
//
// Usage:
//   npx tsx scripts/snaps/snap-poc.ts [--force] [--model <id>] [--prompt <version>] [--only <filename>]
//
// - Model: newest stable Flash model (no preview/exp/lite/Pro) from the
//   models list that supports generateContent; --model overrides.
// - Images: snap-poc/*.jpg|jpeg|png, top level only.
// - Prompt: scripts/snaps/prompts.ts; --prompt picks a version (v1, v2, ...),
//   default the newest.
// - Answers: snap-poc/results/<model-id>/<prompt-version>/<image>.json, each
//   recording its promptVersion. Existing ones are skipped unless --force.
// - Pacing: 7 s between API calls. HTTP 429 stops the whole run; any other
//   error for one image is logged and the run goes on.
import "dotenv/config";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { snapCheckerTotals, validateSnapLayout } from "../../lib/snapPocLayout";
import { LATEST_PROMPT_VERSION, PROMPTS, PROMPT_VERSIONS, isPromptVersion, type PromptVersion } from "./prompts";

const API = "https://generativelanguage.googleapis.com/v1beta";
const SNAP_DIR = path.resolve(__dirname, "..", "..", "snap-poc");
const DELAY_MS = 7000;
const IMAGE_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

class RateLimited extends Error {}

function parseArgs(argv: string[]) {
  const args = {
    force: false,
    model: undefined as string | undefined,
    prompt: LATEST_PROMPT_VERSION as PromptVersion,
    only: undefined as string | undefined,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--force") args.force = true;
    else if (a === "--model") args.model = argv[++i];
    else if (a === "--only") args.only = argv[++i];
    else if (a === "--prompt") {
      const v = argv[++i];
      if (v === undefined || !isPromptVersion(v)) {
        throw new Error(`--prompt needs a version: ${PROMPT_VERSIONS.join(", ")}`);
      }
      args.prompt = v;
    }
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (args.model === "" || (args.model === undefined && argv.includes("--model"))) {
    throw new Error("--model needs a model id");
  }
  if (args.only === undefined && argv.includes("--only")) throw new Error("--only needs a filename");
  return args;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let lastCallAt = 0;
async function paced<T>(fn: () => Promise<T>): Promise<T> {
  const wait = lastCallAt + DELAY_MS - Date.now();
  if (lastCallAt > 0 && wait > 0) await sleep(wait);
  try {
    return await fn();
  } finally {
    lastCallAt = Date.now();
  }
}

async function apiFetch(key: string, url: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), "x-goog-api-key": key },
    signal: AbortSignal.timeout(180_000),
  });
  const text = await res.text();
  if (res.status === 429) throw new RateLimited(`HTTP 429: ${text.slice(0, 500)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
  return JSON.parse(text);
}

interface ListedModel {
  name: string;
  supportedGenerationMethods?: string[];
}

// Stable Flash ids look like "models/gemini-2.5-flash" or
// "models/gemini-2.0-flash-001". Anything else (preview, exp, lite, image,
// tts, live, -latest aliases, Pro) is skipped. The models list doesn't report
// input modalities; every Gemini Flash model takes image input.
const STABLE_FLASH = /^models\/gemini-(\d+(?:\.\d+)?)-flash(?:-(\d{3}))?$/;

async function pickModel(key: string): Promise<string> {
  const models: ListedModel[] = [];
  let pageToken: string | undefined;
  do {
    const url = `${API}/models?pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
    const page = (await paced(() => apiFetch(key, url))) as { models?: ListedModel[]; nextPageToken?: string };
    models.push(...(page.models ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);

  const candidates = models
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => ({ m, match: STABLE_FLASH.exec(m.name) }))
    .filter((c): c is { m: ListedModel; match: RegExpExecArray } => c.match !== null)
    .sort((a, b) => {
      const byVersion = Number(b.match[1]) - Number(a.match[1]);
      if (byVersion !== 0) return byVersion;
      // Same version: the plain alias first, then the newest -NNN pin.
      const sa = a.match[2] === undefined ? Infinity : Number(a.match[2]);
      const sb = b.match[2] === undefined ? Infinity : Number(b.match[2]);
      return sb - sa;
    });
  if (candidates.length === 0) throw new Error("No stable Flash model with generateContent in the models list");
  return candidates[0].m.name.replace(/^models\//, "");
}

const POINT_SCHEMA = {
  type: "OBJECT",
  properties: {
    color: { type: "STRING", enum: ["light", "dark", "none"] },
    count: { type: "INTEGER" },
  },
  required: ["color", "count"],
  propertyOrdering: ["color", "count"],
};

const ROW_SCHEMA = { type: "ARRAY", items: POINT_SCHEMA, minItems: 12, maxItems: 12 };

const PAIR_SCHEMA = {
  type: "OBJECT",
  properties: { light: { type: "INTEGER" }, dark: { type: "INTEGER" } },
  required: ["light", "dark"],
  propertyOrdering: ["light", "dark"],
};

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    topRow: ROW_SCHEMA,
    bottomRow: ROW_SCHEMA,
    bar: PAIR_SCHEMA,
    borneOff: PAIR_SCHEMA,
    dice: { type: "ARRAY", items: { type: "INTEGER" }, minItems: 0, maxItems: 2 },
    cube: {
      type: "OBJECT",
      properties: {
        visible: { type: "BOOLEAN" },
        value: { type: "INTEGER" },
        location: { type: "STRING", enum: ["center", "top", "bottom", "unknown"] },
      },
      required: ["visible", "value", "location"],
      propertyOrdering: ["visible", "value", "location"],
    },
    barSide: { type: "STRING" },
    confidence: { type: "STRING", enum: ["high", "medium", "low"] },
    notes: { type: "STRING" },
  },
  required: ["topRow", "bottomRow", "bar", "borneOff", "dice", "cube", "barSide", "confidence", "notes"],
  propertyOrdering: ["topRow", "bottomRow", "bar", "borneOff", "dice", "cube", "barSide", "confidence", "notes"],
};

interface GenerateResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

function extractLayout(raw: GenerateResponse): { parsed: unknown; parseError?: string } {
  const candidate = raw.candidates?.[0];
  if (!candidate) {
    return { parsed: null, parseError: `no candidates${raw.promptFeedback?.blockReason ? ` (blocked: ${raw.promptFeedback.blockReason})` : ""}` };
  }
  const text = (candidate.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
  if (!text) return { parsed: null, parseError: `empty text (finishReason ${candidate.finishReason ?? "?"})` };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return { parsed: null, parseError: `JSON parse failed: ${(e as Error).message}` };
  }
  const v = validateSnapLayout(json);
  // Keep what Gemini said even when it fails validation; step 2 can still show it.
  return v.ok ? { parsed: v.layout } : { parsed: json, parseError: v.errors.join("; ") };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error("GEMINI_API_KEY is not set (add it to .env).");
    process.exit(1);
  }

  const model = args.model ?? (await pickModel(key));
  console.log(`Model: ${model}${args.model ? " (from --model)" : " (auto-picked)"}, prompt ${args.prompt}`);
  const prompt = PROMPTS[args.prompt];

  const images = readdirSync(SNAP_DIR, { withFileTypes: true })
    .filter((d) => d.isFile() && IMAGE_TYPES[path.extname(d.name).toLowerCase()])
    .map((d) => d.name)
    .filter((name) => !args.only || name === args.only)
    .sort();
  if (images.length === 0) {
    console.error(args.only ? `No image named ${args.only} in snap-poc/.` : "No images in snap-poc/.");
    process.exit(1);
  }

  const outDir = path.join(SNAP_DIR, "results", model, args.prompt);
  mkdirSync(outDir, { recursive: true });

  const tally = { ok: 0, invalid: 0, skipped: 0, errors: 0 };
  let stoppedOn429 = false;

  for (const image of images) {
    const outFile = path.join(outDir, `${image}.json`);
    if (!args.force && existsSync(outFile)) {
      console.log(`${image}: skip (cached)`);
      tally.skipped++;
      continue;
    }

    const mimeType = IMAGE_TYPES[path.extname(image).toLowerCase()];
    const data = readFileSync(path.join(SNAP_DIR, image)).toString("base64");
    const body = {
      contents: [{ role: "user", parts: [{ inlineData: { mimeType, data } }, { text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
    };

    const started = Date.now();
    let raw: GenerateResponse;
    try {
      raw = (await paced(() =>
        apiFetch(key, `${API}/models/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      )) as GenerateResponse;
    } catch (e) {
      if (e instanceof RateLimited) {
        console.error(`${image}: HTTP 429 (rate limit / quota). Stopping the run; nothing retried.`);
        console.error(`  ${e.message}`);
        stoppedOn429 = true;
        break;
      }
      console.log(`${image}: error ${(e as Error).message}`);
      tally.errors++;
      continue;
    }
    const durationMs = Date.now() - started;

    const { parsed, parseError } = extractLayout(raw);
    const record = {
      model,
      promptVersion: args.prompt,
      image,
      createdAt: new Date().toISOString(),
      durationMs,
      raw,
      parsed,
      ...(parseError ? { parseError } : {}),
    };
    writeFileSync(outFile, JSON.stringify(record, null, 2) + "\n");

    if (parseError) {
      console.log(`${image}: INVALID (${parseError}) ${(durationMs / 1000).toFixed(1)}s`);
      tally.invalid++;
    } else {
      const layout = validateSnapLayout(parsed);
      if (!layout.ok) throw new Error("unreachable");
      const t = snapCheckerTotals(layout.layout);
      console.log(
        `${image}: OK light ${t.light}, dark ${t.dark}, confidence ${layout.layout.confidence}, ${(durationMs / 1000).toFixed(1)}s`,
      );
      tally.ok++;
    }
  }

  console.log(
    `\nSummary (${model}, prompt ${args.prompt}): ${tally.ok} OK, ${tally.invalid} invalid, ${tally.skipped} skipped, ${tally.errors} errors` +
      `${stoppedOn429 ? ", stopped on HTTP 429" : ""}. Results in snap-poc/results/${model}/${args.prompt}/`,
  );
  if (stoppedOn429 || tally.errors > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
