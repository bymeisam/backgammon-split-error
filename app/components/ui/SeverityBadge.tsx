import Badge from "./Badge";
import { badgeForSeverity, type SeverityTier } from "@/lib/badges";

export default function SeverityBadge({ type }: { type: SeverityTier }) {
  return <Badge config={badgeForSeverity(type)} />;
}
