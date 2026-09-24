import Badge from "./Badge";
import { severityBadges } from "@/lib/badges";

export default function SeverityBadge({ type }: { type: keyof typeof severityBadges }) {
  return <Badge config={severityBadges[type]} />;
}
