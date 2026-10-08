import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Design-system guardrails (docs/design-system.md, "Do and don't"). Two
// checks over the source, comments ignored:
//
// 1. Tokens only. No hex or rgb()/hsl() colour, no raw Tailwind palette
//    class (zinc-500, bg-black, text-white…), no arbitrary colour value
//    ([#…], [rgb(…)]), and no hard-coded font family. Colours and fonts
//    live in the theme files (app/themes/*.css, not scanned) and reach
//    the code as tokens: bg-surface, text-ink-muted, font-serif…
// 2. No "Galaxy" in general UI. The app is source-neutral; Galaxy is named
//    only on its own pages, its link, and source-specific code.
//
// A real exception goes in an allowlist below, with its reason.

const ROOT = path.resolve(__dirname, "..");

function walk(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { recursive: true, encoding: "utf8" })
    .map((p) => path.posix.join(dir, p.split(path.sep).join("/")))
    .filter((p) => /\.tsx?$/.test(p));
}

// Never scanned: generated code, tests and their fixtures (they assert on
// literal values), type declarations.
function isScannable(file: string): boolean {
  return (
    !file.startsWith("lib/generated/") &&
    !file.includes("__fixtures__/") &&
    !/\.test\.tsx?$/.test(file) &&
    !file.endsWith(".d.ts")
  );
}

// Every app/**/*.styles.ts and app/**/*.tsx, and every lib/**/*.ts
// (lib/styles/ included).
const STYLE_FILES = [
  ...walk("app").filter((f) => f.endsWith(".styles.ts") || f.endsWith(".tsx")),
  ...walk("lib").filter((f) => f.endsWith(".ts")),
]
  .filter(isScannable)
  .sort();

// The page and component code that renders text: app/**/*.ts(x) and lib/
// (where labels and hints are built).
const UI_TEXT_FILES = [...walk("app"), ...walk("lib")].filter(isScannable).sort();

// The source with every comment blanked out (newlines kept, so line numbers
// hold). Strings and template literals are kept; JSX comments are block
// comments inside braces, so they go too. Single- and double-quoted
// strings end at a newline, so an apostrophe in JSX text can't swallow
// more than its own line.
export function stripComments(src: string): string {
  let out = "";
  let i = 0;
  type Mode = "code" | "sq" | "dq" | "tpl" | "line" | "block";
  let mode: Mode = "code";
  // Brace depth inside each open ${…} of a template literal.
  const tplBraces: number[] = [];
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    switch (mode) {
      case "code":
        if (c === "/" && next === "/") {
          mode = "line";
          out += "  ";
          i += 2;
          continue;
        }
        if (c === "/" && next === "*") {
          mode = "block";
          out += "  ";
          i += 2;
          continue;
        }
        if (c === "'") mode = "sq";
        else if (c === '"') mode = "dq";
        else if (c === "`") mode = "tpl";
        else if (c === "{" && tplBraces.length > 0) tplBraces[tplBraces.length - 1]++;
        else if (c === "}" && tplBraces.length > 0) {
          if (tplBraces[tplBraces.length - 1] === 0) {
            tplBraces.pop();
            mode = "tpl";
          } else tplBraces[tplBraces.length - 1]--;
        }
        out += c;
        i++;
        continue;
      case "sq":
      case "dq":
        if (c === "\\") {
          out += c + (next ?? "");
          i += 2;
          continue;
        }
        if ((mode === "sq" && c === "'") || (mode === "dq" && c === '"') || c === "\n") mode = "code";
        out += c;
        i++;
        continue;
      case "tpl":
        if (c === "\\") {
          out += c + (next ?? "");
          i += 2;
          continue;
        }
        if (c === "`") mode = "code";
        else if (c === "$" && next === "{") {
          tplBraces.push(0);
          mode = "code";
          out += "${";
          i += 2;
          continue;
        }
        out += c;
        i++;
        continue;
      case "line":
        if (c === "\n") {
          mode = "code";
          out += c;
        } else out += " ";
        i++;
        continue;
      case "block":
        if (c === "*" && next === "/") {
          mode = "code";
          out += "  ";
          i += 2;
          continue;
        }
        out += c === "\n" ? c : " ";
        i++;
        continue;
    }
  }
  return out;
}

const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const COLOR_UTILITY =
  "bg|text|border(?:-[trblxyse])?|ring(?:-offset)?|outline|fill|stroke|decoration|divide|from|via|to|shadow|accent|caret|placeholder";

export const TOKEN_RULES = {
  hex: /(?<![&\w])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/,
  colorFunction: /\b(?:rgba?|hsla?|oklch|oklab|hwb)\(/,
  paletteClass: new RegExp(`\\b(?:${PALETTE})-(?:50|[1-9]00|950)\\b`),
  blackWhiteClass: new RegExp(`\\b(?:${COLOR_UTILITY})-(?:black|white)\\b`),
  // A colour-mix of tokens (bg-[color-mix(in_srgb,var(--color-accent)_9%,…)])
  // is fine; a literal inside one is caught by hex/colorFunction.
  arbitraryColor: /-\[(?:#|(?:rgba?|hsla?|oklch|oklab|hwb)\(|color:)/,
  fontFamily:
    /\bfont-\[|\bfontFamily\b|font-family|\b(?:Geist|Newsreader|Inter|Playfair|JetBrains|Arial|Helvetica|Georgia|Times New Roman|Menlo|Monaco|Consolas|Roboto|Courier|SF Mono)\b/,
} as const;
type TokenRule = keyof typeof TOKEN_RULES;

// Legitimate exceptions to the token rules: [file, rule, reason].
const TOKEN_ALLOWLIST: [string, TokenRule, string][] = [
  ["app/layout.tsx", "fontFamily", "Loads every theme's fonts through next/font; the themes point --theme-font-* at them."],
  ["lib/themes.ts", "fontFamily", "The theme registry names each theme's fonts, for the Settings page to describe."],
];

export function tokenViolations(file: string, src: string): string[] {
  const found: string[] = [];
  stripComments(src)
    .split("\n")
    .forEach((line, n) => {
      for (const [rule, re] of Object.entries(TOKEN_RULES) as [TokenRule, RegExp][]) {
        if (!re.test(line)) continue;
        if (TOKEN_ALLOWLIST.some(([f, r]) => f === file && r === rule)) continue;
        found.push(`${file}:${n + 1} [${rule}] ${line.trim()}`);
      }
    });
  return found;
}

// Where naming Galaxy is right: [path prefix, reason], or [path prefix,
// reason, phrase] to allow only lines containing that phrase.
const GALAXY_ALLOWLIST: [string, string, string?][] = [
  ["app/galaxy/", "The Galaxy pages: the live Galaxy match list and its token."],
  ["app/api/galaxy/", "The routes that proxy Galaxy's API."],
  ["app/api/sync/", "Sync pulls from Galaxy."],
  ["app/status/notes.ts", "/status describes the architecture, data source included."],
  ["app/components/ui/SyncControl.tsx", "The navbar's sync control: syncing needs the Galaxy token, pasted on the Galaxy page."],
  ["lib/externalMatchUrl.ts", "The \"View on Galaxy\" link helper."],
  ["lib/analysis/galaxy", "The Galaxy translator and readers (lib/analysis/galaxy.ts, galaxyFields.ts)."],
  ["lib/ingest.ts", "Ingest from Galaxy."],
  ["lib/sync.ts", "Sync from Galaxy."],
  ["lib/galaxy", "Galaxy's API client, endpoints, gate and list helpers (lib/galaxy*.ts)."],
  ["lib/navItems.ts", "The navbar item that opens the Galaxy pages (write mode only).", 'label: "Galaxy"'],
  ["lib/sequentialGames.ts", "galaxyGamesError's messages, shown only on /galaxy/matches/[matchId].", "Galaxy API"],
];

// The external-link label: shown only next to externalMatchUrl's link,
// which exists only for a Galaxy match.
const GALAXY_ALLOWED_PHRASES = ["View on Galaxy"];

export function galaxyViolations(file: string, src: string): string[] {
  const entries = GALAXY_ALLOWLIST.filter(([prefix]) => file.startsWith(prefix));
  if (entries.some(([, , phrase]) => phrase === undefined)) return [];
  const found: string[] = [];
  stripComments(src)
    .split("\n")
    .forEach((line, n) => {
      if (entries.some(([, , phrase]) => phrase !== undefined && line.includes(phrase))) return;
      let text = line;
      for (const phrase of GALAXY_ALLOWED_PHRASES) text = text.split(phrase).join("");
      if (/\bGalaxy\b/.test(text)) found.push(`${file}:${n + 1} ${line.trim()}`);
    });
  return found;
}

describe("stripComments", () => {
  it("blanks line, block and JSX comments and keeps strings", () => {
    const src = [
      'const a = "#fff"; // #000',
      "/* rgb(0 0 0) */ const b = `x ${'//'} y`;",
      "<p>{/* Galaxy */}Don't</p>",
      "// Galaxy (the apostrophe above didn't open a string past its line)",
      "const c = 'https://x' + \"//y\";",
    ].join("\n");
    const out = stripComments(src).split("\n");
    expect(out[0]).toContain('"#fff"');
    expect(out[0]).not.toContain("#000");
    expect(out[1]).not.toContain("rgb(");
    expect(out[1]).toContain("`x ${'//'} y`");
    expect(out[2]).not.toContain("Galaxy");
    expect(out[3]).not.toContain("Galaxy");
    expect(out[4]).toContain("'https://x'");
    expect(out[4]).toContain('"//y"');
  });
});

describe("the rules catch what they should", () => {
  it("flags hex, rgb/hsl, palette classes, black/white, arbitrary colours and font names", () => {
    const f = "app/x.styles.ts";
    expect(tokenViolations(f, 'a: "text-[#36d399]",')).toHaveLength(2); // hex + arbitrary
    expect(tokenViolations(f, 'a: "border-zinc-200 dark:bg-slate-900",')).toHaveLength(1);
    expect(tokenViolations(f, 'a: "bg-black text-white/80",')).toHaveLength(1);
    expect(tokenViolations(f, "fill: 'rgb(0 0 0 / 0.3)',")).toHaveLength(1);
    expect(tokenViolations(f, 'a: "font-[Georgia]",')).toHaveLength(1);
    expect(tokenViolations(f, "a: { fontFamily: x },")).toHaveLength(1);
  });

  it("leaves tokens, comments and look-alikes alone", () => {
    const f = "app/x.styles.ts";
    const ok = [
      'a: "bg-surface text-ink-muted border-line-strong font-serif font-display",',
      'b: "shadow-[0_1px_2px_var(--shadow-color)] text-best-ink bg-blunder/40",',
      "// bg-zinc-100 #36D399 rgb(0 0 0)",
      'c: "&#123;", d: href="#top", e: "Game #2",',
    ];
    for (const line of ok) expect(tokenViolations(f, line), line).toEqual([]);
  });

  it("flags Galaxy in UI text but not identifiers, comments or the link label", () => {
    const f = "app/x/page.tsx";
    expect(galaxyViolations(f, "<p>Synced from Galaxy</p>")).toHaveLength(1);
    expect(galaxyViolations(f, 'title="Galaxy token"')).toHaveLength(1);
    expect(galaxyViolations(f, "if (isGalaxyEnabled()) createGalaxyClient();")).toEqual([]);
    expect(galaxyViolations(f, "// Galaxy's own lists")).toEqual([]);
    expect(galaxyViolations(f, "<a>View on Galaxy ↗</a>")).toEqual([]);
    expect(galaxyViolations("app/galaxy/matches/page.tsx", "<h1>Galaxy matches</h1>")).toEqual([]);
  });
});

describe("the codebase", () => {
  it("scans the UI files", () => {
    expect(STYLE_FILES).toContain("lib/styles/shared.styles.ts");
    expect(STYLE_FILES).toContain("app/components/ui/Button.styles.ts");
    expect(STYLE_FILES).toContain("app/page.tsx");
    expect(STYLE_FILES.length).toBeGreaterThan(50);
  });

  it("uses tokens: no hex or rgb/hsl colours, palette classes, arbitrary colours or font names", () => {
    const found = STYLE_FILES.flatMap((f) => tokenViolations(f, readFileSync(path.join(ROOT, f), "utf8")));
    expect(found, found.join("\n")).toEqual([]);
  });

  it("keeps every token allowlist entry needed", () => {
    for (const [file, rule] of TOKEN_ALLOWLIST) {
      const src = stripComments(readFileSync(path.join(ROOT, file), "utf8"));
      expect(TOKEN_RULES[rule].test(src), `${file} still needs its ${rule} exception`).toBe(true);
    }
  });

  it("keeps every Galaxy allowlist entry pointing at real files", () => {
    for (const [prefix, , phrase] of GALAXY_ALLOWLIST) {
      const files = UI_TEXT_FILES.filter((f) => f.startsWith(prefix));
      expect(files.length, `${prefix} matches no file`).toBeGreaterThan(0);
      if (phrase !== undefined) {
        const used = files.some((f) => stripComments(readFileSync(path.join(ROOT, f), "utf8")).includes(phrase));
        expect(used, `${prefix}: "${phrase}" is gone`).toBe(true);
      }
    }
  });

  it("doesn't name Galaxy in general UI text", () => {
    const found = UI_TEXT_FILES.flatMap((f) => galaxyViolations(f, readFileSync(path.join(ROOT, f), "utf8")));
    expect(found, found.join("\n")).toEqual([]);
  });
});
