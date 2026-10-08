"use client";

import type { Dispatch, SetStateAction } from "react";
import Button from "./Button";
import { style } from "./Pager.styles";

// Prev / "Page N of M" / Next buttons for a client-side paged list (the
// server-rendered, link-based equivalent is PaginationLinks). `page` is the
// requested page, driving the buttons; `shownPage` is the page of the data
// currently on screen — they differ while the next page is loading, and the
// label deliberately tracks what's shown.
export default function Pager({
  page,
  shownPage,
  totalPages,
  setPage,
}: {
  page: number;
  shownPage: number;
  totalPages: number;
  setPage: Dispatch<SetStateAction<number>>;
}) {
  return (
    <div className={style.row}>
      <Button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
        Prev
      </Button>
      <span className={style.pageIndicator}>
        Page {shownPage} of {totalPages}
      </span>
      <Button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
        Next
      </Button>
    </div>
  );
}
