import { notFound } from "next/navigation";
import PageShell from "@/app/components/ui/PageShell";
import { requireMemberDocument } from "@/lib/app-auth";
import {
  allowedRun,
  isSnapPocEnabled,
  listSnapImages,
  listSnapRuns,
  readSnapResult,
  readSnapTruth,
} from "@/lib/snapPocFiles";
import SnapPocReview, { type SnapPocItem } from "./SnapPocReview";

// Read per request: the photos, Gemini's answers and the saved truths are
// local files that change while the page is in use.
export const dynamic = "force-dynamic";

// Snaps proof-of-concept, step 2: a dev-only page (404 in production, not in
// the nav) to correct Gemini's reading of each photo in snap-poc/ and score it.
export default async function SnapPocPage({ searchParams }: { searchParams: Promise<{ model?: string; version?: string }> }) {
  if (!isSnapPocEnabled()) notFound();
  await requireMemberDocument();

  // ?model=<folder>&version=<v> picks a results/<model>/<version>/ run;
  // default is the newest prompt version (listSnapRuns' first).
  const runs = listSnapRuns();
  const params = await searchParams;
  const requested = params.model !== undefined || params.version !== undefined;
  const run = requested ? allowedRun(params.model, params.version) : (runs[0] ?? null);
  if (requested && !run) notFound();

  const items: SnapPocItem[] = listSnapImages().map((image) => {
    const result = run ? readSnapResult(run, image) : null;
    return {
      image,
      gemini: result?.layout ?? null,
      parseError: result?.parseError ?? null,
      truth: readSnapTruth(image),
    };
  });

  return (
    <PageShell
      width="wide"
      title="Snaps review"
      subtitle={`Correct the model's reading of each photo, then save it as the truth. Model: ${run ? `${run.model}, prompt ${run.version}` : "none"}.`}
    >
      <SnapPocReview items={items} model={run?.model ?? null} promptVersion={run?.version ?? null} />
    </PageShell>
  );
}
