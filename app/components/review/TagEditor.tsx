"use client";

import { useMemo, useState } from "react";
import { normalizeTagName, tagSuggestions, TAG_MAX_LENGTH } from "@/lib/review/tags";
import type { DecisionTagRef } from "@/lib/review/types";
import { useEffectiveTags, useReviewState } from "@/app/providers/ReviewStateProvider";
import { style } from "./TagEditor.styles";

// The user's tags on one decision (DecisionTag). Editable (canEdit, i.e.
// write mode on): chips with ×, and an input with autocomplete from existing
// tags — Enter adds the typed tag (creating it if new), ↑/↓ pick a
// suggestion. Read-only: the chips alone, or nothing when there are none.
// Never rendered for a decision without a DB id (/galaxy).
export default function TagEditor({
  dbDecisionId,
  tags,
  canEdit,
}: {
  dbDecisionId: number;
  tags: DecisionTagRef[] | undefined;
  canEdit: boolean;
}) {
  const current = useEffectiveTags({ dbDecisionId, tags });
  const { recordTags, allTags, loadAllTags } = useReviewState();
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentIds = useMemo(() => new Set(current.map((t) => t.id)), [current]);
  const suggestions = useMemo(
    () => (open && allTags ? tagSuggestions(allTags, draft, currentIds) : []),
    [open, allTags, draft, currentIds]
  );

  if (!canEdit) {
    if (current.length === 0) return null;
    return (
      <div data-testid="tag-editor" className={style.wrapper}>
        <span className={style.label}>Tags</span>
        <div className={style.chipRow}>
          {current.map((t) => (
            <span key={t.id} className={style.chip}>
              {t.name}
            </span>
          ))}
        </div>
      </div>
    );
  }

  async function add(name: string) {
    const normalized = normalizeTagName(name);
    if (!normalized.ok) {
      setError(normalized.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tags/attach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionId: dbDecisionId, name: normalized.name }),
      });
      const json = (await res.json().catch(() => null)) as { tag?: DecisionTagRef; error?: string } | null;
      if (!res.ok || !json?.tag) {
        setError(json?.error ?? `Couldn't add the tag (HTTP ${res.status}).`);
        return;
      }
      const tag = json.tag;
      if (!current.some((t) => t.id === tag.id)) {
        recordTags(dbDecisionId, [...current, tag].sort((a, b) => a.name.localeCompare(b.name)));
      }
      if (!allTags?.some((t) => t.id === tag.id)) loadAllTags(true);
      setDraft("");
      setActive(-1);
    } catch {
      setError("Couldn't add the tag (network error).");
    } finally {
      setBusy(false);
    }
  }

  async function remove(tag: DecisionTagRef) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tags/detach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionId: dbDecisionId, tagId: tag.id }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(json?.error ?? `Couldn't remove the tag (HTTP ${res.status}).`);
        return;
      }
      recordTags(
        dbDecisionId,
        current.filter((t) => t.id !== tag.id)
      );
    } catch {
      setError("Couldn't remove the tag (network error).");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-testid="tag-editor" className={style.wrapper}>
      <span className={style.label}>Tags</span>
      {current.length > 0 && (
        <div className={style.chipRow}>
          {current.map((t) => (
            <span key={t.id} className={style.chip}>
              {t.name}
              <button
                type="button"
                aria-label={`Remove tag ${t.name}`}
                disabled={busy}
                onClick={() => remove(t)}
                className={style.chipRemove}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className={style.inputWrapper}>
        <input
          type="text"
          value={draft}
          maxLength={TAG_MAX_LENGTH}
          placeholder="Add a tag…"
          aria-label="Add a tag"
          disabled={busy}
          onFocus={() => {
            setOpen(true);
            loadAllTags();
          }}
          onBlur={() => setOpen(false)}
          onChange={(e) => {
            setDraft(e.target.value);
            setActive(-1);
            setOpen(true);
          }}
          // Keep typing from reaching page-level keyboard shortcuts (the
          // replay's ←/→ stepping, the review session's keys).
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, suggestions.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, -1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const picked = active >= 0 ? suggestions[active]?.name : draft;
              if (picked) add(picked);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          className={style.input}
        />
        {suggestions.length > 0 && (
          <div className={style.suggestions} role="listbox">
            {suggestions.map((t, i) => (
              <button
                key={t.id}
                type="button"
                role="option"
                aria-selected={i === active}
                // mousedown, not click: the input's blur would close the list first.
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(t.name);
                }}
                className={style.suggestion(i === active)}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>
      {error && <span className={style.error}>{error}</span>}
    </div>
  );
}
