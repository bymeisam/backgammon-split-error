import PageShell from "@/app/components/ui/PageShell";
import Card from "@/app/components/ui/Card";
import { isGalaxyEnabled } from "@/lib/galaxyGate";
import { style } from "../forum.styles";
import NewPostForm from "./NewPostForm";

// Read per request: the write gate depends on the running server's env, not
// the build's.
export const dynamic = "force-dynamic";

// /forum/new: the new-post form. Posting needs write mode
// (isGalaxyEnabled(), the same gate as POST /api/forum/posts), so with it
// off this page only says so instead of showing a form that can't submit.
export default function NewForumPostPage() {
  const canPost = isGalaxyEnabled();

  return (
    <PageShell
      width="medium"
      title="New forum post"
      breadcrumbs={[{ label: "Forum", href: "/forum" }, { label: "New post" }]}
    >
      {canPost ? (
        <NewPostForm />
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
