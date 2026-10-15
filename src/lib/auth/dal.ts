import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
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
};

type ProfileRow = { role: string; full_name: string; display_name: string | null };

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, display_name")
    .eq("id", data.user.id)
    .maybeSingle();
  const row = profile as ProfileRow | null;
  const role = toRole(row?.role);
  if (!row || !role) return null;

  return {
    id: data.user.id,
    email: data.user.email ?? null,
    role,
    fullName: row.full_name,
    displayName: row.display_name,
  };
});

export async function requireUser(nextPath = "/dashboard"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(loginPathFor(nextPath));
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
