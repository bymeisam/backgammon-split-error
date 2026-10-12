import Link from "next/link";
import PageShell from "@/app/components/ui/PageShell";
import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";
import { prismaReadOnly } from "@/lib/prisma";
import { style } from "./forum.styles";

export const dynamic = "force-dynamic";

export default async function ForumPage() {
  const posts = await prismaReadOnly.forumPost.findMany({ orderBy: { createdAt: "desc" }, include: { author: { select: { displayName: true } }, _count: { select: { replies: true, positions: true } } } });
  return <PageShell width="medium" title="Forum" actions={<Button variant="primary" href="/forum/new">New post</Button>}>
    <div className={style.list}>{posts.length === 0 && <Card><p className={style.meta}>No posts yet.</p></Card>}
      {posts.map((post) => <Card key={post.id} className={style.row}><Link href={`/forum/${post.id}`} className={style.title}>{post.title}</Link><p className={style.meta}>{post.author.displayName} · {post.createdAt.toLocaleDateString()} · {post._count.replies} replies · {post._count.positions} position{post._count.positions === 1 ? "" : "s"}</p></Card>)}
    </div>
  </PageShell>;
}
