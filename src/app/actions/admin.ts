"use server";

import { revalidatePath } from "next/cache";
import {
  hasStringFields,
  validateAdjust,
  validateRate,
  type AdjustFieldErrors,
  type AdjustInput,
  type RateFieldErrors,
  type RateInput,
} from "@/lib/admin/validation";
import { getCurrentUser } from "@/lib/auth/dal";
import { isAdminRole, toRole } from "@/lib/auth/routes";
import { errorCodeFromDb, errorMessageTh, GENERIC_ERROR_TH } from "@/lib/errors";
import { createServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

// Admin-only actions (Task 18 Part A). Server Actions are reachable by direct POST: each one checks the
// caller (DAL) and the database checks again (set_user_role / adjust_ledger are admin-only definer
// functions, waste_categories UPDATE is admin-only by RLS, 0002/0019).

const ADMIN_ONLY = errorMessageTh("not_admin");
const RATE_NOT_FOUND = "ไม่พบกลุ่มขยะนี้ รีเฟรชหน้าเพื่อดูรายการล่าสุด";
const RATE_CHANGED = "อัตรานี้ถูกแก้ไขไปแล้วระหว่างที่คุณแก้ กรุณาโหลดหน้าใหม่แล้วแก้อีกครั้ง";
const RATE_NAME_TAKEN = "ชื่อนี้ซ้ำกับกลุ่มขยะอื่น ใช้ชื่ออื่น";

export type AdminActionResult = { ok: true; error?: undefined } | { ok: false; error: string };

async function isAdminCaller(): Promise<boolean> {
  const user = await getCurrentUser();
  return !!user && isAdminRole(user.role);
}

function dbError(name: string, error: { code?: string; message?: string }): string {
  const code = errorCodeFromDb(error);
  if (!code) console.error(`${name} failed`, error.code, error.message);
  return errorMessageTh(code);
}

/** set_user_role through the caller's session. */
export async function changeUserRole(userId: string, role: string): Promise<AdminActionResult> {
  if (typeof userId !== "string" || !isUuid(userId)) return { ok: false, error: errorMessageTh("user_not_found") };
  const newRole = toRole(role);
  if (!newRole) return { ok: false, error: errorMessageTh("invalid_role") };
  if (!(await isAdminCaller())) return { ok: false, error: ADMIN_ONLY };

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("set_user_role", { p_user: userId, p_role: newRole });
  if (error) return { ok: false, error: dbError("set_user_role", error) };
  revalidatePath("/staff/users");
  revalidatePath(`/staff/users/${userId}`);
  return { ok: true };
}

export type AdjustResult =
  | { ok: true; error?: undefined; fieldErrors?: undefined }
  | { ok: false; error?: string; fieldErrors?: AdjustFieldErrors };

/** adjust_ledger: add or deduct points / carbon for a student, with a required reason. */
export async function adjustStudentLedger(studentId: string, input: AdjustInput): Promise<AdjustResult> {
  if (typeof studentId !== "string" || !isUuid(studentId)) return { ok: false, error: errorMessageTh("not_student_target") };
  if (!hasStringFields(input, ["points", "carbonKg", "note"] as const)) return { ok: false, error: GENERIC_ERROR_TH };
  if (!(await isAdminCaller())) return { ok: false, error: ADMIN_ONLY };

  const result = validateAdjust(input);
  if (!result.ok) return { ok: false, fieldErrors: result.fieldErrors };

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("adjust_ledger", {
    p_student: studentId,
    p_points: result.value.points,
    p_carbon_kg: result.value.carbonKg,
    p_note: result.value.note,
  });
  if (error) return { ok: false, error: dbError("adjust_ledger", error) };
  revalidatePath("/staff/users");
  revalidatePath(`/staff/users/${studentId}`);
  return { ok: true };
}

export type SaveRateInput = RateInput & { id: string; loadedUpdatedAt: string };
export type SaveRateResult =
  | { ok: true; error?: undefined; fieldErrors?: undefined }
  | { ok: false; error?: string; fieldErrors?: RateFieldErrors };

/**
 * Update one waste category. Optimistic concurrency: the row is written only while its updated_at is
 * still the value the form was loaded with, so a second admin's edit is never silently overwritten.
 */
export async function saveRate(input: SaveRateInput): Promise<SaveRateResult> {
  if (!hasStringFields(input, ["id", "loadedUpdatedAt", "name", "pointsPerKg", "carbonKgPerKg", "sourceNote"] as const)) {
    return { ok: false, error: GENERIC_ERROR_TH };
  }
  if (!isUuid(input.id)) return { ok: false, error: RATE_NOT_FOUND };
  if (Number.isNaN(Date.parse(input.loadedUpdatedAt))) return { ok: false, error: GENERIC_ERROR_TH };
  if (!(await isAdminCaller())) return { ok: false, error: ADMIN_ONLY };

  const result = validateRate(input);
  if (!result.ok) return { ok: false, fieldErrors: result.fieldErrors };

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("waste_categories")
    .update(result.value)
    .eq("id", input.id)
    .eq("updated_at", input.loadedUpdatedAt)
    .select("id");
  if (error) {
    if (error.code === "23505") return { ok: false, fieldErrors: { name: RATE_NAME_TAKEN } };
    return { ok: false, error: dbError("saveRate", error) };
  }
  if (!data || data.length === 0) {
    const { data: still } = await supabase.from("waste_categories").select("id").eq("id", input.id).maybeSingle();
    return { ok: false, error: still ? RATE_CHANGED : RATE_NOT_FOUND };
  }
  revalidatePath("/staff/rates");
  return { ok: true };
}
