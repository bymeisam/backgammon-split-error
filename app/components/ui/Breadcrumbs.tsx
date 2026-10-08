import Link from "next/link";
import { style } from "./Breadcrumbs.styles";

export interface Crumb {
  label: string;
  // Absent for the current page (the last crumb).
  href?: string;
}

// "Matches › opponent (123) › Game 2". Built by each page from data it
// already loads.
export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" data-testid="breadcrumbs">
      <ol className={style.list}>
        {items.map((crumb, i) => (
          <li key={`${i}-${crumb.label}`} className={style.item}>
            {i > 0 && (
              <span aria-hidden="true" className={style.separator}>
                ›
              </span>
            )}
            {crumb.href ? (
              <Link href={crumb.href} className={style.link}>
                {crumb.label}
              </Link>
            ) : (
              <span aria-current="page" className={style.current}>
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
