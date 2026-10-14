import PageShell from "@/app/components/ui/PageShell";
import Card from "@/app/components/ui/Card";
import { isAppWriteEnabled } from "@/lib/appWriteGate";
import { style } from "../forum.styles";
import NewPostForm from "./NewPostForm";
import { requireMemberDocument } from "@/lib/app-auth";

export const dynamic = "force-dynamic";

export default async function NewForumPostPage() {
  await requireMemberDocument();
  const canPost = isAppWriteEnabled();
  return (
    <PageShell width="medium" title="New forum post" breadcrumbs={[{ label: "Forum", href: "/forum" }, { label: "New post" }]}>
      {canPost ? <NewPostForm /> : <Card className={style.row}><p className={style.meta} data-testid="forum-posting-off">Posting is turned off on this deployment.</p></Card>}
    </PageShell>
  );
}
