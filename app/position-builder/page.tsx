import PageShell from "@/app/components/ui/PageShell";
import PositionBuilder from "./PositionBuilder";

export default function PositionBuilderPage() {
  return (
    <PageShell
      width="wide"
      title="Position builder"
      subtitle="Set a board position and its match context before connecting it to save or analysis."
    >
      <PositionBuilder />
    </PageShell>
  );
}
