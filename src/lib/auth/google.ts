import { safeNextPath } from "./routes";

// Sign in with Google (docs/superpowers/specs/2026-11-26-google-signin-design.md). Pure: the client button and the
// /auth/callback/google route both import it.

/** Where the button keeps ?next= while the user is at Google (the redirect URL itself stays query-free). */
export const OAUTH_NEXT_COOKIE = "gc_oauth_next";
export const OAUTH_NEXT_MAX_AGE = 600;
export const GOOGLE_CALLBACK_PATH = "/auth/callback/google";

/** NEXT_PUBLIC_GOOGLE_AUTH turns the buttons on only when it is exactly "on" (otherwise the placeholder stays). */
export function isGoogleAuthEnabled(flag: string | undefined): boolean {
  return flag === "on";
}

/** Where /auth/callback/google sends the user: the same rules as password sign-in. */
export function googleCallbackTarget(input: { exchanged: boolean; suspended: boolean; next: string | undefined }): string {
  if (!input.exchanged) return "/login?error=google";
  if (input.suspended) return "/login?error=suspended";
  return safeNextPath(input.next);
}
