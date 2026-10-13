import { redirect } from "next/navigation";
import { requireOwnerDocument } from "@/lib/app-auth";

// /sources/galaxy has no page of its own: the Galaxy card lives on
// /sources, and this goes straight to the match list. Gated like the rest
// of /sources (proxy.ts).
export default async function GalaxySourcePage() {
  await requireOwnerDocument();
  redirect("/sources/galaxy/matches");
}
