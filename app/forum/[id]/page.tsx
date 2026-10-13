import Link from "next/link";
import { notFound } from "next/navigation";
import PageShell from "@/app/components/ui/PageShell";
import Card from "@/app/components/ui/Card";
import Board from "@/app/components/match-analysis/Board";
import CheckerMoveExplorer from "@/app/components/match-analysis/CheckerMoveExplorer";
import { prismaReadOnly } from "@/lib/prisma";
import { isAppWriteEnabled } from "@/lib/appWriteGate";
import { forumViewer } from "@/lib/forum";
import { canDeleteForumItem, canEditForumItem } from "@/lib/forumPermissions";
import { decodeForumPosition, forumPositionCaption } from "@/lib/forumPosition";
import { replayHref } from "@/lib/replayHref";
import { formatShortMatchDate } from "@/lib/formatDate";
import { style } from "../forum.styles";
import ForumActions from "./ForumActions";
import ReplyComposer from "./ReplyComposer";
import DecisionAnalysisPanel from "./DecisionAnalysisPanel";
import { forumPostAnalyses } from "@/lib/forumAnalysis";
import { tallyProposals, type ProposalTallyInput } from "@/lib/forumProposals";
import type { ProposalTallyViewModel, ReplyProposalViewModel } from "./proposalTypes";
import PositionProposalTally from "./ProposalDisplay";
import { ReplyProposalChip } from "./ProposalDisplay";
import { requireMemberDocument } from "@/lib/app-auth";

// /forum/[id]: one post, its attached positions (checker positions get the
// move explorer, cube positions a plain board, and a game-sourced position
// a collapsed "Show analysis" panel unless the author hid it) and its
// replies.
export default async function ForumPostPage({ params }: { params: Promise<{ id: string }> }) {
  await requireMemberDocument();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const post = await prismaReadOnly.forumPost.findUnique({
    where: { id },
    include: {
      author: { select: { displayName: true } },
      positions: {
        orderBy: { displayOrder: "asc" },
        include: {
          // The source decision for the replay link, plus its raw and its
          // match's source for the engine analysis. raw stays on the server:
          // only forumPostAnalyses' sanitized result (no played move) is
          // passed to the client panel.
          studyPosition: {
            include: {
              sourceDecision: {
                select: {
                  id: true,
                  raw: true,
                  game: { select: { gameIndex: true, match: { select: { sourceMatchId: true, source: true } } } },
                },
              },
            },
          },
        },
      },
      replies: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { displayName: true } },
          proposals: { include: { studyPosition: { select: { id: true, positionId: true, gnuMatchId: true, kind: true } } } },
        },
      },
    },
  });
  if (!post) notFound();

  // Same gate as the forum write routes: off hides Edit, Delete and Reply.
  // With it on, Edit is the author's only; Delete is the author's, or the
  // owner's on anyone's post or reply (lib/forumPermissions.ts).
  const canWrite = isAppWriteEnabled();
  const viewer = canWrite ? await forumViewer() : null;
  const actionsFor = (authorAppUserId: number) => ({
    canEdit: canWrite && canEditForumItem(viewer, authorAppUserId),
    canDelete: canWrite && canDeleteForumItem(viewer, authorAppUserId),
  });
  const now = new Date();

  // The engine analysis per position (none when the author hid it, and none
  // for built positions). Sanitized server-side: no played move.
  const analyses = forumPostAnalyses(
    post.hideAnalysis,
    post.positions.map(({ studyPosition: { sourceDecision } }) =>
      sourceDecision ? { source: sourceDecision.game.match.source, raw: sourceDecision.raw } : null
    )
  );
  const hasGamePosition = post.positions.some(({ studyPosition }) => studyPosition.sourceDecision !== null);
  const decodedByPositionId = new Map(post.positions.map(({ studyPosition }) => [
    studyPosition.id,
    decodeForumPosition(studyPosition.positionId, studyPosition.gnuMatchId, studyPosition.kind),
  ]));
  const proposalPositions = post.positions.flatMap(({ studyPosition }, index) => {
    const decoded = decodedByPositionId.get(studyPosition.id);
    if (!decoded) return [];
    return [{
      id: studyPosition.id,
      label: `Position ${index + 1} · ${forumPositionCaption(decoded.match, studyPosition.kind)}`,
      kind: studyPosition.kind,
      position: decoded.position,
      positionId: studyPosition.positionId,
      dice: decoded.dice,
      match: decoded.match,
      cube: decoded.cube,
    }];
  });

  return (
    <PageShell width="medium" title={post.title} breadcrumbs={[{ label: "Forum", href: "/forum" }, { label: post.title }]}>
      <div className={style.stack}>
        <Card className={style.row}>
          <p className={style.meta}>{post.author.displayName} · {formatShortMatchDate(post.createdAt.toISOString(), now)}</p>
          <p className={style.body}>{post.body}</p>
          <ForumActions
            postId={post.id}
            title={post.title}
            body={post.body}
            replyCount={post.replies.length}
            hasGamePosition={hasGamePosition}
            hideAnalysis={post.hideAnalysis}
            {...actionsFor(post.authorAppUserId)}
          />
        </Card>
        {post.positions.map(({ studyPosition }, index) => {
          const decoded = decodedByPositionId.get(studyPosition.id);
          if (!decoded) return null;
          const { position, match, cube, dice } = decoded;
          const source = studyPosition.sourceDecision;
          const analysis = analyses[index];
          const positionLabel = `Position ${index + 1} · ${forumPositionCaption(match, studyPosition.kind)}`;
          const positionProposals: ProposalTallyInput[] = post.replies.flatMap((reply) => reply.proposals
            .filter((proposal) => proposal.studyPositionId === studyPosition.id)
            .map((proposal) => proposal.cubeAction
              ? { key: `${reply.id}:${proposal.id}`, proposalId: proposal.id, kind: "CUBE" as const, cubeAction: proposal.cubeAction }
              : { key: `${reply.id}:${proposal.id}`, proposalId: proposal.id, notation: proposal.notation!, kind: "CHECKER" as const, resultPositionId: proposal.resultPositionId! }));
          const grouped = tallyProposals(positionProposals);
          const proposals: ProposalTallyViewModel[] = grouped.map((item) => {
            let proposal: ReplyProposalViewModel;
            let proposalId: number;
            if (item.kind === "CUBE") {
              const first = positionProposals.find((candidate): candidate is Extract<ProposalTallyInput, { kind: "CUBE" }> =>
                candidate.kind === "CUBE" && candidate.cubeAction === item.cubeAction)!;
              proposal = { kind: "CUBE", key: first.key, positionLabel, cubeAction: item.cubeAction, position, cube };
              proposalId = first.proposalId;
            } else {
              const first = positionProposals.find((candidate): candidate is Extract<ProposalTallyInput, { kind: "CHECKER" }> =>
                candidate.kind === "CHECKER" && candidate.resultPositionId === item.resultPositionId)!;
              proposal = { kind: "CHECKER", key: first.key, positionLabel, notation: first.notation, position, dice, cube, resultPositionId: item.resultPositionId };
              proposalId = first.proposalId;
            }
            return { key: proposal.key, proposalId, count: item.count, proposal };
          });
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
              {analysis && <DecisionAnalysisPanel analysis={analysis} />}
              <PositionProposalTally proposals={proposals} />
            </div>
          );
        })}
        <Card className={style.row}>
          <h2 className={style.title}>Replies</h2>
          {post.replies.length === 0 ? (
            <p className={style.meta}>No replies yet.</p>
          ) : (
            post.replies.map((reply) => {
              const proposals = reply.proposals.flatMap<ReplyProposalViewModel>((proposal) => {
                const option = proposalPositions.find((candidate) => candidate.id === proposal.studyPositionId);
                if (!option) return [];
                return proposal.cubeAction
                  ? [{ kind: "CUBE" as const, key: `${reply.id}:${proposal.id}`, positionLabel: option.label, cubeAction: proposal.cubeAction, position: option.position, cube: option.cube }]
                  : [{ kind: "CHECKER" as const, key: `${reply.id}:${proposal.id}`, positionLabel: option.label, notation: proposal.notation!, position: option.position, dice: option.dice, cube: option.cube, resultPositionId: proposal.resultPositionId! }];
              });
              return (
                <div className={style.reply} key={reply.id}>
                  <p className={style.meta}>
                    {reply.author.displayName} · {formatShortMatchDate(reply.createdAt.toISOString(), now)}
                  </p>
                  <p className={style.body}>{reply.body}</p>
                  {proposals.map((proposal) => <ReplyProposalChip key={proposal.key} proposal={proposal} />)}
                  <ForumActions
                    postId={post.id}
                    replyId={reply.id}
                    replyBody={reply.body}
                    {...actionsFor(reply.authorAppUserId)}
                  />
                </div>
              );
            })
          )}
          <ReplyComposer postId={post.id} canWrite={canWrite} positions={proposalPositions} />
        </Card>
      </div>
    </PageShell>
  );
}
