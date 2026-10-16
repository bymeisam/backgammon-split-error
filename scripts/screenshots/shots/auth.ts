import { open, type Shot } from "../helpers";

// The auth set (--set=auth): the real Clerk screens, so no bypass.
export const AUTH_SHOTS: Shot[] = [
  {
    name: "sign-in",
    run: async ({ page, shoot }) => {
      await open(page, "/sign-in");
      await shoot("auth-sign-in", "full");
    },
  },
  {
    name: "auth-complete",
    run: async ({ page, shoot }) => {
      await open(page, "/auth/complete");
      await shoot("auth-complete", "full");
    },
  },
];
