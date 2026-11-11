import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { avatarPublicUrl } from "@/lib/profile/avatar";
import { createServerClient } from "@/lib/supabase/server";
import { isAdminRole, isStaffRole, loginPathFor, toRole, type Role } from "./routes";

// Data Access Layer: the one place that reads the session and the caller's role.
// Callers must render behind <Suspense> (cacheComponents: session reads are request-time).

export type CurrentUser = {
  id: string;
  email: string | null;
  role: Role;
  fullName: string;
  displayName: string | null;
  avatarUrl: string | null;
  /** account_status.suspended_until (ISO text, or "infinity" = until lifted); null when never suspended. */
  suspendedUntil: string | null;
  mustChangePassword: boolean;
};

export type AccessDecision = "ok" | "signin" | "suspended" | "change_password";

/** Where a suspended user is sent: the route signs them out, then shows the message on /login. */
export const SUSPENDED_SIGNOUT_PATH = "/auth/signout?reason=suspended";
export const CHANGE_PASSWORD_PATH = "/change-password";

/**
 * True while the suspension is in force at `now`. "infinity" never ends; an unreadable value fails closed
 * (the database is the authority, DESIGN-4 6.4, and only writes real timestamps or 'infinity').
 */
export function isSuspendedAt(suspendedUntil: string | null, now: Date): boolean {
  if (suspendedUntil === null) return false;
  if (suspendedUntil === "infinity") return true;
  if (suspendedUntil === "-infinity") return false;
  const until = Date.parse(suspendedUntil);
  if (Number.isNaN(until)) return true;
  return until > now.getTime();
}

/** The page/action gate as a pure function (spec 6.4). A suspension wins over the password flag. */
export function accessDecision(
  user: { suspendedUntil: string | null; mustChangePassword: boolean } | null,
  now: Date,
  pathname: string,
): AccessDecision {
  if (!user) return "signin";
  if (isSuspendedAt(user.suspendedUntil, now)) return "suspended";
  if (user.mustChangePassword && pathname !== CHANGE_PASSWORD_PATH) return "change_password";
  return "ok";
}

type StatusRow = { suspended_until: string | null; must_change_password: boolean } | null;
type ProfileRow = {
  role: string;
  full_name: string;
  display_name: string | null;
  avatar_path: string | null;
  // one-to-one embed (account_status.student_id is the primary key and references profiles)
  account_status: StatusRow | StatusRow[];
};

type Session = { user: CurrentUser | null; suspended: boolean };

// One read per request: Auth user + profile with the caller's own account_status row (RLS: own row only).
const getSession = cache(async (): Promise<Session> => {
  // Supabase reads the clock (token expiry) after cookies are available. With
  // cacheComponents + partial prefetching that happens during a runtime prerender, where
  // Date.now() is not allowed; connection() makes everything below request-time only.
  await connection();
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getUser();
  // A ban set through the Auth admin API (Task 17) makes Auth refuse the session itself.
  if (error?.code === "user_banned") return { user: null, suspended: true };
  if (error || !data.user) return { user: null, suspended: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, display_name, avatar_path, account_status(suspended_until, must_change_password)")
    .eq("id", data.user.id)
    .maybeSingle();
  const row = profile as ProfileRow | null;
  const role = toRole(row?.role);
  if (!row || !role) return { user: null, suspended: false };

  const status = Array.isArray(row.account_status) ? (row.account_status[0] ?? null) : row.account_status;
  const user: CurrentUser = {
    id: data.user.id,
    email: data.user.email ?? null,
    role,
    fullName: row.full_name,
    displayName: row.display_name,
    avatarUrl: avatarPublicUrl(row.avatar_path),
    suspendedUntil: status?.suspended_until ?? null,
    mustChangePassword: status?.must_change_password ?? false,
  };
  // A suspended account is signed out everywhere: every page sees "not signed in" (spec 6.4).
  if (isSuspendedAt(user.suspendedUntil, new Date())) return { user: null, suspended: true };
  return { user, suspended: false };
});

/** The signed-in user, or null (anonymous, no profile, or suspended). Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  return (await getSession()).user;
});

/** True when the current session belongs to a suspended account (used by /auth/signout). */
export async function isCurrentSessionSuspended(): Promise<boolean> {
  return (await getSession()).suspended;
}

async function gate(nextPath: string): Promise<{ user: CurrentUser | null; decision: AccessDecision }> {
  const session = await getSession();
  if (session.suspended) return { user: null, decision: "suspended" };
  return { user: session.user, decision: accessDecision(session.user, new Date(), nextPath) };
}

/**
 * Pages: signed-in and active. Anonymous -> /login?next=, suspended -> sign out, password flag ->
 * /change-password (except on that page: pass "/change-password" as nextPath there).
 */
export async function requireUser(nextPath = "/dashboard"): Promise<CurrentUser> {
  const { user, decision } = await gate(nextPath);
  if (decision === "suspended") redirect(SUSPENDED_SIGNOUT_PATH);
  if (decision === "signin" || !user) redirect(loginPathFor(nextPath));
  if (decision === "change_password") redirect(CHANGE_PASSWORD_PATH);
  return user;
}

/**
 * Server actions (spec 6.4): like requireUser, but a pending forced password change refuses the action
 * with Error("must_change_password") instead of navigating away from the form.
 */
export async function assertActiveUser(nextPath = "/dashboard"): Promise<CurrentUser> {
  const { user, decision } = await gate(nextPath);
  if (decision === "suspended") redirect(SUSPENDED_SIGNOUT_PATH);
  if (decision === "signin" || !user) redirect(loginPathFor(nextPath));
  if (user.mustChangePassword) throw new Error("must_change_password");
  return user;
}

/** Teachers and admins; everyone else goes to /dashboard. */
export async function requireStaff(nextPath = "/staff"): Promise<CurrentUser> {
  const user = await requireUser(nextPath);
  if (!isStaffRole(user.role)) redirect("/dashboard");
  return user;
}

/** Admin-only pages (/staff/users, /staff/rates); teachers go back to /staff. */
export async function requireAdmin(nextPath = "/staff"): Promise<CurrentUser> {
  const user = await requireStaff(nextPath);
  if (!isAdminRole(user.role)) redirect("/staff");
  return user;
}
