import type { ComponentType, ReactNode } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { isGalaxyEnabled } from "@/lib/galaxyGate";
import { SOURCES, type Source, type SourceStatus } from "@/lib/sources";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import PageShell from "@/app/components/ui/PageShell";
import GalaxySourceActions from "./GalaxySourceActions";
import { style } from "./sources.styles";

// Each source's own client-side actions (token, sync), by source id. The
// card's links are passed in, so they share the actions' row.
const SOURCE_ACTIONS: Record<string, ComponentType<{ children?: ReactNode }>> = {
  galaxy: GalaxySourceActions,
};

function SourceCard({ source, status }: { source: Source; status: SourceStatus }) {
  const Actions = SOURCE_ACTIONS[source.id];
  const links = source.links.map((link) => (
    <Button key={link.href} href={link.href} size="compact">
      {link.label}
    </Button>
  ));
  return (
    <Card
      as="section"
      id={source.id}
      aria-labelledby={`source-${source.id}-title`}
      data-testid={`source-card-${source.id}`}
      className={style.card}
    >
      <div className={style.cardHeader}>
        <h2 id={`source-${source.id}-title`} className={style.cardTitle}>
          {source.label}
        </h2>
        <p className={style.cardDescription}>{source.description}</p>
      </div>
      <div className={style.status}>
        <span className={style.statusLabel}>{status.label}</span>
        <span className={style.statusValue} title={status.title}>
          {status.value}
        </span>
      </div>
      {Actions ? (
        <Actions>{links}</Actions>
      ) : (
        <div className={style.actionsRow}>{links}</div>
      )}
    </Card>
  );
}

// /sources: one card per data source (lib/sources.ts). Write mode only:
// proxy.ts 404s it otherwise, and the page checks the same gate itself so
// it can never render on the read-only site. Rendered per request (the
// gate reads the server's env, and the status is live).
export default async function SourcesPage() {
  await connection();
  if (!isGalaxyEnabled()) notFound();

  const now = new Date();
  const cards = await Promise.all(SOURCES.map(async (source) => ({ source, status: await source.status(now) })));

  return (
    <PageShell width="medium" title="Sources" subtitle="Where your matches come from.">
      <div className={style.cardList}>
        {cards.map(({ source, status }) => (
          <SourceCard key={source.id} source={source} status={status} />
        ))}
      </div>
    </PageShell>
  );
}
