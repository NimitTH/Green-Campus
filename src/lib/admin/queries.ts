import "server-only";
import { toRole, type Role } from "@/lib/auth/routes";
import { createServerClient } from "@/lib/supabase/server";
import { cleanSearchTerm, USERS_PAGE_SIZE, type RoleFilter } from "./validation";

// Read helpers for /staff, /staff/users and /staff/rates. They run as the signed-in user, so RLS decides
// what is visible (staff read every profile, ledger row and category, 0002). Callers check the role (DAL).

// /staff dashboard (R118) ------------------------------------------------------------------------

export type StaffStats = {
  pendingReviews: number;
  pendingPickup: number;
  readyForPickup: number;
  carbonKg: number;
  wasteGrams: number;
  trees: number;
  openActivities: { id: string; title: string; endsAt: string }[];
};

/** Counts (head-only, no rows fetched), public_stats() totals and up to 5 open, not yet ended activities. */
export async function getStaffStats(): Promise<StaffStats> {
  const supabase = await createServerClient();
  // open and not yet ended (an open activity past ends_at only takes late submissions; R126.3)
  const nowIso = new Date().toISOString();
  const [reviews, pickup, ready, stats, activities] = await Promise.all([
    supabase.from("submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending_pickup"),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_pickup")
      .not("ready_at", "is", null),
    supabase.rpc("public_stats"),
    supabase
      .from("activities")
      .select("id, title, ends_at")
      .eq("status", "open")
      .gt("ends_at", nowIso)
      .order("ends_at", { ascending: true })
      .limit(5),
  ]);
  for (const r of [reviews, pickup, ready, stats, activities]) {
    if (r.error) throw new Error(`getStaffStats: ${r.error.message}`);
  }
  const totals = (stats.data ?? {}) as { carbon_kg?: number | string; waste_grams?: number | string; trees?: number | string };
  return {
    pendingReviews: reviews.count ?? 0,
    pendingPickup: pickup.count ?? 0,
    readyForPickup: ready.count ?? 0,
    carbonKg: Number(totals.carbon_kg ?? 0),
    wasteGrams: Number(totals.waste_grams ?? 0),
    trees: Number(totals.trees ?? 0),
    openActivities: ((activities.data ?? []) as { id: string; title: string; ends_at: string }[]).map((a) => ({
      id: a.id,
      title: a.title,
      endsAt: a.ends_at,
    })),
  };
}

// /staff/users (R119) ------------------------------------------------------------------------------

export type AdminUser = {
  id: string;
  fullName: string;
  displayName: string | null;
  role: Role;
  isDemo: boolean;
  /** Students only. */
  points: number | null;
  carbonKg: number | null;
};

type ProfileRow = { id: string; full_name: string; display_name: string | null; role: string; is_demo: boolean };
type BalanceRow = { student_id: string; points: number | string; carbon_kg: number | string };

const PROFILE_COLUMNS = "id, full_name, display_name, role, is_demo";

async function withBalances(rows: ProfileRow[]): Promise<AdminUser[]> {
  const studentIds = rows.filter((r) => r.role === "student").map((r) => r.id);
  const balances = new Map<string, BalanceRow>();
  if (studentIds.length > 0) {
    const supabase = await createServerClient();
    const { data, error } = await supabase.from("student_balance").select("student_id, points, carbon_kg").in("student_id", studentIds);
    if (error) throw new Error(`withBalances: ${error.message}`);
    for (const b of (data ?? []) as BalanceRow[]) balances.set(b.student_id, b);
  }
  return rows.flatMap((r) => {
    const role = toRole(r.role);
    if (!role) return [];
    const b = balances.get(r.id);
    const isStudent = role === "student";
    return [
      {
        id: r.id,
        fullName: r.full_name,
        displayName: r.display_name,
        role,
        isDemo: r.is_demo,
        points: isStudent ? Number(b?.points ?? 0) : null,
        carbonKg: isStudent ? Number(b?.carbon_kg ?? 0) : null,
      },
    ];
  });
}

/** One page of users, by name (full_name then id, stable), filtered by name and role. */
export async function listUsers(
  query: string,
  role: RoleFilter,
  page: number,
): Promise<{ users: AdminUser[]; total: number }> {
  const supabase = await createServerClient();
  const from = (page - 1) * USERS_PAGE_SIZE;
  let request = supabase
    .from("profiles")
    .select(PROFILE_COLUMNS, { count: "exact" })
    .order("full_name", { ascending: true })
    .order("id", { ascending: true })
    .range(from, from + USERS_PAGE_SIZE - 1);
  const term = cleanSearchTerm(query);
  if (term) request = request.or(`full_name.ilike.%${term}%,display_name.ilike.%${term}%`);
  if (role !== "all") request = request.eq("role", role);
  const { data, error, count } = await request;
  // PostgREST answers 416 for a page past the end: show it as empty rather than failing.
  if (error && error.code !== "PGRST103") throw new Error(`listUsers: ${error.message}`);
  return { users: await withBalances(((error ? [] : data) ?? []) as ProfileRow[]), total: count ?? 0 };
}

export async function getUser(id: string): Promise<AdminUser | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`getUser: ${error.message}`);
  if (!data) return null;
  return (await withBalances([data as ProfileRow]))[0] ?? null;
}

export type LedgerRow = { id: string; kind: string; points: number; carbonKg: number; note: string | null; createdAt: string };

/** A student's most recent ledger rows, newest first. */
export async function listRecentLedger(studentId: string, limit = 20): Promise<LedgerRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("ledger_entries")
    .select("id, kind, points, carbon_kg, note, created_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listRecentLedger: ${error.message}`);
  return (
    (data ?? []) as { id: string; kind: string; points: number; carbon_kg: number | string; note: string | null; created_at: string }[]
  ).map((r) => ({ id: r.id, kind: r.kind, points: r.points, carbonKg: Number(r.carbon_kg), note: r.note, createdAt: r.created_at }));
}

// /staff/rates (R120) -------------------------------------------------------------------------------

export type RateRow = {
  id: string;
  code: string;
  name: string;
  pointsPerKg: number;
  carbonKgPerKg: number;
  sourceNote: string | null;
  updatedAt: string;
};

const CODE_ORDER = ["plastic", "paper", "metal_glass", "other"];

export async function listRates(): Promise<RateRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("waste_categories")
    .select("id, code, name, points_per_kg, carbon_kg_per_kg, source_note, updated_at");
  if (error) throw new Error(`listRates: ${error.message}`);
  return (
    (data ?? []) as {
      id: string;
      code: string;
      name: string;
      points_per_kg: number;
      carbon_kg_per_kg: number | string;
      source_note: string | null;
      updated_at: string;
    }[]
  )
    .map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      pointsPerKg: r.points_per_kg,
      carbonKgPerKg: Number(r.carbon_kg_per_kg),
      sourceNote: r.source_note,
      updatedAt: r.updated_at,
    }))
    .sort((a, b) => CODE_ORDER.indexOf(a.code) - CODE_ORDER.indexOf(b.code));
}
