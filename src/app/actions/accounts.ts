"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateTempPassword } from "@/lib/accounts/temp-password";
import { banDurationFor, confirmNameMatches, isSuspendInput, validateSuspend, type SuspendFieldErrors } from "@/lib/accounts/validation";
import { getActiveUser, type CurrentUser } from "@/lib/auth/dal";
import { isAdminRole, isStaffRole } from "@/lib/auth/routes";
import { accountErrorMessageTh, errorMessageTh, GENERIC_ERROR_TH } from "@/lib/errors";
import { isProfileInputShape, validateProfile, type ProfileFieldErrors } from "@/lib/profile/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

// DESIGN-4 6.2: the student account commands of /staff/students/[id]. This is the only file allowed to use the
// Auth admin client (secret key). Server Actions are reachable by direct POST with any payload, so each command:
//   1. checks its input shape and the caller (getActiveUser: signed in, not suspended, no pending password change)
//      and the caller's role (teacher+admin, or admin only);
//   2. calls the 0036 database function with the CALLER's session, which checks the 6.3 rules again (staff/admin,
//      not self, target is a student, demo scope, input) and records the account event;
//   3. only then does the Auth step with the admin client (password, ban, delete);
//   4. revalidates the pages.
// The database is the authority (6.4): when step 3 fails after step 2, the change already counts and the command can
// be repeated safely. The temporary password is returned to the acting staff member only; it is never stored,
// logged or put in a URL, and error logs carry Auth error codes only.

export type AccountActionResult = { ok: true } | { ok: false; error: string };
export type ResetPasswordResult = { ok: true; password: string } | { ok: false; error: string };
export type SuspendActionResult = { ok: true } | { ok: false; error?: string; fieldErrors?: SuspendFieldErrors };
export type RenameActionResult = { ok: true } | { ok: false; error?: string; fieldErrors?: ProfileFieldErrors };

const AUTH_STEP_FAILED = "บันทึกแล้ว แต่ระบบเข้าสู่ระบบยังไม่อัปเดต กดอีกครั้ง";
const RESET_FAILED = "รีเซ็ตรหัสผ่านไม่สำเร็จ ลองอีกครั้ง";
const DELETE_FAILED = "ลบบัญชีไม่สำเร็จ ลองอีกครั้ง";
const NAME_MISMATCH = "ชื่อที่พิมพ์ไม่ตรงกับชื่อ-นามสกุลของนักเรียน";
const NOT_STUDENT = accountErrorMessageTh("not_student");

type Gate = { ok: true; user: CurrentUser } | { ok: false; error: string };

/** The caller, when signed in, active and allowed (staff, or admin with adminOnly). */
async function caller(adminOnly: boolean): Promise<Gate> {
  const active = await getActiveUser();
  if (!active.ok) return { ok: false, error: errorMessageTh(active.code) };
  const allowed = adminOnly ? isAdminRole(active.user.role) : isStaffRole(active.user.role);
  if (!allowed) return { ok: false, error: accountErrorMessageTh(adminOnly ? "not_admin" : "not_staff") };
  return { ok: true, user: active.user };
}

function logDb(name: string, error: { code?: string; message?: string }): void {
  // the codes the 0036 functions raise are expected refusals; anything else is worth a log line
  const known = ["not_staff", "not_admin", "not_student", "demo_scope", "self_target", "invalid_input", "must_change_password"];
  if (!known.includes(error.message?.trim() ?? "")) console.error(`${name} failed`, error.code, error.message);
}

function logAuth(name: string, error: { code?: string; status?: number }): void {
  // never the request body: for a reset it carries the temporary password
  console.error(`${name}: auth admin step failed`, error.code, error.status);
}

function revalidateStudent(studentId: string): void {
  revalidatePath("/staff/students");
  revalidatePath(`/staff/students/${studentId}`);
  revalidatePath(`/staff/users/${studentId}`);
}

/** Teacher or admin: sets the forced-change flag, then a new temporary password, shown once to the caller. */
export async function resetStudentPassword(studentId: string): Promise<ResetPasswordResult> {
  if (typeof studentId !== "string" || !isUuid(studentId)) return { ok: false, error: NOT_STUDENT };
  const gate = await caller(false);
  if (!gate.ok) return gate;

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("staff_begin_password_reset", { p_student: studentId });
  if (error) {
    logDb("staff_begin_password_reset", error);
    return { ok: false, error: accountErrorMessageTh(error) };
  }

  const password = generateTempPassword();
  const { error: authError } = await createAdminClient().auth.admin.updateUserById(studentId, { password });
  // The flag set above is harmless on its own (DESIGN-4 6.2): the student is asked to choose a new password.
  if (authError) {
    logAuth("resetStudentPassword", authError);
    return { ok: false, error: RESET_FAILED };
  }
  revalidateStudent(studentId);
  return { ok: true, password };
}

/** Teacher or admin: suspend (or change a running suspension) in the database, then ban in Auth to match. */
export async function suspendStudent(studentId: string, input: unknown): Promise<SuspendActionResult> {
  if (typeof studentId !== "string" || !isUuid(studentId)) return { ok: false, error: NOT_STUDENT };
  if (!isSuspendInput(input)) return { ok: false, error: GENERIC_ERROR_TH };
  const gate = await caller(false);
  if (!gate.ok) return gate;

  const valid = validateSuspend(input);
  if (!valid.ok) return { ok: false, fieldErrors: valid.fieldErrors };

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("staff_suspend_student", { p_student: studentId, p_days: valid.days, p_reason: valid.reason });
  if (error) {
    logDb("staff_suspend_student", error);
    return { ok: false, error: accountErrorMessageTh(error) };
  }
  revalidateStudent(studentId);

  const { error: authError } = await createAdminClient().auth.admin.updateUserById(studentId, { ban_duration: banDurationFor(valid.days) });
  if (authError) {
    logAuth("suspendStudent", authError);
    return { ok: false, error: AUTH_STEP_FAILED };
  }
  return { ok: true };
}

/** Teacher or admin: lift the suspension in the database, then the Auth ban. */
export async function unsuspendStudent(studentId: string): Promise<AccountActionResult> {
  if (typeof studentId !== "string" || !isUuid(studentId)) return { ok: false, error: NOT_STUDENT };
  const gate = await caller(false);
  if (!gate.ok) return gate;

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("staff_unsuspend_student", { p_student: studentId });
  if (error) {
    logDb("staff_unsuspend_student", error);
    return { ok: false, error: accountErrorMessageTh(error) };
  }
  revalidateStudent(studentId);

  const { error: authError } = await createAdminClient().auth.admin.updateUserById(studentId, { ban_duration: "none" });
  if (authError) {
    logAuth("unsuspendStudent", authError);
    return { ok: false, error: AUTH_STEP_FAILED };
  }
  return { ok: true };
}

/** Admin: full name + display name, the /profile rules (database only, no Auth step). */
export async function renameStudent(studentId: string, input: unknown): Promise<RenameActionResult> {
  if (typeof studentId !== "string" || !isUuid(studentId)) return { ok: false, error: NOT_STUDENT };
  if (!isProfileInputShape(input)) return { ok: false, error: GENERIC_ERROR_TH };
  const gate = await caller(true);
  if (!gate.ok) return gate;

  const valid = validateProfile(input);
  if (!valid.ok) return { ok: false, fieldErrors: valid.fieldErrors };

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("admin_set_student_name", {
    p_student: studentId,
    p_full_name: valid.value.full_name,
    p_display_name: valid.value.display_name ?? "",
  });
  if (error) {
    logDb("admin_set_student_name", error);
    return { ok: false, error: accountErrorMessageTh(error) };
  }
  revalidateStudent(studentId);
  revalidatePath("/staff/users");
  return { ok: true };
}

/**
 * Admin: delete the account for good. The typed name must equal the student's full name (checked here against the
 * name the database returns, not the one the form had). Order (DESIGN-4 6.2): check -> Auth delete (cascades) ->
 * record the event -> /staff/students?deleted=1.
 */
export async function deleteStudent(studentId: string, confirmName: unknown): Promise<AccountActionResult> {
  if (typeof studentId !== "string" || !isUuid(studentId)) return { ok: false, error: NOT_STUDENT };
  if (typeof confirmName !== "string") return { ok: false, error: GENERIC_ERROR_TH };
  const gate = await caller(true);
  if (!gate.ok) return gate;

  const supabase = await createServerClient();
  const { data: fullName, error } = await supabase.rpc("admin_check_student_delete", { p_student: studentId });
  if (error) {
    logDb("admin_check_student_delete", error);
    return { ok: false, error: accountErrorMessageTh(error) };
  }
  if (typeof fullName !== "string" || !confirmNameMatches(confirmName, fullName)) return { ok: false, error: NAME_MISMATCH };

  const { error: authError } = await createAdminClient().auth.admin.deleteUser(studentId);
  if (authError) {
    logAuth("deleteStudent", authError);
    return { ok: false, error: DELETE_FAILED };
  }

  // The account is gone; a failure here loses only the history line (logged), never the delete itself.
  const { error: recordError } = await supabase.rpc("admin_record_student_deleted", { p_student: studentId, p_name: fullName });
  if (recordError) console.error("admin_record_student_deleted failed", recordError.code, recordError.message);

  revalidatePath("/staff/students");
  revalidatePath("/staff/users");
  redirect("/staff/students?deleted=1");
}
