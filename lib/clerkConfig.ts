// Clerk's sign-in and after-auth paths, set in code. These replace the
// NEXT_PUBLIC_CLERK_SIGN_IN_URL, NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL
// and NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL env vars: the paths are
// the same in every environment and aren't secrets, and when the sign-in
// variable was missing from Vercel, Clerk sent signed-out visitors to its
// hosted Account Portal (accounts.<domain>/sign-in) instead of our page.
// Used by proxy.ts (clerkMiddleware), app/layout.tsx (ClerkProvider) and the
// sign-in page.

// Our own sign-in page (app/sign-in/[[...sign-in]]/page.tsx).
export const SIGN_IN_PATH = "/sign-in";

// Where Clerk returns after sign-in or sign-up; provisions the AppUser row
// (app/auth/complete/page.tsx).
export const AUTH_COMPLETE_PATH = "/auth/complete";
