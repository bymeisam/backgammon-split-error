import { redirect } from "next/navigation";
import { provisionAppUser } from "@/lib/app-auth";
import { isMemberOrOwner } from "@/lib/appRole";
import { SIGN_IN_PATH } from "@/lib/clerkConfig";
import { style } from "./complete.styles";

export const dynamic = "force-dynamic";

export default async function AuthCompletePage() {
  const state = await provisionAppUser();
  if (!state) redirect(SIGN_IN_PATH);
  // An invited member or the owner goes straight in; NONE (set by hand to
  // cut someone off) stays here (lib/appRole.ts).
  if (isMemberOrOwner(state.role)) redirect("/");
  return (
    <main className={style.page}>
      <p className={style.eyebrow}>Private owner access</p>
      <h1 className={style.title}>Welcome, {state.displayName}</h1>
      <p className={style.pending}>Your account is signed in but awaiting owner approval. No application data is available yet.</p>
    </main>
  );
}
