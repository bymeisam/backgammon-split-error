"use client";

import { createContext, useContext, useId, useState, type ReactNode } from "react";
import { style } from "./FilterDisclosure.styles";

// Lets a parent open the filters by default after the fact: the review
// session sets it when the URL has filters but no cards match.
export const FilterDefaultOpenContext = createContext(false);

// The list pages' filter: a one-line summary of the current filters
// ("Any phase · All severities", hidden below md), a "Filter" pill that
// shows or hides the filter form (the page's own GET form, unchanged), and
// optional links after it. Renders two siblings — the control group and the
// form row — for a flex-wrap parent: the form row takes a full line of its
// own below.
export default function FilterDisclosure({
  summary,
  defaultOpen = false,
  extra,
  children,
}: {
  summary: string;
  defaultOpen?: boolean;
  extra?: ReactNode;
  children: ReactNode;
}) {
  const contextOpen = useContext(FilterDefaultOpenContext);
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const open = userOpen ?? (defaultOpen || contextOpen);
  const panelId = useId();

  return (
    <>
      <div className={style.group}>
        <span className={style.summary}>{summary}</span>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setUserOpen(!open)}
          className={style.pill(open)}
        >
          Filter
        </button>
        {extra}
      </div>
      <div id={panelId} hidden={!open} className={style.panel}>
        {children}
      </div>
    </>
  );
}
