import Badge from "./Badge";
import { badgeForClassification } from "@/lib/badges";

// `type` is any raw classification string — classification values live in
// Galaxy's data, not this codebase, so an unmapped one falls back to the
// raw string itself rather than crashing (see lib/badges.ts).
export default function ClassificationBadge({ type }: { type: string }) {
  return <Badge config={badgeForClassification(type)} />;
}
