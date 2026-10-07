// Tag names (Tag in prisma/schema.prisma): user text, trimmed, inner
// whitespace collapsed, at most TAG_MAX_LENGTH characters. Uniqueness is the
// database's: Tag.name's default case-insensitive collation makes "Prime"
// and "prime" one tag. Pure, so client and server share it.
export const TAG_MAX_LENGTH = 64;

export type NormalizedTag = { ok: true; name: string } | { ok: false; error: string };

export function normalizeTagName(input: unknown): NormalizedTag {
  if (typeof input !== "string") return { ok: false, error: "name must be a string." };
  const name = input.trim().replace(/\s+/g, " ");
  if (name.length === 0) return { ok: false, error: "Tag name can't be empty." };
  if (name.length > TAG_MAX_LENGTH) {
    return { ok: false, error: `Tag name is too long (max ${TAG_MAX_LENGTH} characters).` };
  }
  return { ok: true, name };
}

// Autocomplete: existing tags containing the typed text (case-insensitive),
// prefix matches first, excluding the ones already on the decision.
export function tagSuggestions(
  all: readonly { id: number; name: string }[],
  typed: string,
  exclude: ReadonlySet<number>,
  limit = 8
): { id: number; name: string }[] {
  const q = typed.trim().toLowerCase();
  const pool = all.filter((t) => !exclude.has(t.id));
  if (!q) return pool.slice(0, limit);
  const matches = pool.filter((t) => t.name.toLowerCase().includes(q));
  matches.sort((a, b) => {
    const ap = a.name.toLowerCase().startsWith(q) ? 0 : 1;
    const bp = b.name.toLowerCase().startsWith(q) ? 0 : 1;
    return ap - bp || a.name.localeCompare(b.name);
  });
  return matches.slice(0, limit);
}
