"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeNavHref, isNavItemActive, type NavItem } from "@/lib/navItems";
import type { RuntimeModeLabel } from "@/lib/runtimeMode";
import { style } from "./AppNav.styles";

const MODE_TITLES: Record<RuntimeModeLabel, string> = {
  "Oracle · write": "Write mode: changes go to the Oracle database.",
  "Local · write": "Write mode: changes go to the local database.",
  "Read-only": "Read-only: nothing here writes to a database.",
};

// The navbar's client half: highlights the active route from the pathname
// and collapses the items into a menu on narrow screens. Everything that
// needs the server (the item list, the mode label, the due badge, the sync
// line) comes in as props from AppNav.
export default function NavLinks({
  items,
  modeLabel,
  dueBadge,
  syncControl,
  help,
}: {
  items: NavItem[];
  modeLabel: RuntimeModeLabel;
  dueBadge: ReactNode;
  syncControl: ReactNode;
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
    if (!item.children?.length) return <li key={item.href}>{link}</li>;
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
                className={style.link(active === child.href)}
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
    <header className={style.bar} data-testid="app-nav">
      <div className={style.inner}>
        <Link href="/" onClick={close} className={style.brand}>
          Game Review
        </Link>
        <span className={style.modeBadge(modeLabel)} title={MODE_TITLES[modeLabel]} data-testid="mode-badge">
          {modeLabel}
        </span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="app-nav-menu"
          className={style.menuButton}
        >
          Menu
        </button>
        <nav id="app-nav-menu" aria-label="Main" className={style.menu(open)}>
          <ul className={style.list}>{items.filter((i) => !i.end).map(renderItem)}</ul>
          <div className={style.endGroup}>
            {syncControl}
            <ul className={style.list}>{items.filter((i) => i.end).map(renderItem)}</ul>
            {help}
          </div>
        </nav>
      </div>
    </header>
  );
}
