import "server-only";
import { cache } from "react";
import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { notFound, redirect } from "next/navigation";
import { prismaAuth, prismaReadOnly } from "@/lib/prisma";
import { isLocalAuthBypass, localBypassIdentity } from "@/lib/localAuthBypass";
import { isMemberOrOwner, resolveAppRole, type AppRole } from "@/lib/appRole";

export type { AppRole } from "@/lib/appRole";

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
  // The effective role (lib/appRole.ts): OWNER needs DB role OWNER plus
  // Clerk's privateMetadata.isOwner; MEMBER is an invited member; NONE is
  // signed in but awaiting approval (or no AppUser row yet).
  role: AppRole;
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

/**
 * Reads the local identity and Clerk's private owner flag without writing,
 * and resolves the role. Null when signed out. Cached per request, so the
 * layout, the navbar and the page share one lookup.
 */
export const getAppAuthState = cache(async (): Promise<AppAuthState | null> => {
  if (isLocalAuthBypass()) {
    const { clerkUserId, displayName, role } = localBypassIdentity();
    return { clerkUserId, displayName, role };
  }
  const signedIn = await signedInUser();
  if (!signedIn) return null;
  const appUser = await prismaReadOnly.appUser.findUnique({
    where: { clerkUserId: signedIn.userId },
    select: { role: true },
  });
  return {
    clerkUserId: signedIn.userId,
    displayName: displayNameFor(signedIn.user),
    role: resolveAppRole(appUser?.role ?? null, clerkOwnerFlag(signedIn.user)),
  };
});

/** The signed-in viewer's role, or null when signed out. */
export async function getAppRole(): Promise<AppRole | null> {
  return (await getAppAuthState())?.role ?? null;
}

/** Whether the viewer is the owner (owner-only UI and data on shared pages). */
export async function isOwnerViewer(): Promise<boolean> {
  return (await getAppRole()) === "OWNER";
}

/**
 * Provisions the local identity (new rows start as NONE, awaiting approval)
 * and resolves the role. Under the local AUTH_BYPASS, upserts the bypass
 * user with its role (owner, or member with AUTH_BYPASS_ROLE=member).
 */
export async function provisionAppUser(): Promise<AppAuthState | null> {
  if (isLocalAuthBypass()) {
    const { clerkUserId, displayName, role } = localBypassIdentity();
    await prismaAuth.appUser.upsert({
      where: { clerkUserId },
      create: { clerkUserId, displayName, role },
      update: { displayName, role },
    });
    return { clerkUserId, displayName, role };
  }
  const signedIn = await signedInUser();
  if (!signedIn) return null;
  const displayName = displayNameFor(signedIn.user);
  const appUser = await prismaAuth.appUser.upsert({
    where: { clerkUserId: signedIn.userId },
    create: { clerkUserId: signedIn.userId, displayName, role: "NONE" },
    update: { displayName },
    select: { role: true },
  });
  return {
    clerkUserId: signedIn.userId,
    displayName,
    role: resolveAppRole(appUser.role, clerkOwnerFlag(signedIn.user)),
  };
}

// Route-handler guard: 401 when signed out, 404 when the role isn't allowed
// (or the check fails), null to carry on.
async function apiGuard(allowed: (role: AppRole) => boolean, label: string): Promise<NextResponse | null> {
  try {
    const state = await getAppAuthState();
    if (!state) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!allowed(state.role)) return new NextResponse("Not Found", { status: 404 });
    return null;
  } catch (error) {
    console.error(`[auth] ${label} check failed:`, error);
    return new NextResponse("Not Found", { status: 404 });
  }
}

/** Route-handler guard for owner-only APIs (lib/accessRules.ts tier "owner"). */
export async function requireOwnerApi(): Promise<NextResponse | null> {
  return apiGuard((role) => role === "OWNER", "owner");
}

/** Route-handler guard for member APIs (tier "member"): members and the owner. */
export async function requireMemberApi(): Promise<NextResponse | null> {
  return apiGuard(isMemberOrOwner, "member");
}

/**
 * Document guard for member pages (the root layout, lib/accessRules.ts tier
 * "member"): signed out goes to /sign-in, NONE to /auth/complete.
 */
export async function requireMemberDocument(): Promise<AppAuthState> {
  try {
    const state = await getAppAuthState();
    if (!state) redirect("/sign-in");
    if (!isMemberOrOwner(state.role)) redirect("/auth/complete");
    return state;
  } catch (error) {
    if (isNextNavigationSignal(error)) throw error;
    console.error("[auth] document member check failed:", error);
    throw error;
  }
}

/**
 * Document guard for owner pages (tier "owner"): as requireMemberDocument,
 * and a member gets a 404.
 */
export async function requireOwnerDocument(): Promise<AppAuthState> {
  const state = await requireMemberDocument();
  if (state.role !== "OWNER") notFound();
  return state;
}

function isNextNavigationSignal(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) return false;
  const digest = error.digest;
  return typeof digest === "string" &&
    (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK;404"));
}
