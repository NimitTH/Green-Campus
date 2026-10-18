export type Role = "student" | "teacher" | "admin";

/** Path prefixes that need a signed-in user. The proxy redirects anonymous visitors to /login. */
export const PROTECTED_PREFIXES = ["/dashboard", "/staff", "/activities", "/my-submissions"] as const;

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

export function toRole(value: unknown): Role | null {
  return value === "student" || value === "teacher" || value === "admin" ? value : null;
}

/** Teachers and admins (spec 8.1 is_staff()). */
export function isStaffRole(role: Role | null | undefined): boolean {
  return role === "teacher" || role === "admin";
}

export function isAdminRole(role: Role | null | undefined): boolean {
  return role === "admin";
}

/**
 * Only same-site relative paths are allowed as a post-login destination, so a crafted
 * ?next= cannot send the user to another site.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return fallback;
  }
  // Browsers and URL parsers strip tabs/newlines, so "/\t/evil.example" would become
  // "//evil.example". Reject control characters and whitespace outright.
  if (/[\x00-\x1F\x7F\s]/.test(next)) return fallback;

  // Second layer: resolve against a dummy origin and require it to stay there.
  const base = "http://x.invalid";
  let url: URL;
  try {
    url = new URL(next, base);
  } catch {
    return fallback;
  }
  if (url.origin !== base) return fallback;
  const out = `${url.pathname}${url.search}${url.hash}`;
  // Dot segments can normalise to "//host" (e.g. "/a/..//evil"), which browsers treat as
  // protocol-relative. Reject instead of collapsing slashes.
  if (!out.startsWith("/") || out.startsWith("//")) return fallback;
  return out;
}

export function loginPathFor(nextPath: string): string {
  return `/login?next=${encodeURIComponent(nextPath)}`;
}
