import "server-only";
import { pageSizeOf, type ListState } from "@/app/_components/list/list-params";
import { fetchPage } from "@/app/_components/list/paging";
import { createServerClient } from "@/lib/supabase/server";
import { studentDisplayName } from "./format";
import { MY_ORDER_CONFIG, MY_ORDER_SORT_COLUMN, orderSearchFilter, STAFF_ORDER_CONFIG, STAFF_ORDER_SORT_COLUMN, staffOrderFilter, staffOrderSearchFilter } from "./list-config";

// Read helpers for order pages. They run as the signed-in user, so RLS decides what is visible
// (students: their own orders; staff: every order, 0002). Callers check the role via the DAL.
// Reward names are the order_items.reward_name snapshot taken at checkout (next to unit_cost), not
// the live reward, so a renamed or deactivated reward still shows the name that was ordered.

export type OrderSummary = {
  id: string;
  status: string;
  totalPoints: number;
  createdAt: string;
  expiresAt: string;
  readyAt: string | null;
};

export type OrderLine = { rewardId: string; name: string; qty: number; unitCost: number };

export type OrderDetail = OrderSummary & {
  studentId: string;
  studentName: string | null;
  completedAt: string | null;
  lines: OrderLine[];
};

export type StaffOrder = OrderSummary & { studentName: string; lines: { name: string; qty: number }[] };

type One<T> = T | T[] | null;
const one = <T,>(v: One<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

type OrderRow = {
  id: string;
  status: string;
  total_points: number;
  created_at: string;
  expires_at: string;
  ready_at: string | null;
};
type ProfileRef = { full_name: string; display_name: string | null };

function summary(r: OrderRow): OrderSummary {
  return { id: r.id, status: r.status, totalPoints: r.total_points, createdAt: r.created_at, expiresAt: r.expires_at, readyAt: r.ready_at };
}

/** The student's orders, newest first. */
export async function listMyOrders(studentId: string): Promise<OrderSummary[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, status, total_points, created_at, expires_at, ready_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listMyOrders: ${error.message}`);
  return ((data ?? []) as OrderRow[]).map(summary);
}

/**
 * One page of the student's orders for /orders, from my_order_list (their session; the view is security_invoker).
 * Optional search on the item names or the order number, sorted by date then id. A page past the end returns no
 * items with the real total, so the page can ask again for the last page. Throws on failure.
 */
export async function listMyOrdersPage(
  studentId: string,
  state: Pick<ListState, "q" | "sort" | "dir" | "page">,
): Promise<{ items: OrderSummary[]; total: number }> {
  const supabase = await createServerClient();
  const filter = state.q ? orderSearchFilter(state.q) : null;
  const filtered = <T extends { or(filter: string): T }>(query: T): T => (filter ? query.or(filter) : query);
  const column = Object.hasOwn(MY_ORDER_SORT_COLUMN, state.sort) ? MY_ORDER_SORT_COLUMN[state.sort as keyof typeof MY_ORDER_SORT_COLUMN] : "created_at";
  const ascending = state.dir === "asc";
  const { items, total } = await fetchPage<OrderRow>("listMyOrdersPage", {
    page: state.page,
    size: pageSizeOf(MY_ORDER_CONFIG),
    run: (from, to) =>
      filtered(
        supabase.from("my_order_list").select("id, status, total_points, created_at, expires_at, ready_at", { count: "exact" }).eq("student_id", studentId),
      )
        .order(column, { ascending, nullsFirst: false })
        .order("id", { ascending })
        .range(from, to),
    head: () => filtered(supabase.from("my_order_list").select("id", { count: "exact", head: true }).eq("student_id", studentId)),
  });
  return { items: items.map(summary), total };
}

type DetailRow = OrderRow & {
  student_id: string;
  completed_at: string | null;
  student: One<ProfileRef>;
  order_items: { reward_id: string; qty: number; unit_cost: number; reward_name: string }[];
};

/** One order with its lines, or null when it does not exist or the caller may not read it (RLS). */
export async function getOrder(id: string): Promise<OrderDetail | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, status, total_points, created_at, expires_at, ready_at, student_id, completed_at, " +
        "student:profiles!orders_student_id_fkey(full_name, display_name), " +
        "order_items(reward_id, qty, unit_cost, reward_name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getOrder: ${error.message}`);
  if (!data) return null;
  const row = data as unknown as DetailRow;
  const student = one(row.student);
  return {
    ...summary(row),
    studentId: row.student_id,
    studentName: student ? studentDisplayName(student.display_name, student.full_name) : null,
    completedAt: row.completed_at,
    lines: row.order_items
      .map((i) => ({ rewardId: i.reward_id, name: i.reward_name, qty: i.qty, unitCost: i.unit_cost }))
      .sort((a, b) => a.name.localeCompare(b.name, "th")),
  };
}

type StaffViewRow = OrderRow & { buyer_name: string | null };
type Filterable = { or(filter: string): Filterable; eq(column: string, value: string): Filterable };

/**
 * One page (pageSizeOf(STAFF_ORDER_CONFIG)) of /staff/orders from staff_order_list: optional search on the buyer's names
 * or the order number (staffOrderSearchFilter), AND the status filter (staffOrderFilter, default open = pending_pickup).
 * Sorted by created_at, total_points or buyer_name (nulls last), then id. A page past the end returns no items with the
 * real total. The order lines come from one order_items query for the page. Throws on failure.
 */
export async function listStaffOrdersPage(
  p: Pick<ListState, "q" | "sort" | "dir" | "filters" | "page">,
): Promise<{ items: StaffOrder[]; total: number }> {
  const supabase = await createServerClient();
  const search = p.q ? staffOrderSearchFilter(p.q) : null;
  const status = staffOrderFilter(p.filters.status);
  // the same builder comes back (each method returns `this`), so the cast back to T is exact
  const filtered = <T,>(query: T): T => {
    let q = query as unknown as Filterable;
    if (search) q = q.or(search);
    if (status) q = q.eq(status[0], status[2]);
    return q as unknown as T;
  };
  const column = Object.hasOwn(STAFF_ORDER_SORT_COLUMN, p.sort) ? STAFF_ORDER_SORT_COLUMN[p.sort as keyof typeof STAFF_ORDER_SORT_COLUMN] : "created_at";
  const ascending = p.dir === "asc";
  const { items: rows, total } = await fetchPage<StaffViewRow>("listStaffOrdersPage", {
    page: p.page,
    size: pageSizeOf(STAFF_ORDER_CONFIG),
    run: (from, to) =>
      filtered(supabase.from("staff_order_list").select("id, status, total_points, created_at, expires_at, ready_at, buyer_name", { count: "exact" }))
        .order(column, { ascending, nullsFirst: false })
        .order("id", { ascending })
        .range(from, to),
    head: () => filtered(supabase.from("staff_order_list").select("id", { count: "exact", head: true })),
  });
  const lines = new Map<string, { name: string; qty: number }[]>();
  if (rows.length > 0) {
    const { data, error } = await supabase
      .from("order_items")
      .select("order_id, qty, reward_name")
      .in("order_id", rows.map((r) => r.id))
      .order("reward_name", { ascending: true });
    if (error) throw new Error(`listStaffOrdersPage lines: ${error.message}`);
    for (const l of (data ?? []) as { order_id: string; qty: number; reward_name: string }[]) {
      lines.set(l.order_id, [...(lines.get(l.order_id) ?? []), { name: l.reward_name, qty: l.qty }]);
    }
  }
  return { total, items: rows.map((r) => ({ ...summary(r), studentName: r.buyer_name ?? "-", lines: lines.get(r.id) ?? [] })) };
}
