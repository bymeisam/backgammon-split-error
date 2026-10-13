import { notFound } from "next/navigation";
import PageShell from "@/app/components/ui/PageShell";
import Card from "@/app/components/ui/Card";
import Board from "@/app/components/match-analysis/Board";
import CheckerMoveExplorer from "@/app/components/match-analysis/CheckerMoveExplorer";
import { prismaReadOnly } from "@/lib/prisma";
import { isGalaxyEnabled } from "@/lib/galaxyGate";
import { decodeGnuMatchId, diceRollFor } from "@/lib/gnuMatchId";
import { decodeGnuPositionId } from "@/lib/gnuPositionId";
import { style } from "../forum.styles";
import ForumActions from "./ForumActions";
import ReplyComposer from "./ReplyComposer";

// /forum/[id]: one post, its attached positions (checker positions get the
// move explorer, cube positions a plain board) and its replies.
export default async function ForumPostPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const post = await prismaReadOnly.forumPost.findUnique({
    where: { id },
    include: {
      author: { select: { displayName: true } },
      positions: { orderBy: { displayOrder: "asc" }, include: { studyPosition: true } },
      replies: { orderBy: { createdAt: "asc" }, include: { author: { select: { displayName: true } } } },
    },
  });
  if (!post) notFound();

  // Same gate as the forum write routes: off hides Edit, Delete and Reply.
  const canWrite = isGalaxyEnabled();

  return (
    <PageShell width="medium" title={post.title} breadcrumbs={[{ label: "Forum", href: "/forum" }, { label: post.title }]}>
      <div className={style.stack}>
        <Card className={style.row}>
          <p className={style.meta}>{post.author.displayName} · {post.createdAt.toLocaleDateString()}</p>
          <p className={style.body}>{post.body}</p>
          <ForumActions postId={post.id} title={post.title} body={post.body} canWrite={canWrite} />
        </Card>
        {post.positions.map(({ studyPosition }, index) => {
          const position = decodeGnuPositionId(studyPosition.positionId);
          const match = decodeGnuMatchId(studyPosition.gnuMatchId);
          if (!match) return null;

          // The GNU IDs are from the point of view of the player on roll
          // (diceOwner), which the board draws as "mine".
          const owner = match.cubeOwner === null ? "center" : match.cubeOwner === match.diceOwner ? "mine" : "opponent";
          const cube = {
            kind: "owned" as const,
            value: match.cubeValue,
            owner: owner as "center" | "mine" | "opponent",
          };
          const dice = diceRollFor(studyPosition.kind === "CHECKER" ? "move" : null, match);
          const originLabel =
            studyPosition.origin === "MATCH_DECISION"
              ? `From match decision ${studyPosition.sourceDecisionId ?? "unknown"}`
              : "Built in position builder";

          return (
            <div className={style.position} key={studyPosition.id}>
              <div className={style.attachmentMeta}>
                <span className={style.attachmentLabel}>Position {index + 1}</span>
                <span>{originLabel}</span>
                <span>{studyPosition.kind === "CHECKER" ? "Checker position" : "Cube position"}</span>
                <span className={style.identifier}>GNU Position ID: {studyPosition.positionId}</span>
                <span className={style.identifier}>GNU Match ID: {studyPosition.gnuMatchId}</span>
              </div>
              <div className={style.boardViewport}>
                {studyPosition.kind === "CHECKER" ? (
                  <CheckerMoveExplorer position={position} dice={dice} cube={cube} />
                ) : (
                  <Board decoded={position} cube={cube} />
                )}
              </div>
            </div>
          );
        })}
        <Card className={style.row}>
          <h2 className={style.title}>Replies</h2>
          {post.replies.length === 0 ? (
            <p className={style.meta}>No replies yet.</p>
          ) : (
            post.replies.map((reply) => (
              <div className={style.reply} key={reply.id}>
                <p className={style.meta}>
                  {reply.author.displayName} · {reply.createdAt.toLocaleDateString()}
                </p>
                <p className={style.body}>{reply.body}</p>
                <ForumActions postId={post.id} replyId={reply.id} replyBody={reply.body} canWrite={canWrite} />
              </div>
            ))
          )}
          <ReplyComposer postId={post.id} canWrite={canWrite} />
        </Card>
      </div>
    </PageShell>
  );
}
