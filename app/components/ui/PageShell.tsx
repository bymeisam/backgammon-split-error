import type { ReactNode } from "react";
import Breadcrumbs, { type Crumb } from "./Breadcrumbs";
import { style, type PageWidth } from "./PageShell.styles";

// The shared page container: background, width, padding, and the header
// (breadcrumbs, title, subtitle, actions). No hooks, so server and client
// pages both use it. The navbar is in the root layout, above this.
export default function PageShell({
  width = "wide",
  breadcrumbs,
  title,
  subtitle,
  actions,
  children,
}: {
  width?: PageWidth;
  breadcrumbs?: Crumb[];
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const hasCrumbs = Boolean(breadcrumbs && breadcrumbs.length > 0);

  return (
    <div className={style.pageContainer}>
      <main className={style.main}>
        <div className={style.column(width)}>
          {(hasCrumbs || title) && (
            <div className={style.header}>
              {hasCrumbs && <Breadcrumbs items={breadcrumbs!} />}
              {title && (
                <div className={style.titleRow}>
                  <div className={style.titleBlock}>
                    <h1 className={style.title}>{title}</h1>
                    {subtitle && <div className={style.subtitle}>{subtitle}</div>}
                  </div>
                  {actions && <div className={style.actions}>{actions}</div>}
                </div>
              )}
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
