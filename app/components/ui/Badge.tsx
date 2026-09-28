import { style } from "./Badge.styles";

// Generic compact badge — plain HTML `title` for the tooltip, no JS library.
// No knowledge of "severity" or "classification" baked in; those live in
// lib/badges.ts's config maps and the typed wrapper components built on
// top of this (SeverityBadge, ClassificationBadge).
export type BadgeConfig = {
  code: string; // short display text, e.g. "B" or "OMB"
  label: string; // full text for the tooltip, e.g. "Blunder" or "One Man Back"
  color?: string; // Tailwind text-color classes; border reuses it via border-current
};

export default function Badge({ config, className = "" }: { config: BadgeConfig; className?: string }) {
  return (
    <span title={config.label} className={style.badge(config.color, className)}>
      {config.code}
    </span>
  );
}
