import { safeNextPath } from "@/lib/auth/routes";

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
  const value = trimReportText(text);
  if (value === "") return { ok: false, error: "เขียนรายละเอียดปัญหาก่อนส่ง" };
  if (Array.from(value).length > REPORT_MESSAGE_MAX) return { ok: false, error: "เขียนได้ไม่เกิน 1,000 ตัวอักษร" };
  return { ok: true, value };
}
