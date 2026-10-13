import { requireOwnerDocument } from "@/lib/app-auth";
import GalaxyMatchDetail from "./GalaxyMatchDetail";

// The detail view itself is a client component (it holds the in-memory
// Galaxy token); this server wrapper runs the owner guard
// (lib/accessRules.ts), which the root layout's check alone can't
// guarantee: layouts don't re-render on client-side navigation.
export default async function GalaxyMatchAnalysisPage() {
  await requireOwnerDocument();
  return <GalaxyMatchDetail />;
}
