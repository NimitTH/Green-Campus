"use server";

import { getCurrentUser } from "@/lib/auth/dal";
import { errorMessageTh, GENERIC_ERROR_TH } from "@/lib/errors";
import { createServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

// Reachable by direct POST. The user-scoped client means RLS (own rows) and the column grant
// (read_at only) enforce ownership; the DAL check only gives a clean not_authenticated message.

export type NotificationActionResult = { ok: true } | { ok: false; error: string };

/** Set read_at = now() on one of the caller's unread notifications (already-read rows are left alone). */
export async function markNotificationRead(id: string): Promise<NotificationActionResult> {
  if (!isUuid(id)) return { ok: false, error: GENERIC_ERROR_TH };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: errorMessageTh("not_authenticated") };

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  if (error) {
    console.error("markNotificationRead failed", error.code, error.message);
    return { ok: false, error: GENERIC_ERROR_TH };
  }
  return { ok: true };
}

/** Mark every unread notification of the caller as read. */
export async function markAllNotificationsRead(): Promise<NotificationActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: errorMessageTh("not_authenticated") };

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) {
    console.error("markAllNotificationsRead failed", error.code, error.message);
    return { ok: false, error: GENERIC_ERROR_TH };
  }
  return { ok: true };
}
