import "server-only";
import { pageSizeOf, type ListState } from "@/app/_components/list/list-params";
import { fetchPage, type PageResponse } from "@/app/_components/list/paging";
import { avatarPublicUrl } from "@/lib/profile/avatar";
import { createServerClient } from "@/lib/supabase/server";
import { STUDENT_ACCOUNT_CONFIG } from "./list-config";

// Read helpers for /staff/students (DESIGN-4 6.1). They run as the signed-in staff member through the 0036 definer
// functions (staff only; e-mail comes from auth.users there). Callers check the role first (requireStaff).

export type StudentAccount = {
  id: string;
  fullName: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  createdAt: string;
  points: number;
  carbonKg: number;
  /** ISO text or "infinity"; may be in the past (an expired suspension keeps its value): use isSuspendedAt. */
  suspendedUntil: string | null;
  mustChangePassword: boolean;
  isDemo: boolean;
};

export type StudentAccountDetail = StudentAccount & { suspendReason: string | null; suspendedByName: string | null };

export type AccountEventAction = "password_reset" | "suspend" | "unsuspend" | "rename" | "delete";
export type AccountEvent = {
  id: string;
  action: AccountEventAction;
  actorName: string;
  studentName: string;
  /** Display text written by the database (Thai); shown as-is. */
  detail: string | null;
  createdAt: string;
};

type Row = {
  id: string;
  full_name: string;
  display_name: string | null;
  email: string | null;
  avatar_path: string | null;
  created_at: string;
  points: number | string | null;
  carbon_kg: number | string | null;
  suspended_until: string | null;
  must_change_password: boolean | null;
  is_demo: boolean | null;
};
type ListRow = Row & { total: number | string };
type DetailRow = Row & { suspend_reason: string | null; suspended_by_name: string | null };

function toAccount(r: Row): StudentAccount {
  return {
    id: r.id,
    fullName: r.full_name,
    displayName: r.display_name,
    email: r.email,
    avatarUrl: avatarPublicUrl(r.avatar_path),
    createdAt: r.created_at,
    points: Number(r.points ?? 0),
    carbonKg: Number(r.carbon_kg ?? 0),
    suspendedUntil: r.suspended_until,
    mustChangePassword: r.must_change_password === true,
    isDemo: r.is_demo === true,
  };
}

/**
 * One page of students (staff_list_students). The function returns the total on every row, so a page past the end
 * has no rows and no total: that case is reported as PostgREST's "past the last row" (PGRST103) to fetchPage, whose
 * head() then reads the total from the first row, and loadClamped moves to the last page.
 */
export async function listStudentAccounts(
  p: Pick<ListState, "q" | "sort" | "dir" | "filters" | "page">,
): Promise<{ items: StudentAccount[]; total: number }> {
  const supabase = await createServerClient();
  const args = { p_q: p.q || null, p_sort: p.sort, p_dir: p.dir, p_status: p.filters.status ?? "all" };
  const call = (limit: number, offset: number) =>
    supabase.rpc("staff_list_students", { ...args, p_limit: limit, p_offset: offset }).then(({ data, error }) => ({
      rows: (data ?? []) as ListRow[],
      error,
    }));

  const { items, total } = await fetchPage<ListRow>("listStudentAccounts", {
    page: p.page,
    size: pageSizeOf(STUDENT_ACCOUNT_CONFIG),
    run: async (from, to): Promise<PageResponse<ListRow>> => {
      const { rows, error } = await call(to - from + 1, from);
      if (error) return { data: null, error, count: null };
      if (rows.length === 0 && from > 0) return { data: null, error: { code: "PGRST103", message: "past the last row" }, count: null };
      return { data: rows, error: null, count: rows.length > 0 ? Number(rows[0].total) : 0 };
    },
    head: async () => {
      const { rows, error } = await call(1, 0);
      return { error, count: error ? null : rows.length > 0 ? Number(rows[0].total) : 0 };
    },
  });
  return { items: items.map(toAccount), total };
}

/** One student for /staff/students/[id]; null when the id is not a student (the page answers 404). */
export async function getStudentAccount(id: string): Promise<StudentAccountDetail | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("staff_get_student", { p_student: id });
  if (error) {
    if (error.message?.trim() === "not_student") return null;
    throw new Error(`getStudentAccount: ${error.message}`);
  }
  const row = ((data ?? []) as DetailRow[])[0];
  if (!row) return null;
  return { ...toAccount(row), suspendReason: row.suspend_reason, suspendedByName: row.suspended_by_name };
}

/** The latest account events of a student, newest first (staff_list_account_events). */
export async function listAccountEvents(id: string, limit = 20): Promise<AccountEvent[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("staff_list_account_events", { p_student: id, p_limit: limit });
  if (error) throw new Error(`listAccountEvents: ${error.message}`);
  return ((data ?? []) as {
    id: string;
    action: AccountEventAction;
    actor_name: string;
    student_name: string;
    detail: string | null;
    created_at: string;
  }[]).map((e) => ({
    id: e.id,
    action: e.action,
    actorName: e.actor_name,
    studentName: e.student_name,
    detail: e.detail,
    createdAt: e.created_at,
  }));
}

/** Whether the signed-in staff member is a demo account (DESIGN-4 6.3: demo staff manage demo students only). */
export async function isDemoAccount(userId: string): Promise<boolean> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.from("profiles").select("is_demo").eq("id", userId).maybeSingle();
  if (error) throw new Error(`isDemoAccount: ${error.message}`);
  return (data as { is_demo: boolean } | null)?.is_demo === true;
}

/**
 * A user's account_status row through RLS (0036, R16a): everyone reads their own row; staff read other rows, but a
 * demo caller only rows about demo users. So null means "no row" OR "a demo caller asking about a real user": do not
 * use it for a guard on a student (read staff_get_student through getStudentAccount instead).
 */
export async function getAccountStatusRow(userId: string): Promise<{ suspendedUntil: string | null; mustChangePassword: boolean } | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("account_status")
    .select("suspended_until, must_change_password")
    .eq("student_id", userId)
    .maybeSingle();
  if (error) throw new Error(`getAccountStatusRow: ${error.message}`);
  const row = data as { suspended_until: string | null; must_change_password: boolean } | null;
  return row ? { suspendedUntil: row.suspended_until, mustChangePassword: row.must_change_password } : null;
}
