import { redirect } from "next/navigation";

// /sources/galaxy has no page of its own: the Galaxy card lives on
// /sources, and this goes straight to the match list. Gated like the rest
// of /sources (proxy.ts).
export default function GalaxySourcePage() {
  redirect("/sources/galaxy/matches");
}
