import type { BadgeConfig } from "@/lib/badges";
import { style } from "./Badge.styles";

// Generic compact badge — plain HTML `title` for the tooltip, no JS library.
// No knowledge of "severity" or "classification" baked in; those live in
// lib/badges.ts (BadgeConfig itself, the config maps, and their lookups)
// and the typed wrapper components built on top of this (SeverityBadge,
// ClassificationBadge).
export default function Badge({ config, className = "" }: { config: BadgeConfig; className?: string }) {
  return (
    <span title={config.label} className={style.badge(config.color, className)}>
      {config.code}
    </span>
  );
}
