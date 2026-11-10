import "server-only";
import { ALL, pageSizeOf, type ListState } from "@/app/_components/list/list-params";
import { fetchPage } from "@/app/_components/list/paging";
import { quoteOrValue, toIlikePattern } from "@/app/_components/list/search-escape";
import { getStaffNames } from "@/lib/staff-names";
import { createServerClient } from "@/lib/supabase/server";
import { activityCoverUrl } from "./cover";
import { ACTIVITY_LIST_CONFIG, ACTIVITY_SORT_COLUMN, STAFF_ACTIVITY_CONFIG, STAFF_ACTIVITY_SORT_COLUMN, staffActivityFilters, staffActivitySearchFilter } from "./list-config";
import type { ActivityRecord } from "./validation";

// Read helpers for activity pages. They run as the signed-in user, so RLS decides what
// is visible (students: open + joined; staff: all). Callers check the role via the DAL.

export type ActivityRow = ActivityRecord & {
  id: string;
  cover_path: string | null;
  created_by: string | null;
  created_at: string;
};

const COLUMNS =
  "id, title, description, location, is_offsite, starts_at, ends_at, status, type, requires_code, unit_points, unit_carbon_kg, max_per_submission, details, cover_path, created_by, created_at";

function toRow(raw: Record<string, unknown>): ActivityRow {
  const row = raw as unknown as ActivityRow;
  return {
    ...row,
    unit_carbon_kg: row.unit_carbon_kg === null ? null : Number(row.unit_carbon_kg),
  };
}

type StaffFilterable = {
  or(filter: string): StaffFilterable;
  eq(column: string, value: string | boolean): StaffFilterable;
};

export type StaffActivityListRow = ActivityRow & { participantCount: number; coverUrl: string | null };

/**
 * One page (pageSizeOf(STAFF_ACTIVITY_CONFIG)) of /staff/activities from the staff_activity_list view: optional
 * title search matched literally, AND the staffActivityFilters columns. Sorted by created_at,
 * participant_count or title (nulls last), then id. A page past the end returns no items with the real total.
 */
export async function listActivitiesForStaffPage(
  p: Pick<ListState, "q" | "sort" | "dir" | "filters" | "page">,
): Promise<{ items: StaffActivityListRow[]; total: number }> {
  const supabase = await createServerClient();
  const search = p.q ? staffActivitySearchFilter(p.q) : null;
  const filters = staffActivityFilters(p.filters);
  // the same builder comes back (each method returns `this`), so the cast back to T is exact
  const filtered = <T,>(query: T): T => {
    let q = query as unknown as StaffFilterable;
    if (search) q = q.or(search);
    for (const [column, , value] of filters) q = q.eq(column, value);
    return q as unknown as T;
  };
  const column = Object.hasOwn(STAFF_ACTIVITY_SORT_COLUMN, p.sort) ? STAFF_ACTIVITY_SORT_COLUMN[p.sort as keyof typeof STAFF_ACTIVITY_SORT_COLUMN] : "created_at";
  const ascending = p.dir === "asc";
  const { items: raw, total } = await fetchPage<Record<string, unknown>>("listActivitiesForStaffPage", {
    page: p.page,
    size: pageSizeOf(STAFF_ACTIVITY_CONFIG),
    run: (from, to) =>
      filtered(supabase.from("staff_activity_list").select(`${COLUMNS}, participant_count`, { count: "exact" }))
        .order(column, { ascending, nullsFirst: false })
        .order("id", { ascending })
        .range(from, to),
    head: () => filtered(supabase.from("staff_activity_list").select("id", { count: "exact", head: true })),
  });
  return {
    total,
    items: raw.map((r) => {
      const { participant_count, ...rest } = r;
      const row = toRow(rest);
      return { ...row, participantCount: Number(participant_count ?? 0), coverUrl: activityCoverUrl(row.cover_path) };
    }),
  };
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

export type StudentActivityItem = ActivityRow & { joined: boolean; creatorName: string | null; coverUrl: string | null };

/**
 * The filter methods the /activities query uses. The query builders are cast to this through unknown: checking a
 * PostgrestFilterBuilder against a generic constraint with these methods hits TS2589 under `next build`.
 */
type ActivityFilterable = {
  or(filter: string): ActivityFilterable;
  eq(column: string, value: string): ActivityFilterable;
  in(column: string, values: readonly string[]): ActivityFilterable;
  not(column: string, operator: string, value: string): ActivityFilterable;
};

/**
 * One page (pageSizeOf(ACTIVITY_LIST_CONFIG)) of /activities for a student (DESIGN-3 6.2, DESIGN-4 3/3.4): the open activities plus every
 * activity the user joined (the same rule as before, which RLS also enforces), AND an optional title/description
 * search matched literally (search-escape.ts), AND the ACTIVITY_LIST_CONFIG filters: joined=yes keeps only the joined
 * ids (none joined → total 0 without a query), joined=no keeps open activities the user has not joined, type keeps
 * one activity type. PostgREST ANDs the separate or= filters. Sorted by created_at or title (nulls last), then id.
 * A page past the end returns no items with the real total, so the page can ask again for the last page. Creator
 * names come from one staff_names() call per page. Throws on failure.
 */
export async function listActivitiesForStudentPage(
  userId: string,
  p: Pick<ListState, "q" | "sort" | "dir" | "filters" | "page">,
): Promise<{ items: StudentActivityItem[]; total: number }> {
  const joinedIds = await joinedActivityIds(userId);
  const joined = p.filters.joined;
  if (joined === "yes" && joinedIds.length === 0) return { items: [], total: 0 };
  const type = p.filters.type;
  const typeFilter = type && type !== ALL && Object.hasOwn(ACTIVITY_LIST_CONFIG.filters.type.options, type) ? type : null;

  const supabase = await createServerClient();
  const pattern = p.q ? quoteOrValue(toIlikePattern(p.q)) : null;
  // ids are uuids read from the database, safe inside the PostgREST filter.
  const idList = `(${joinedIds.join(",")})`;
  const visible = joinedIds.length > 0 ? `status.eq.open,id.in.${idList}` : "status.eq.open";
  const search = pattern ? `title.ilike.${pattern},description.ilike.${pattern}` : null;
  // the same builder comes back (each method returns `this`), so the cast back to T is exact
  const filtered = <T,>(query: T): T => {
    let q = (query as unknown as ActivityFilterable).or(visible);
    if (search) q = q.or(search);
    if (joined === "yes") q = q.in("id", joinedIds);
    else if (joined === "no") {
      q = q.eq("status", "open");
      if (joinedIds.length > 0) q = q.not("id", "in", idList);
    }
    if (typeFilter) q = q.eq("type", typeFilter);
    return q as unknown as T;
  };
  const column = Object.hasOwn(ACTIVITY_SORT_COLUMN, p.sort) ? ACTIVITY_SORT_COLUMN[p.sort as keyof typeof ACTIVITY_SORT_COLUMN] : "created_at";
  const ascending = p.dir === "asc";
  const { items: raw, total } = await fetchPage<Record<string, unknown>>("listActivitiesForStudentPage", {
    page: p.page,
    size: pageSizeOf(ACTIVITY_LIST_CONFIG),
    run: (from, to) =>
      filtered(supabase.from("activities").select(COLUMNS, { count: "exact" }))
        .order(column, { ascending, nullsFirst: false })
        .order("id", { ascending })
        .range(from, to),
    head: () => filtered(supabase.from("activities").select("id", { count: "exact", head: true })),
  });

  const joinedSet = new Set(joinedIds);
  const rows = raw.map(toRow);
  const names = await getStaffNames(rows.map((r) => r.created_by));
  return {
    total,
    items: rows.map((r) => ({
      ...r,
      joined: joinedSet.has(r.id),
      creatorName: (r.created_by && names.get(r.created_by)) || null,
      coverUrl: activityCoverUrl(r.cover_path),
    })),
  };
}
