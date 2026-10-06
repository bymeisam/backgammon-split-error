import { style } from "./GalaxyMismatchBadge.styles";

// Shown next to a cube decision's "best" label when the action derived from
// Galaxy's own equities (lib/cubeAction.ts) disagrees with Galaxy's
// best-action label. Galaxy's label goes in the tooltip. Renders nothing
// when there's no disagreement (galaxyLabel null/absent).
export default function GalaxyMismatchBadge({ galaxyLabel }: { galaxyLabel?: string | null }) {
  if (galaxyLabel == null) return null;
  return (
    <span
      data-testid="galaxy-mismatch-badge"
      className={style.badge}
      title={`Galaxy's own label: ${galaxyLabel || "none"}. The best action shown is worked out from Galaxy's equities.`}
    >
      Doesn&apos;t match Galaxy
    </span>
  );
}
