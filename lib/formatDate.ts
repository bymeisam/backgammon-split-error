// Fixed abbreviations rather than Intl.DateTimeFormat: browsers/Node disagree
// on locale output for "short month" (e.g. Node gives "Sept", not "Sep"), so
// this keeps the "22 Sep 2026" format deterministic across environments.
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// "22 Sep 2026", in the viewer's local time zone.
export function formatMatchDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
