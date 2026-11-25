import { safeNextPath } from "@/lib/auth/routes";
import { errorCodeFromDb, errorMessageTh } from "@/lib/errors";

// Round 6 (old-site features 5): pure helpers for website problem reports. The rules match 0039's checks.

export const REPORT_MESSAGE_MAX = 1000;
export const REPORT_NOTE_MAX = 500;
export const REPORT_PATH_MAX = 300;
export const REPORTS_PER_PAGE = 20;

// The same characters as the SQL btrim(..., E' \t\r\n'), so a message valid here is valid there.
const EDGE_SPACE = /^[ \t\r\n]+|[ \t\r\n]+$/g;

export function trimReportText(text: string): string {
  return text.replace(EDGE_SPACE, "");
}

/** The page the problem happened on: a same-site path (at most 300 characters), or null. Never a fallback. */
export function safeReportPath(from: string | null | undefined): string | null {
  if (!from) return null;
  const sentinel = "\u0000none";
  const path = safeNextPath(from, sentinel);
  if (path === sentinel || path.length > REPORT_PATH_MAX) return null;
  return path;
}

export function validateReportMessage(text: string): { ok: true; value: string } | { ok: false; error: string } {
  // a submitted textarea sends CRLF line breaks: count (and store) each as one character, as the user sees it
  const value = trimReportText(text.replace(/\r\n?/g, "\n"));
  if (value.includes("\u0000")) return { ok: false, error: "ข้อความมีอักขระที่ใช้ไม่ได้" };
  if (value === "") return { ok: false, error: "เขียนรายละเอียดปัญหาก่อนส่ง" };
  if (Array.from(value).length > REPORT_MESSAGE_MAX) return { ok: false, error: "เขียนได้ไม่เกิน 1,000 ตัวอักษร" };
  return { ok: true, value };
}

const REPORT_ERRORS: Record<string, { error?: string; fieldError?: string }> = {
  too_many_reports: { error: "แจ้งปัญหาครบ 5 ครั้งใน 24 ชั่วโมงแล้ว ลองใหม่ภายหลัง" },
  report_not_found: { error: "ไม่พบเรื่องที่แจ้งนี้ รีเฟรชหน้าเพื่อดูรายการล่าสุด" },
};

/**
 * The Thai message for an error from submit_problem_report / resolve_problem_report (0039), or null for an unknown
 * error (the caller logs it and shows the generic message). The codes come back as the error message.
 */
export function reportErrorFromDb(
  dbError: { message?: string | null } | null | undefined,
  context: "submit" | "resolve",
): { error?: string; fieldError?: string } | null {
  const code = dbError?.message?.trim() ?? "";
  if (code === "demo_scope") return { error: context === "submit" ? "บัญชีสาธิตแจ้งปัญหาไม่ได้" : "บัญชีสาธิตจัดการได้เฉพาะเรื่องที่บัญชีสาธิตแจ้ง" };
  if (code === "invalid_input") return context === "submit" ? { fieldError: "ตรวจข้อความอีกครั้ง" } : { error: "ข้อมูลไม่ถูกต้อง ตรวจแล้วลองอีกครั้ง" };
  if (Object.hasOwn(REPORT_ERRORS, code)) return REPORT_ERRORS[code];
  const shared = errorCodeFromDb(dbError);
  return shared ? { error: errorMessageTh(shared) } : null;
}

/**
 * The href for a stored page link on the admin list, or null to show it as plain text: only a path that
 * safeReportPath keeps exactly as stored (no dot segments that could normalise to "//host"). Defence in depth: a
 * signed-in user can call submit_problem_report directly.
 */
export function reportLinkHref(stored: string): string | null {
  return safeReportPath(stored) === stored && !/\/\.\.?(\/|$)/.test(stored.split(/[?#]/)[0]) ? stored : null;
}
