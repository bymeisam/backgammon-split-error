import { requireMemberDocument } from "@/lib/app-auth";
import MatchesList from "./MatchesList";

// The list itself is a client component (it pages through
// /api/matches/list); this server wrapper runs the member guard
// (lib/accessRules.ts), which the root layout's check alone can't
// guarantee: layouts don't re-render on client-side navigation.
export default async function MatchesPage() {
  await requireMemberDocument();
  return <MatchesList />;
}
