import PageShell from "@/app/components/ui/PageShell";
import Card from "@/app/components/ui/Card";
import { isAppWriteEnabled } from "@/lib/appWriteGate";
import { parseId, rawMatchId, sourceDecision } from "@/lib/forum";
import { decodeForumPosition, forumPositionCaption } from "@/lib/forumPosition";
import { style } from "../forum.styles";
import NewPostForm, { type DecisionPreview } from "./NewPostForm";
import { requireMemberDocument } from "@/lib/app-auth";

// Read per request: the write gate depends on the running server's env, not
// the build's.
export const dynamic = "force-dynamic";

// /forum/new: the new-post form. Posting needs write mode
// (isAppWriteEnabled(), the same gate as POST /api/forum/posts), so with it
// off this page only says so instead of showing a form that can't submit.
// ?decision=<id> (from the replay) also gets a read-only preview of that
// decision's board, decoded the same way as on the post page.
export default async function NewForumPostPage({
  searchParams,
}: {
  searchParams: Promise<{ decision?: string }>;
}) {
  await requireMemberDocument();
  const canPost = isAppWriteEnabled();
  const { decision } = await searchParams;
  const preview = canPost && typeof decision === "string" ? await decisionPreview(decision) : null;

  return (
    <PageShell
      width="medium"
      title="New forum post"
      breadcrumbs={[{ label: "Forum", href: "/forum" }, { label: "New post" }]}
    >
      {canPost ? (
        <NewPostForm preview={preview} />
      ) : (
        <Card className={style.row}>
          <p className={style.meta} data-testid="forum-posting-off">
            Posting is turned off on this deployment.
          </p>
        </Card>
      )}
    </PageShell>
  );
}

// The preview for ?decision=<id>, or null when the id isn't a decision whose
// stored position and raw GNU Match ID decode (the form then shows the
// plain Decision ID field, as before).
async function decisionPreview(value: string): Promise<DecisionPreview | null> {
  const id = parseId(value);
  if (id === null) return null;
  const decision = await sourceDecision(id);
  if (!decision?.sourcePositionId) return null;
  if (decision.kind !== "CHECKER" && decision.kind !== "CUBE") return null;
  const gnuMatchId = rawMatchId(decision.raw);
  if (!gnuMatchId) return null;
  const decoded = decodeForumPosition(decision.sourcePositionId, gnuMatchId, decision.kind);
  if (!decoded) return null;
  return {
    decisionId: String(decision.id),
    position: decoded.position,
    cube: decoded.cube,
    dice: decoded.dice,
    caption: forumPositionCaption(decoded.match, decision.kind),
  };
}
