import Badge from "./Badge";
import { badgeForSeverity, type SeverityKey } from "@/lib/badges";

export default function SeverityBadge({ type }: { type: SeverityKey }) {
  return <Badge config={badgeForSeverity(type)} />;
}
