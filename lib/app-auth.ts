import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { prismaAuth, prismaReadOnly } from "@/lib/prisma";

type ClerkUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  privateMetadata: Record<string, unknown>;
};

export type AppAuthState = {
  clerkUserId: string;
  displayName: string;
  appUserExists: boolean;
  isOwner: boolean;
  clerkIsOwner: boolean;
};

function displayNameFor(user: ClerkUser): string {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "Clerk user";
}

function clerkOwnerFlag(user: ClerkUser): boolean {
  return user.privateMetadata.isOwner === true;
}

async function signedInUser(): Promise<{ userId: string; user: ClerkUser } | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  if (!user || user.id !== userId) return null;
  return { userId, user };
}

/** Reads the local identity and Clerk's private owner flag without writing. */
export async function getAppAuthState(): Promise<AppAuthState | null> {
  const signedIn = await signedInUser();
  if (!signedIn) return null;
  const appUser = await prismaReadOnly.appUser.findUnique({
    where: { clerkUserId: signedIn.userId },
    select: { isOwner: true },
  });
  return {
    clerkUserId: signedIn.userId,
    displayName: displayNameFor(signedIn.user),
    appUserExists: appUser !== null,
    isOwner: appUser?.isOwner ?? false,
    clerkIsOwner: clerkOwnerFlag(signedIn.user),
  };
}

/** Provisions the local identity and evaluates both independent owner flags. */
export async function provisionAppUser(): Promise<AppAuthState | null> {
  const signedIn = await signedInUser();
  if (!signedIn) return null;
  const displayName = displayNameFor(signedIn.user);
  const appUser = await prismaAuth.appUser.upsert({
    where: { clerkUserId: signedIn.userId },
    create: { clerkUserId: signedIn.userId, displayName },
    update: { displayName },
    select: { isOwner: true },
  });
  return {
    clerkUserId: signedIn.userId,
    displayName,
    appUserExists: true,
    isOwner: appUser.isOwner,
    clerkIsOwner: clerkOwnerFlag(signedIn.user),
  };
}

/** Route-handler guard: 401 for signed out, 404 for a non-owner or failures. */
export async function requireOwnerApi(): Promise<NextResponse | null> {
  try {
    const state = await getAppAuthState();
    if (!state) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!state.appUserExists || !state.isOwner || !state.clerkIsOwner) {
      return new NextResponse("Not Found", { status: 404 });
    }
    return null;
  } catch (error) {
    console.error("[auth] owner check failed:", error);
    return new NextResponse("Not Found", { status: 404 });
  }
}

/** Document guard for the root layout. */
export async function requireOwnerDocument(): Promise<AppAuthState> {
  try {
    const state = await getAppAuthState();
    if (!state) redirect("/sign-in");
    if (!state.appUserExists || !state.isOwner || !state.clerkIsOwner) redirect("/auth/complete");
    return state;
  } catch (error) {
    if (isNextNavigationSignal(error)) throw error;
    console.error("[auth] document owner check failed:", error);
    throw error;
  }
}

function isNextNavigationSignal(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) return false;
  const digest = error.digest;
  return typeof digest === "string" &&
    (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK;404"));
}
