import { notFound } from "next/navigation";
import PageShell from "@/app/components/ui/PageShell";
import Card from "@/app/components/ui/Card";
import Board from "@/app/components/match-analysis/Board";
import { prismaReadOnly } from "@/lib/prisma";
import { decodeGnuMatchId } from "@/lib/gnuMatchId";
import { decodeGnuPositionId } from "@/lib/gnuPositionId";
import { style } from "../forum.styles";

export default async function ForumPostPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id); if (!Number.isInteger(id)) notFound();
  const post = await prismaReadOnly.forumPost.findUnique({ where: { id }, include: { author: { select: { displayName: true } }, positions: { orderBy: { displayOrder: "asc" }, include: { studyPosition: true } }, replies: { orderBy: { createdAt: "asc" }, include: { author: { select: { displayName: true } } } } } });
  if (!post) notFound();
  return <PageShell width="medium" title={post.title} breadcrumbs={[{ label: "Forum", href: "/forum" }, { label: post.title }]}><div className={style.stack}><Card className={style.row}><p className={style.meta}>{post.author.displayName} · {post.createdAt.toLocaleDateString()}</p><p className={style.body}>{post.body}</p></Card>{post.positions.map(({ studyPosition }) => { const position = decodeGnuPositionId(studyPosition.positionId); const match = decodeGnuMatchId(studyPosition.gnuMatchId); if (!match) return null; const owner = match.cubeOwner === null ? "center" : match.cubeOwner === match.diceOwner ? "mine" : "opponent"; return <div className={style.position} key={studyPosition.id}><Board decoded={position} roll={studyPosition.kind === "CHECKER" ? match.dice.filter((die) => die >= 1 && die <= 6) : []} rollSide={match.diceOwner === match.turn ? "mine" : "opponent"} cube={{ kind: "owned", value: match.cubeValue, owner: owner as "center" | "mine" | "opponent" }} /></div>; })}<Card className={style.row}><h2 className={style.title}>Replies</h2>{post.replies.length === 0 ? <p className={style.meta}>No replies yet.</p> : post.replies.map((reply) => <div className={style.reply} key={reply.id}><p className={style.meta}>{reply.author.displayName} · {reply.createdAt.toLocaleDateString()}</p><p className={style.body}>{reply.body}</p></div>)}</Card></div></PageShell>;
}
