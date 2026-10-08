import { prismaReadOnly as prisma } from "@/lib/prisma";
import { GALAXY_SOURCE } from "@/lib/externalMatchUrl";
import MatchAnalysis, { type MatchSummary } from "./MatchAnalysis";

// Read per request (the match row can change on a re-sync).
export const dynamic = "force-dynamic";

// /matches/[matchId]: one read-only lookup of the Match row for the header's
// sub line ("Match 47816592 · 5 Oct 2026 · 2–5"); everything else is the
// client part, which loads the games itself. Every match here is resolved
// under the Galaxy source (lib/local-client.ts), as the client part assumes.
// A failed lookup only drops the date and score: the page still works.
export default async function MatchAnalysisPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;

  let summary: MatchSummary | null = null;
  try {
    const match = await prisma.match.findUnique({
      where: { source_sourceMatchId: { source: GALAXY_SOURCE, sourceMatchId: matchId } },
      select: { playedAt: true, userScore: true, opponentScore: true },
    });
    if (match) {
      summary = {
        playedAt: match.playedAt ? match.playedAt.toISOString() : null,
        userScore: match.userScore,
        opponentScore: match.opponentScore,
      };
    }
  } catch (error) {
    console.error(`[match page] Match ${matchId} lookup failed:`, error);
  }

  return <MatchAnalysis summary={summary} />;
}
