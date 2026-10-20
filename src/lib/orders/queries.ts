import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import { orderIdRange } from "./format";

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
    studentName: student ? student.display_name || student.full_name : null,
    completedAt: row.completed_at,
    lines: row.order_items
      .map((i) => ({ rewardId: i.reward_id, name: i.reward_name, qty: i.qty, unitCost: i.unit_cost }))
      .sort((a, b) => a.name.localeCompare(b.name, "th")),
  };
}

type StaffRow = OrderRow & { student: One<ProfileRef>; order_items: { qty: number; reward_name: string }[] };

const STAFF_COLUMNS =
  "id, status, total_points, created_at, expires_at, ready_at, " +
  "student:profiles!orders_student_id_fkey!inner(full_name, display_name), order_items(qty, reward_name)";
const LIMIT = 100;

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

async function staffQuery(status: "pending" | "done", query: string, by: "full_name" | "display_name" | "number"): Promise<StaffRow[]> {
  const supabase = await createServerClient();
  let q = supabase.from("orders").select(STAFF_COLUMNS);
  q = status === "pending" ? q.eq("status", "pending_pickup") : q.neq("status", "pending_pickup");
  if (by === "number") {
    const range = orderIdRange(query);
    if (!range) return [];
    q = q.gte("id", range.from).lte("id", range.to);
  } else if (query) {
    q = q.ilike(`student.${by}`, `%${escapeLike(query)}%`);
  }
  const { data, error } = await q.order("created_at", { ascending: status === "pending" }).limit(LIMIT);
  if (error) throw new Error(`listStaffOrders: ${error.message}`);
  return (data ?? []) as unknown as StaffRow[];
}

/**
 * Orders for /staff/orders: pending_pickup first (oldest first: the longest waiting on top), then
 * the rest, newest first. `query` matches the student's name, or an order number prefix.
 */
export async function listStaffOrders(query: string): Promise<StaffOrder[]> {
  const text = query.trim();
  const searches = async (status: "pending" | "done") => {
    if (!text) return staffQuery(status, "", "full_name");
    // The list shows display_name || full_name, so match either column (one escaped ilike each).
    const lists = await Promise.all([
      staffQuery(status, text, "full_name"),
      staffQuery(status, text, "display_name"),
      orderIdRange(text) ? staffQuery(status, text, "number") : Promise.resolve([]),
    ]);
    const seen = new Map<string, StaffRow>();
    for (const r of lists.flat()) seen.set(r.id, r);
    const asc = status === "pending";
    return [...seen.values()].sort((a, b) => (asc ? 1 : -1) * a.created_at.localeCompare(b.created_at));
  };
  const [pending, done] = await Promise.all([searches("pending"), searches("done")]);
  return [...pending, ...done].map((r) => {
    const student = one(r.student);
    return {
      ...summary(r),
      studentName: student ? student.display_name || student.full_name : "-",
      lines: r.order_items.map((i) => ({ name: i.reward_name, qty: i.qty })),
    };
  });
}
