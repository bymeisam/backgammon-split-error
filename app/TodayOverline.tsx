"use client";

import { formatLongDay } from "@/lib/formatDate";

// The dashboard's date overline ("Thursday 8 October") in the browser's own
// time zone, not the server's: deployed, the server runs in UTC, so a
// server-rendered date would show yesterday every morning until the user's
// UTC offset catches up. formatLongDay reads the local day, which on the
// client is the browser's. The server's render is replaced on hydration,
// so the mismatch warning is suppressed on this one text node.
export default function TodayOverline() {
  return <span suppressHydrationWarning>{formatLongDay(new Date())}</span>;
}
