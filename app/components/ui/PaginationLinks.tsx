import Link from "next/link";
import { pageHref } from "@/lib/listParams";
import { style } from "./PaginationLinks.styles";

// Prev / "Page N of M" / Next for a server-rendered, query-param-paginated
// list. `params` are the current filters, carried over into both links.
// A disabled link keeps href="#" and is styled non-interactive.
export default function PaginationLinks({
  basePath,
  params,
  page,
  totalPages,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  totalPages: number;
}) {
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className={style.row}>
      <Link href={hasPrev ? pageHref(basePath, params, page - 1) : "#"} className={style.link(!hasPrev)}>
        Prev
      </Link>
      <span className={style.pageIndicator}>
        Page {page} of {totalPages}
      </span>
      <Link href={hasNext ? pageHref(basePath, params, page + 1) : "#"} className={style.link(!hasNext)}>
        Next
      </Link>
    </div>
  );
}
