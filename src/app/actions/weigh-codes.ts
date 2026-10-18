"use server";

import { getCurrentUser } from "@/lib/auth/dal";
import { isStaffRole } from "@/lib/auth/routes";
import { errorCodeFromDb, errorMessageTh } from "@/lib/errors";
import { createServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

// Server Actions are reachable by direct POST: each action checks the caller (DAL) and the
// database enforces the same rules again (RLS, issue_weigh_code).

export type IssueCodeResult =
  | { ok: true; code: string; expiresAt: string; error?: undefined }
  | { ok: false; error: string; code?: undefined; expiresAt?: undefined };

/** Issue a one-time weigh station code (spec 6.4). Teacher or admin only. */
export async function issueWeighCode(activityId: string, studentId: string): Promise<IssueCodeResult> {
  if (!isUuid(activityId)) return { ok: false, error: errorMessageTh("activity_not_found") };
  if (!isUuid(studentId)) return { ok: false, error: errorMessageTh("not_participant") };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: errorMessageTh("not_authenticated") };
  if (!isStaffRole(user.role)) return { ok: false, error: errorMessageTh("not_staff") };

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("issue_weigh_code", {
    p_activity_id: activityId,
    p_student_id: studentId,
  });
  if (error) {
    const code = errorCodeFromDb(error);
    if (!code) console.error("issue_weigh_code failed", error.code, error.message);
    return { ok: false, error: errorMessageTh(code) };
  }
  const row = (Array.isArray(data) ? data[0] : data) as { code: string; expires_at: string } | null;
  if (!row) return { ok: false, error: errorMessageTh(null) };
  return { ok: true, code: row.code, expiresAt: row.expires_at };
}

export type StudentHit = { id: string; name: string };
export type SearchStudentsResult = { students: StudentHit[]; error?: string };

const SEARCH_LIMIT = 20;

/** Participants of an activity whose name matches `query` (empty = first names). Staff only. */
export async function searchParticipants(activityId: string, query: string): Promise<SearchStudentsResult> {
  if (!isUuid(activityId) || typeof query !== "string") return { students: [] };
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.role)) return { students: [], error: errorMessageTh("not_staff") };

  // Strip characters that have meaning in a PostgREST filter / LIKE pattern.
  const term = query.replace(/[%_*,()\\"']/g, " ").trim().slice(0, 60);

  const supabase = await createServerClient();
  let request = supabase
    .from("participations")
    .select("student_id, profiles!inner(full_name, display_name)")
    .eq("activity_id", activityId)
    .order("created_at", { ascending: true })
    .limit(SEARCH_LIMIT);
  if (term) {
    request = request.or(`full_name.ilike.%${term}%,display_name.ilike.%${term}%`, {
      referencedTable: "profiles",
    });
  }
  const { data, error } = await request;
  if (error) {
    console.error("searchParticipants failed", error.code, error.message);
    return { students: [], error: errorMessageTh(null) };
  }
  const students = (data ?? []).map((raw) => {
    const row = raw as unknown as {
      student_id: string;
      profiles: { full_name: string; display_name: string | null } | { full_name: string; display_name: string | null }[];
    };
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return { id: row.student_id, name: profile?.display_name || profile?.full_name || "" };
  });
  return { students };
}
