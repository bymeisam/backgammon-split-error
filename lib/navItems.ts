// The app navbar's items and its active-route rule. Pure, so it's
// unit-tested; app/components/ui/AppNav.tsx builds the list on the server
// and NavLinks.tsx highlights the active one from the pathname.

export interface NavItem {
  href: string;
  label: string;
  // Sub-items, shown as a dropdown on wide screens (Review › Cards).
  children?: NavItem[];
  // Pinned to the right end of the bar (Settings, Status).
  end?: boolean;
  // The review due-count badge goes on this item (write mode only).
  showsDueCount?: boolean;
}

// Sources only with write mode on (isGalaxyEnabled()); proxy.ts 404s
// /sources and everything under it otherwise.
export function navItems(writeEnabled: boolean): NavItem[] {
  return [
    { href: "/matches", label: "Matches" },
    { href: "/matches/analysis", label: "Analysis" },
    { href: "/mistakes", label: "Mistakes" },
    { href: "/repeated-positions", label: "Repeated" },
    {
      href: "/review",
      label: "Review",
      showsDueCount: true,
      children: [{ href: "/review/cards", label: "Cards" }],
    },
    ...(writeEnabled ? [{ href: "/sources", label: "Sources" }] : []),
    { href: "/settings", label: "Settings", end: true },
    { href: "/status", label: "Status", end: true },
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
