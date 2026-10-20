import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import type { ActivityRecord } from "./validation";

// Read helpers for activity pages. They run as the signed-in user, so RLS decides what
// is visible (students: open + joined; staff: all). Callers check the role via the DAL.

export type ActivityRow = ActivityRecord & { id: string };

const COLUMNS =
  "id, title, description, location, is_offsite, starts_at, ends_at, status, type, requires_code, unit_points, unit_carbon_kg, max_per_submission";

function toRow(raw: Record<string, unknown>): ActivityRow {
  const row = raw as unknown as ActivityRow;
  return {
    ...row,
    unit_carbon_kg: row.unit_carbon_kg === null ? null : Number(row.unit_carbon_kg),
  };
}

export type StaffActivityRow = ActivityRow & { participantCount: number };

export async function listActivitiesForStaff(): Promise<StaffActivityRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("activities")
    .select(`${COLUMNS}, participations(count)`)
    .order("starts_at", { ascending: false });
  if (error) throw new Error(`listActivitiesForStaff: ${error.message}`);
  return (data ?? []).map((raw) => {
    const { participations, ...rest } = raw as Record<string, unknown> & {
      participations?: { count: number }[];
    };
    return { ...toRow(rest), participantCount: participations?.[0]?.count ?? 0 };
  });
}

export async function getActivity(id: string): Promise<ActivityRow | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.from("activities").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`getActivity: ${error.message}`);
  return data ? toRow(data) : null;
}

async function joinedActivityIds(userId: string): Promise<string[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("participations")
    .select("activity_id")
    .eq("student_id", userId);
  if (error) throw new Error(`joinedActivityIds: ${error.message}`);
  return (data ?? []).map((p) => (p as { activity_id: string }).activity_id);
}

export async function hasJoined(activityId: string, userId: string): Promise<boolean> {
  const supabase = await createServerClient();
  const { count, error } = await supabase
    .from("participations")
    .select("id", { count: "exact", head: true })
    .eq("activity_id", activityId)
    .eq("student_id", userId);
  if (error) throw new Error(`hasJoined: ${error.message}`);
  return (count ?? 0) > 0;
}

/** True when the user has a pending or approved submission for the pair (rejected ones do not count). */
export async function hasActiveSubmission(activityId: string, userId: string): Promise<boolean> {
  const supabase = await createServerClient();
  const { count, error } = await supabase
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq("activity_id", activityId)
    .eq("student_id", userId)
    .in("status", ["pending", "approved"]);
  if (error) throw new Error(`hasActiveSubmission: ${error.message}`);
  return (count ?? 0) > 0;
}

/** Open activities the user has not joined, and every activity the user joined. */
export async function listActivitiesForStudent(
  userId: string,
): Promise<{ open: ActivityRow[]; joined: ActivityRow[] }> {
  const joinedIds = await joinedActivityIds(userId);
  const supabase = await createServerClient();
  let query = supabase.from("activities").select(COLUMNS).order("starts_at", { ascending: true });
  // ids are uuids read from the database, safe inside the PostgREST filter.
  query = joinedIds.length > 0 ? query.or(`status.eq.open,id.in.(${joinedIds.join(",")})`) : query.eq("status", "open");
  const { data, error } = await query;
  if (error) throw new Error(`listActivitiesForStudent: ${error.message}`);

  const joinedSet = new Set(joinedIds);
  const rows = (data ?? []).map(toRow);
  return {
    joined: rows.filter((r) => joinedSet.has(r.id)),
    open: rows.filter((r) => !joinedSet.has(r.id) && r.status === "open"),
  };
}
