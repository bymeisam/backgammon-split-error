import type { ReactNode } from "react";
import FilterDisclosure from "./FilterDisclosure";
import Button from "./Button";
import { style } from "./FilterBar.styles";

// A list page's filter: the FilterDisclosure (the one-line summary and the
// "Filter" pill) around a plain GET form of FilterSelects and an Apply
// button. The form submits the filters as query params, so it works from a
// server component with no client state. Pass it to PageShell's `controls`
// (or, on /review, the session bar).
//
//   <FilterBar summary="Any phase · All severities" defaultOpen={!hasFilter}>
//     <FilterSelect label="Phase" name="phase" … />
//     <FilterSelect label="Severity" name="severity" … />
//   </FilterBar>
export default function FilterBar({
  summary,
  defaultOpen,
  extra,
  className,
  children,
}: {
  summary: string;
  defaultOpen?: boolean;
  // Links after the pill (e.g. "Manage cards").
  extra?: ReactNode;
  // Extra classes on the form, from the caller's own styles file.
  className?: string;
  // The FilterSelects (and their Suspense fallbacks).
  children: ReactNode;
}) {
  return (
    <FilterDisclosure summary={summary} defaultOpen={defaultOpen} extra={extra}>
      <form method="get" className={style.form(className)}>
        {children}
        <Button type="submit">Apply</Button>
      </form>
    </FilterDisclosure>
  );
}
