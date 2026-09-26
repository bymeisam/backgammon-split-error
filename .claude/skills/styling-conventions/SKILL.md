---
name: styling-conventions
description: This project's Tailwind-organization convention — classes live in dedicated [name].styles.ts files, not inline in JSX. Load before writing or editing any component's className, adding a new page/component, or reviewing styling changes in this codebase.
---

# Styling conventions

Tailwind CSS remains the styling mechanism for this project — nothing
about *how* classes are written changes. What changes is *where* they
live: classes are organized into dedicated `[name].styles.ts` files next
to the component(s) they style, never written inline in JSX `className`
props.

Adopted gradually — a component that hasn't been touched since this
convention was introduced may still have inline classes. Don't do a
drive-by rewrite of unrelated components; apply this when you're already
adding or editing a component's styling, and follow it for anything new.

## Where a styles file lives, and what it covers

This project's real shared-component locations are `app/components/`
(`app/components/match-analysis/`, `app/components/ui/`) — **not**
`lib/`, which holds zero React components here (pure logic/types/Prisma
client). Adjust "shared location" to wherever your project's actual
reusable-component folder is; the rule is about promoted-vs-page-local,
not about a specific folder name.

- **A page** (`app/some-route/page.tsx`) gets one `[pageName].styles.ts`,
  colocated in that route's folder. It covers the page itself and every
  component used by that page, *as long as that component also lives
  inside the page's own folder* (e.g. a `page.tsx` that defines a couple
  of small subcomponents in the same file, or in sibling files in the
  same route folder).
- **A component promoted to the shared location** gets its own
  `[componentName].styles.ts`, colocated with it. It covers that
  component and any of its own subcomponents that live in the same
  folder — but only when those subcomponents are *exclusively* used by
  it. A subcomponent used independently by more than one shared parent is
  itself already "promoted" in practice (it's a shared leaf, not
  anyone's private subcomponent) and gets its own file instead of being
  folded into either parent's.
- **The rule of thumb**: a component only gets its own dedicated styles
  file once it's been promoted out of page-local scope into
  shared/reusable territory. While it's page-local, it shares the page's
  one file. Moving a component from a page folder into the shared
  location later means moving (or splitting out) its styles into their
  own file at that point — not before.
- **Genuinely cross-cutting values** — used across otherwise-unrelated
  pages/components, e.g. common badge padding, shared spacing tokens —
  live in exactly one file, `lib/styles/shared.styles.ts`. Not a folder of
  many; one file, imported wherever needed. Don't reach for this file
  until a value is actually duplicated across unrelated call sites — a
  value used by only one page or one shared component belongs in that
  page's or component's own file instead.

## File contents

Each `.styles.ts` file exports exactly one object:

```ts
export const style = { ... } as const;
```

- **Keys are camelCase, named for the element's purpose** —
  `boardContainer`, `checkerStack`, `activeRow` — never matching the HTML
  tag name or the raw CSS class string.
- **Plain string values for static classes**:
  ```ts
  boardContainer: "flex flex-col gap-4",
  ```
- **Function values for conditional classes.** 1–2 parameters are passed
  directly; 3+ parameters use a single options object:
  ```ts
  // 1–2 params: direct
  activeRow: (isActive: boolean) => clsx("rounded-lg px-3 py-1.5", isActive && "bg-blue-50"),

  // 3+ params: one options object
  moveBadge: (opts: { isActive: boolean; severity: "blunder" | "error" }) =>
    clsx(
      "rounded-lg border px-3 py-1.5",
      opts.severity === "blunder" ? "border-red-300 text-red-700" : "border-amber-300 text-amber-700",
      opts.isActive && "ring-1 ring-inset ring-black/30"
    ),
  ```
- **Function entries are typed normally.** `as const` on the outer object
  doesn't touch function signatures — give every function entry explicit
  parameter and return types the way you would anywhere else in the
  codebase; don't rely on inference alone.
- **Use `clsx` for conditional composition inside function-valued
  entries.** Don't hand-roll template-literal string concatenation for
  conditionals — that's exactly the pattern this convention replaces.

## Usage in components

Import the scope's `style` object and reference its entries — never write
an inline Tailwind class directly in JSX once a component has a styles
file:

```tsx
import { style } from "./thisPage.styles";
// or, for a promoted component:
// import { style } from "./ThisComponent.styles";

<div className={style.boardContainer}>
  <button className={style.activeRow(isActive)}>...</button>
</div>
```

If a component still has zero classes migrated (not yet touched under
this convention), leave it as-is rather than doing an unrelated rewrite —
see "Adopted gradually" above.

## Concrete example

A small illustrative slice — one page, one page-local subcomponent (lives
in the page's own folder), and one shared/promoted component — showing
all three placement cases plus both a plain-string and a function-valued
entry.

**Page-local:** `app/widgets/page.tsx` defines `WidgetRow` right there in
the same file (or a sibling file in `app/widgets/`), so both are covered
by one file, `app/widgets/widgets.styles.ts`:

```ts
// app/widgets/widgets.styles.ts
import clsx from "clsx";

export const style = {
  pageContainer: "flex flex-col gap-6 px-6 py-12",
  // Function, 2 params -> passed directly.
  widgetRow: (isSelected: boolean, isStale: boolean) =>
    clsx(
      "flex items-center justify-between rounded-lg border px-3 py-2",
      isSelected ? "border-blue-400 bg-blue-50" : "border-black/10",
      isStale && "opacity-60"
    ),
} as const;
```

```tsx
// app/widgets/page.tsx
import { style } from "./widgets.styles";

function WidgetRow({ widget, isSelected }: { widget: Widget; isSelected: boolean }) {
  return (
    <div className={style.widgetRow(isSelected, widget.isStale)}>{widget.name}</div>
  );
}

export default function WidgetsPage() {
  return (
    <div className={style.pageContainer}>
      {widgets.map((w) => (
        <WidgetRow key={w.id} widget={w} isSelected={w.id === selectedId} />
      ))}
    </div>
  );
}
```

**Promoted/shared:** `WidgetCard` has been pulled out to
`app/components/WidgetCard.tsx` because it's now used by both
`app/widgets/page.tsx` and `app/dashboard/page.tsx`. It gets its own file:

```ts
// app/components/WidgetCard.styles.ts
export const style = {
  // Plain string, static.
  card: "rounded-xl border border-black/10 bg-white p-4 shadow-sm",
} as const;
```

```tsx
// app/components/WidgetCard.tsx
import { style } from "./WidgetCard.styles";

export default function WidgetCard({ widget }: { widget: Widget }) {
  return <div className={style.card}>{widget.name}</div>;
}
```

**Cross-cutting:** both `widgets.styles.ts` and `WidgetCard.styles.ts`
independently need the same badge padding used elsewhere too (say, on an
unrelated settings page) — that value moves to the one shared file:

```ts
// lib/styles/shared.styles.ts
export const style = {
  badgePadding: "px-2.5 py-1",
} as const;
```

```ts
// app/components/WidgetCard.styles.ts
import { style as shared } from "@/lib/styles/shared.styles";

export const style = {
  card: "rounded-xl border border-black/10 bg-white p-4 shadow-sm",
  badge: `inline-flex items-center rounded-full ${shared.badgePadding} text-xs`,
} as const;
```

## Real example in this codebase

`app/components/match-analysis/BoardPanel.styles.ts` and
`app/components/match-analysis/Dice.styles.ts` (both shared/promoted —
`BoardPanel` is used across `/matches/[matchId]`,
`/galaxy/matches/[matchId]`, and `/mistakes`; `Dice` is used
independently by both `BoardPanel`'s render tree and
`MistakesSection.tsx`, so it isn't exclusively either one's subcomponent
and got its own file too), plus each of those three pages' own
page-local `[pageName].styles.ts` where they had page-local classes of
their own. See those files for the first real application of this
convention, including a real function-valued entry with the 3+ param
options-object form (`BoardPanel.styles.ts`'s move-badge styling).
