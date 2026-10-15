import { notFound } from "next/navigation";
import PageShell from "@/app/components/ui/PageShell";
import { requireMemberDocument } from "@/lib/app-auth";
import {
  allowedModel,
  isSnapPocEnabled,
  listSnapImages,
  listSnapModels,
  readSnapResult,
  readSnapTruth,
} from "@/lib/snapPocFiles";
import SnapPocReview, { type SnapPocItem } from "./SnapPocReview";

// Read per request: the photos, Gemini's answers and the saved truths are
// local files that change while the page is in use.
export const dynamic = "force-dynamic";

// Snaps proof-of-concept, step 2: a dev-only page (404 in production, not in
// the nav) to correct Gemini's reading of each photo in snap-poc/ and score it.
export default async function SnapPocPage({ searchParams }: { searchParams: Promise<{ model?: string }> }) {
  if (!isSnapPocEnabled()) notFound();
  await requireMemberDocument();

  const models = listSnapModels();
  const requested = (await searchParams).model;
  const model = requested !== undefined ? allowedModel(requested) : (models[0]?.model ?? null);
  if (requested !== undefined && !model) notFound();

  const items: SnapPocItem[] = listSnapImages().map((image) => {
    const result = model ? readSnapResult(model, image) : null;
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
      subtitle={`Correct the model's reading of each photo, then save it as the truth. Model: ${model ?? "none"}.`}
    >
      <SnapPocReview items={items} model={model} />
    </PageShell>
  );
}
