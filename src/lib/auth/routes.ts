export type Role = "student" | "teacher" | "admin";

/** Path prefixes that need a signed-in user. The proxy redirects anonymous visitors to /login. */
export const PROTECTED_PREFIXES = ["/dashboard", "/staff"] as const;

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
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}

export function loginPathFor(nextPath: string): string {
  return `/login?next=${encodeURIComponent(nextPath)}`;
}
