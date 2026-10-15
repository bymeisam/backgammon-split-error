// The app navbar's items and its active-route rule. Pure, so it's
// unit-tested; app/components/ui/AppNav.tsx builds the list on the server
// and NavLinks.tsx highlights the active one from the pathname.

import type { AppRole } from "@/lib/appRole";

export interface NavItem {
  href: string;
  label: string;
  // Sub-items, shown as a dropdown on wide screens (Review › Cards).
  children?: NavItem[];
  // Pinned to the right end of the bar (Sources, Settings, Status): the
  // admin pages, apart from the study pages.
  end?: boolean;
  // The review due-count badge goes on this item (app writes on only).
  showsDueCount?: boolean;
}

// Sources only with the Galaxy/sync gate on (isSyncEnabled()); proxy.ts 404s
// /sources and everything under it otherwise. It's in the end group, first
// (Sources · Settings · Status): you visit it to sync, not to study.
// Review, Sources and Status are owner-only (lib/accessRules.ts), so a
// member (or anyone not the owner) never sees them.
export function navItems(galaxyEnabled: boolean, role: AppRole | null): NavItem[] {
  const isOwner = role === "OWNER";
  return [
    { href: "/matches", label: "Matches" },
    { href: "/matches/analysis", label: "Analysis" },
    { href: "/mistakes", label: "Mistakes" },
    { href: "/repeated-positions", label: "Repeated" },
    { href: "/forum", label: "Forum" },
    ...(isOwner
      ? [
          {
            href: "/review",
            label: "Review",
            showsDueCount: true,
            children: [{ href: "/review/cards", label: "Cards" }],
          },
        ]
      : []),
    ...(isOwner && galaxyEnabled ? [{ href: "/sources", label: "Sources", end: true }] : []),
    { href: "/settings", label: "Settings", end: true },
    ...(isOwner ? [{ href: "/status", label: "Status", end: true }] : []),
  ];
}

function flatten(items: readonly NavItem[]): NavItem[] {
  return items.flatMap((item) => [item, ...flatten(item.children ?? [])]);
}

// The href of the most specific item the pathname is at or under, or null.
// Most specific wins, so /matches/analysis is Analysis (not Matches), while
// /matches/123 and its replay stay Matches; /review/cards is Cards.
export function activeNavHref(pathname: string, items: readonly NavItem[]): string | null {
  let best: string | null = null;
  for (const { href } of flatten(items)) {
    const matches = pathname === href || pathname.startsWith(`${href}/`);
    if (matches && (best === null || href.length > best.length)) best = href;
  }
  return best;
}

// An item is highlighted when it, or one of its sub-items, is the active one
// (Review stays highlighted on /review/cards).
export function isNavItemActive(item: NavItem, activeHref: string | null): boolean {
  if (activeHref === null) return false;
  return flatten([item]).some((i) => i.href === activeHref);
}
