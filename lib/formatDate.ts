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

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const LONG_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// "5 Oct" — a match date in a table, with the year only when it isn't
// `now`'s ("5 Oct 2025"). Local time zone, as formatMatchDate.
export function formatShortMatchDate(iso: string, now: Date): string {
  const d = new Date(iso);
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

// "Thursday 8 October" — the dashboard's date line.
export function formatLongDay(d: Date): string {
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${LONG_MONTHS[d.getMonth()]}`;
}

// "7 Oct 2026, 15:25" — a local date and time (/matches/analysis's "Last
// computed").
export function formatDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
