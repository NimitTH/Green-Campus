// Where Supabase auth emails send the user back to, and how the callback routes finish.
// Redirect URLs are query-free so they match the Auth redirect allow-list
// (config.toml additional_redirect_urls / Cloud "Redirect URLs") without surprises.

export type CallbackFlow = "signup" | "reset" | "email";

export const CALLBACK_PATHS: Record<CallbackFlow, string> = {
  signup: "/auth/callback",
  reset: "/auth/callback/reset",
  email: "/auth/callback/email",
};

export const CALLBACK_TARGETS: Record<CallbackFlow, { success: string; failure: string }> = {
  signup: { success: "/dashboard", failure: "/login?error=link" },
  reset: { success: "/reset-password", failure: "/forgot-password?error=link" },
  email: { success: "/profile?email=changed", failure: "/profile?email=link-error" },
};

const DEFAULT_ORIGIN = "http://localhost:3000";
const HOST_RE = /^[A-Za-z0-9.-]+(:\d{1,5})?$/;

function httpOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

/**
 * Site origin for links in auth emails. A configured NEXT_PUBLIC_SITE_URL wins; otherwise the
 * request's Origin header, then the (forwarded) Host; otherwise http://localhost:3000.
 */
export function resolveSiteOrigin(input: {
  configured?: string | null;
  origin?: string | null;
  forwardedHost?: string | null;
  host?: string | null;
  forwardedProto?: string | null;
}): string {
  const configured = httpOrigin(input.configured);
  if (configured) return configured;

  const fromHeader = httpOrigin(input.origin);
  if (fromHeader) return fromHeader;

  const host = (input.forwardedHost ?? input.host ?? "").split(",")[0].trim();
  if (host && HOST_RE.test(host)) {
    const forwarded = (input.forwardedProto ?? "").split(",")[0].trim();
    const local = host.startsWith("localhost") || host.startsWith("127.0.0.1");
    const proto = forwarded === "http" || forwarded === "https" ? forwarded : local ? "http" : "https";
    return `${proto}://${host}`;
  }
  return DEFAULT_ORIGIN;
}

export function emailRedirectUrl(origin: string, flow: CallbackFlow): string {
  return `${origin}${CALLBACK_PATHS[flow]}`;
}

/** True when the session's amr claim says it came from a password-recovery link. */
export function isRecoveryAmr(amr: unknown): boolean {
  if (!Array.isArray(amr)) return false;
  return amr.some(
    (entry) =>
      entry === "recovery" ||
      (typeof entry === "object" &&
        entry !== null &&
        (entry as { method?: unknown }).method === "recovery"),
  );
}

const CODE_RE = /^[A-Za-z0-9._~-]{1,512}$/;

/**
 * Safety net: if Supabase falls back to the bare site URL (redirect not allow-listed, stale
 * local config), the email link lands on "/?code=...". Send it to the callback instead.
 * Returns a fixed same-site path, or null when nothing should happen.
 */
export function rootAuthRedirect(pathname: string, params: URLSearchParams): string | null {
  if (pathname !== "/") return null;
  const code = params.get("code");
  if (code !== null) {
    return CODE_RE.test(code)
      ? `${CALLBACK_PATHS.signup}?code=${encodeURIComponent(code)}`
      : CALLBACK_TARGETS.signup.failure;
  }
  if (params.has("error_code") || params.has("error_description")) {
    return CALLBACK_TARGETS.signup.failure;
  }
  return null;
}
