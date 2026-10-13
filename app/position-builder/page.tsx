import PageShell from "@/app/components/ui/PageShell";
import { isForumWriteEnabled } from "@/lib/forumGate";
import PositionBuilder from "./PositionBuilder";
import { requireMemberDocument } from "@/lib/app-auth";

// Read per request: the write gate depends on the running server's env, not
// the build's.
export const dynamic = "force-dynamic";

export default async function PositionBuilderPage() {
  await requireMemberDocument();
  // Same gate as the forum write routes: off hides "Post to forum".
  const canPostToForum = isForumWriteEnabled();

  return (
    <PageShell
      width="wide"
      title="Position builder"
      subtitle="Set up a position and its match context, then post it to the forum."
    >
      <PositionBuilder canPostToForum={canPostToForum} />
    </PageShell>
  );
}
