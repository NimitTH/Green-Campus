"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/dal";
import { isAdminRole } from "@/lib/auth/routes";
import { errorCodeFromDb, errorMessageTh, GENERIC_ERROR_TH } from "@/lib/errors";
import { REPORT_NOTE_MAX, safeReportPath, trimReportText, validateReportMessage } from "@/lib/problem-reports/format";
import { createServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

// Round 6 (old-site features 5). Reachable by direct POST: the database functions (0039) re-check everything
// (signed in, admin for resolve, limits); the checks here only give clean Thai messages.

export type ReportFormState = { ok: true } | { ok: false; error?: string; fieldError?: string } | undefined;

const DEMO_REPORT_TH = "บัญชีสาธิตแจ้งปัญหาไม่ได้";

export async function submitProblemReport(_prev: ReportFormState, formData: FormData): Promise<ReportFormState> {
  const raw = String(formData.get("message") ?? "");
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: errorMessageTh("not_authenticated") };
  if (user.mustChangePassword) return { ok: false, error: errorMessageTh("must_change_password") };

  const checked = validateReportMessage(raw);
  if (!checked.ok) return { ok: false, fieldError: checked.error };
  const pageUrl = safeReportPath(String(formData.get("pageUrl") ?? ""));

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("submit_problem_report", { p_message: checked.value, p_page_url: pageUrl });
  if (error) {
    const code = errorCodeFromDb(error);
    if (code === "demo_scope") return { ok: false, error: DEMO_REPORT_TH };
    if (code === "invalid_input") return { ok: false, fieldError: "ตรวจข้อความอีกครั้ง" };
    if (code) return { ok: false, error: errorMessageTh(code) };
    console.error("submitProblemReport failed", error.code, error.message);
    return { ok: false, error: GENERIC_ERROR_TH };
  }
  return { ok: true };
}

export type ResolveState = { ok: true } | { ok: false; error: string } | undefined;

export async function resolveProblemReport(_prev: ResolveState, formData: FormData): Promise<ResolveState> {
  const id = String(formData.get("id") ?? "");
  const note = trimReportText(String(formData.get("note") ?? ""));
  if (!isUuid(id)) return { ok: false, error: errorMessageTh("report_not_found") };
  if (Array.from(note).length > REPORT_NOTE_MAX) return { ok: false, error: "หมายเหตุยาวได้ไม่เกิน 500 ตัวอักษร" };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: errorMessageTh("not_authenticated") };
  if (!isAdminRole(user.role)) return { ok: false, error: errorMessageTh("not_admin") };

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("resolve_problem_report", { p_id: id, p_note: note || null });
  if (error) {
    const code = errorCodeFromDb(error);
    if (code) return { ok: false, error: errorMessageTh(code) };
    console.error("resolveProblemReport failed", error.code, error.message);
    return { ok: false, error: GENERIC_ERROR_TH };
  }
  revalidatePath("/staff/problem-reports");
  return { ok: true };
}
