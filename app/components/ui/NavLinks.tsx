"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeNavHref, isNavItemActive, type NavItem } from "@/lib/navItems";
import type { RuntimeModeLabel } from "@/lib/runtimeMode";
import { style } from "./AppNav.styles";

const MODE_TITLES: Record<RuntimeModeLabel, string> = {
  "Oracle · write": "Write mode: changes go to the Oracle database, and pages read from it too.",
  "Local · write": "Write mode: changes go to the local database, and pages read from it too.",
  "Writes: Oracle · Reads: Local":
    "Write mode, two databases. Writes: changes (sync, notes, reviews, tags) go to the Oracle database. Reads: pages show data from the local database.",
  "Writes: Local · Reads: Oracle":
    "Write mode, two databases. Writes: changes (sync, notes, reviews, tags) go to the local database. Reads: pages show data from the Oracle database.",
  "Read-only": "Read-only: nothing here writes to a database.",
};

// The brand mark: two overlapping checkers.
function BrandMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={style.brandMark}>
      <circle cx={9} cy={12} r={7.5} className={style.brandMarkBack} />
      <circle cx={15.5} cy={12} r={7} strokeWidth={1.5} className={style.brandMarkFront} />
    </svg>
  );
}

function ModeBadge({ label, placement }: { label: RuntimeModeLabel; placement: "bar" | "end" }) {
  return (
    <span
      className={style.modeBadge(label, placement)}
      title={MODE_TITLES[label]}
      data-testid={placement === "end" ? "mode-badge" : undefined}
    >
      {label}
    </span>
  );
}

// The navbar's client half: highlights the active route from the pathname
// and, below lg, folds the items into a sheet under the bar. Everything that
// needs the server (the item list, the mode label, the due badge, the "?"
// help) comes in as props from AppNav, and each renders once:
// one DOM tree, laid out as a row from lg and as the sheet below it.
export default function NavLinks({
  items,
  modeLabel,
  dueBadge,
  help,
}: {
  items: NavItem[];
  modeLabel: RuntimeModeLabel;
  dueBadge: ReactNode;
  help: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const active = activeNavHref(pathname, items);
  const close = () => setOpen(false);

  function renderItem(item: NavItem) {
    const link = (
      <Link
        href={item.href}
        onClick={close}
        aria-current={active === item.href ? "page" : undefined}
        className={style.link(isNavItemActive(item, active))}
      >
        {item.label}
        {item.showsDueCount && dueBadge}
      </Link>
    );
    if (!item.children?.length) return <li key={item.href} className={style.item}>{link}</li>;
    return (
      <li key={item.href} className={style.itemWithChildren}>
        {link}
        <ul className={style.subList}>
          {item.children.map((child) => (
            <li key={child.href}>
              <Link
                href={child.href}
                onClick={close}
                aria-current={active === child.href ? "page" : undefined}
                className={style.subLink(active === child.href)}
              >
                {child.label}
              </Link>
            </li>
          ))}
        </ul>
      </li>
    );
  }

  return (
    <header className={style.bar} data-testid="app-nav" data-app-nav="">
      <div className={style.inner}>
        <Link href="/" onClick={close} className={style.brand}>
          <BrandMark />
          <span className={style.brandText}>Game Review</span>
        </Link>
        <span className={style.narrowEnd}>
          <ModeBadge label={modeLabel} placement="bar" />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="app-nav-menu"
            className={style.menuButton}
          >
            Menu
          </button>
        </span>
        <nav id="app-nav-menu" aria-label="Main" className={style.menu(open)}>
          <ul className={style.list}>{items.filter((i) => !i.end).map(renderItem)}</ul>
          <div className={style.endGroup}>
            <ModeBadge label={modeLabel} placement="end" />
            <div className={style.footRow}>
              {items
                .filter((i) => i.end)
                .map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={close}
                    aria-current={active === item.href ? "page" : undefined}
                    className={style.endLink(active === item.href)}
                  >
                    {item.label}
                  </Link>
                ))}
              {help}
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
}
