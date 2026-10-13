import { requireOwnerDocument } from "@/lib/app-auth";
import GalaxyMatchesList from "./GalaxyMatchesList";

// The list itself is a client component (it holds the in-memory Galaxy
// token); this server wrapper runs the owner guard (lib/accessRules.ts),
// which the root layout's check alone can't guarantee: layouts don't
// re-render on client-side navigation.
export default async function GalaxyMatchesPage() {
  await requireOwnerDocument();
  return <GalaxyMatchesList />;
}
