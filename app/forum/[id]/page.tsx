import Link from "next/link";
import { notFound } from "next/navigation";
import PageShell from "@/app/components/ui/PageShell";
import Card from "@/app/components/ui/Card";
import Board from "@/app/components/match-analysis/Board";
import CheckerMoveExplorer from "@/app/components/match-analysis/CheckerMoveExplorer";
import { prismaReadOnly } from "@/lib/prisma";
import { isGalaxyEnabled } from "@/lib/galaxyGate";
import { decodeForumPosition, forumPositionCaption } from "@/lib/forumPosition";
import { replayHref } from "@/lib/replayHref";
import { formatShortMatchDate } from "@/lib/formatDate";
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
      positions: {
        orderBy: { displayOrder: "asc" },
        include: {
          // The source decision only for the replay link; never its raw.
          studyPosition: {
            include: {
              sourceDecision: {
                select: { id: true, game: { select: { gameIndex: true, match: { select: { sourceMatchId: true } } } } },
              },
            },
          },
        },
      },
      replies: { orderBy: { createdAt: "asc" }, include: { author: { select: { displayName: true } } } },
    },
  });
  if (!post) notFound();

  // Same gate as the forum write routes: off hides Edit, Delete and Reply.
  const canWrite = isGalaxyEnabled();
  const now = new Date();

  return (
    <PageShell width="medium" title={post.title} breadcrumbs={[{ label: "Forum", href: "/forum" }, { label: post.title }]}>
      <div className={style.stack}>
        <Card className={style.row}>
          <p className={style.meta}>{post.author.displayName} · {formatShortMatchDate(post.createdAt.toISOString(), now)}</p>
          <p className={style.body}>{post.body}</p>
          <ForumActions postId={post.id} title={post.title} body={post.body} canWrite={canWrite} />
        </Card>
        {post.positions.map(({ studyPosition }, index) => {
          const decoded = decodeForumPosition(studyPosition.positionId, studyPosition.gnuMatchId, studyPosition.kind);
          if (!decoded) return null;
          const { position, match, cube, dice } = decoded;
          const source = studyPosition.sourceDecision;

          return (
            <div className={style.position} key={studyPosition.id}>
              <div className={style.attachmentMeta}>
                <p className={style.caption}>
                  <span className={style.attachmentLabel}>Position {index + 1}</span> ·{" "}
                  {forumPositionCaption(match, studyPosition.kind)}
                </p>
                {source ? (
                  <Link
                    className={style.originLink}
                    href={replayHref(source.game.match.sourceMatchId, source.game.gameIndex, source.id)}
                  >
                    From the game →
                  </Link>
                ) : (
                  <span>Built in position builder</span>
                )}
                <details className={style.gnuIds}>
                  <summary className={style.gnuIdsSummary}>GNU IDs</summary>
                  <span className={style.identifier}>GNU Position ID: {studyPosition.positionId}</span>
                  <span className={style.identifier}>GNU Match ID: {studyPosition.gnuMatchId}</span>
                </details>
              </div>
              {studyPosition.kind === "CHECKER" ? (
                <CheckerMoveExplorer position={position} dice={dice} cube={cube} />
              ) : (
                <Board decoded={position} cube={cube} />
              )}
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
                  {reply.author.displayName} · {formatShortMatchDate(reply.createdAt.toISOString(), now)}
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
