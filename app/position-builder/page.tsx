import PageShell from "@/app/components/ui/PageShell";
import { isGalaxyEnabled } from "@/lib/galaxyGate";
import PositionBuilder from "./PositionBuilder";

// Read per request: the write gate depends on the running server's env, not
// the build's.
export const dynamic = "force-dynamic";

export default function PositionBuilderPage() {
  // Same gate as the forum write routes: off hides "Post to forum".
  const canPostToForum = isGalaxyEnabled();

  return (
    <PageShell
      width="wide"
      title="Position builder"
      subtitle="Set a board position and its match context before connecting it to save or analysis."
    >
      <PositionBuilder canPostToForum={canPostToForum} />
    </PageShell>
  );
}
