import type { ReactNode } from "react";
import Breadcrumbs, { type Crumb } from "./Breadcrumbs";
import { style, type PageVariant, type PageWidth } from "./PageShell.styles";

// The shared page container: background, width, padding, and the header
// (breadcrumbs, an overline, title, subtitle, actions). No hooks, so server
// and client pages both use it. The navbar is in the root layout, above this.
//
// `controls` (the list pages' Filter disclosure) sits inside the header
// block, 16px under the title row, so the page's section gap only separates
// the header from the content (reports/2026-10-08-design-review-phase1b.md
// §d.7).
//
// Variants (reports/2026-10-08-design-fidelity-spec.md):
//   - "page": list and summary pages — the display title (the dashboard's).
//   - "detail": the board pages with a header like the replay's — a smaller
//     serif title, the faint sub line, and no side padding below md (the
//     board runs edge to edge; blocks inset themselves).
//   - "session": the review session, which draws its own header (no title
//     here), also without side padding below md.
export default function PageShell({
  width = "wide",
  variant = "page",
  breadcrumbs,
  overline,
  title,
  subtitle,
  actions,
  controls,
  children,
}: {
  width?: PageWidth;
  variant?: PageVariant;
  breadcrumbs?: Crumb[];
  overline?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  controls?: ReactNode;
  children?: ReactNode;
}) {
  const hasCrumbs = Boolean(breadcrumbs && breadcrumbs.length > 0);

  return (
    <div className={style.pageContainer}>
      <main className={style.main(variant)}>
        <div className={style.column(width, variant)}>
          {(hasCrumbs || title || controls) && (
            <div className={style.header(variant)}>
              {hasCrumbs && <Breadcrumbs items={breadcrumbs!} />}
              {title && (
                <div className={style.titleRow(variant)}>
                  <div className={style.titleBlock}>
                    {overline && <p className={style.overline}>{overline}</p>}
                    <h1 className={style.title(variant, Boolean(overline))}>{title}</h1>
                    {subtitle && <div className={style.subtitle(variant)}>{subtitle}</div>}
                  </div>
                  {actions && <div className={style.actions}>{actions}</div>}
                </div>
              )}
              {controls && <div className={style.controls}>{controls}</div>}
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}

// A board page's title with the italic "vs": "Game 2 vs cbj2", "vs cbj2".
export function VsTitle({ lead, name }: { lead?: ReactNode; name: ReactNode }) {
  return (
    <>
      {lead}
      {lead ? " " : null}
      <span className={style.titleVs}>vs</span> {name}
    </>
  );
}
