import Badge from "./Badge";
import { classificationBadges } from "@/lib/badges";

// `type` is constrained to the 17 known classification values at compile
// time. Callers with a DB-sourced string (not a literal) cast to this —
// classification values live in Galaxy's data, not this codebase, so a
// value outside the 17 mapped here is possible if Galaxy ever adds one;
// falls back to the raw string itself rather than crashing on a missing
// config entry.
export default function ClassificationBadge({ type }: { type: keyof typeof classificationBadges }) {
  const config = classificationBadges[type] ?? { code: type, label: type };
  return <Badge config={config} />;
}
