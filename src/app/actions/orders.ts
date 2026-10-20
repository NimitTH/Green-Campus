"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { isAdminRole, isStaffRole } from "@/lib/auth/routes";
import { errorCodeFromDb, orderErrorMessageTh } from "@/lib/errors";
import { parseBlocked, type BlockedItem } from "@/lib/orders/format";
import { createServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

// Server Actions are reachable by direct POST: each one checks the caller here (DAL) and the
// database functions check everything again (role, locks, status, stock, points; 0014).

export type CheckoutResult = { ok: false; error: string; blocked: BlockedItem[] };
export type OrderActionResult = { ok: true } | { ok: false; error: string };
export type ExpireResult = { ok: true; count: number } | { ok: false; error: string };

type DbError = { code?: string; message?: string };

function codeOf(action: string, error: DbError): string | null {
  const code = errorCodeFromDb(error);
  if (!code) console.error(`${action} failed`, error.code, error.message);
  return code;
}

type CheckoutRow = { ok: boolean; error_code: string | null; order_id: string | null; blocked: unknown };

/** Redeem the whole cart. On success goes to /orders/<id>; otherwise returns the Thai reasons. */
export async function checkoutCart(): Promise<CheckoutResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: orderErrorMessageTh("not_authenticated"), blocked: [] };
  if (user.role !== "student") return { ok: false, error: orderErrorMessageTh("not_student"), blocked: [] };

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("checkout");
  if (error) return { ok: false, error: orderErrorMessageTh(codeOf("checkout", error)), blocked: [] };
  const row = data as CheckoutRow | null;
  if (!row?.ok || !row.order_id || !isUuid(row.order_id)) {
    refresh(); // show the latest cart, stock and balance next to the reasons
    return { ok: false, error: orderErrorMessageTh(row?.error_code ?? null), blocked: parseBlocked(row?.blocked) };
  }
  redirect(`/orders/${row.order_id}`);
}

async function staffRpc(fn: "complete_order" | "cancel_order" | "mark_order_ready", orderId: string): Promise<OrderActionResult> {
  if (!isUuid(orderId)) return { ok: false, error: orderErrorMessageTh("order_not_found") };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: orderErrorMessageTh("not_authenticated") };
  if (!isStaffRole(user.role)) return { ok: false, error: orderErrorMessageTh("not_staff") };

  const supabase = await createServerClient();
  const { error } = await supabase.rpc(fn, { p_order_id: orderId });
  if (error) return { ok: false, error: orderErrorMessageTh(codeOf(fn, error)) };
  refresh();
  return { ok: true };
}

/** Staff: the student picked the order up. */
export async function completeOrder(orderId: string): Promise<OrderActionResult> {
  return staffRpc("complete_order", orderId);
}

/** Staff: the reward has been prepared; the student is notified (status stays pending_pickup). */
export async function markOrderReady(orderId: string): Promise<OrderActionResult> {
  return staffRpc("mark_order_ready", orderId);
}

/** Staff: cancel a pending order (stock and points go back). */
export async function cancelOrder(orderId: string): Promise<OrderActionResult> {
  return staffRpc("cancel_order", orderId);
}

/** Admin: expire every pending order past its pickup deadline now (same function as pg_cron). */
export async function expireDueOrders(): Promise<ExpireResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: orderErrorMessageTh("not_authenticated") };
  if (!isAdminRole(user.role)) return { ok: false, error: orderErrorMessageTh("not_admin") };

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("expire_orders");
  if (error) return { ok: false, error: orderErrorMessageTh(codeOf("expire_orders", error)) };
  refresh();
  return { ok: true, count: Number(data ?? 0) };
}
