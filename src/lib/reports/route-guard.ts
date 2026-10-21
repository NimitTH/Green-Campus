import { getCurrentUser } from "@/lib/auth/dal";
import { isStaffRole } from "@/lib/auth/routes";
import { parseDateRange, type DateRange } from "./range";

// The shared front of the report download routes (/api/reports/csv and /api/reports/pdf; spec 8.5,
// R105/R110): staff only, checked before anything is generated, then the from/to range. Every answer
// is private, no-store. Call it OUTSIDE the route's try block: reading the session is what marks the
// route request-time, and a try/catch around it would swallow Next's prerender signal.

export const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export function reportText(code: 400 | 401 | 403 | 500, body: string): Response {
  return new Response(body, { status: code, headers: { ...NO_STORE, "Content-Type": "text/plain; charset=utf-8" } });
}

/** 401 anonymous, 403 not staff, 400 bad range (Thai messages); otherwise the parsed range. */
export async function guardReportRequest(params: URLSearchParams): Promise<{ range: DateRange; error?: never } | { error: Response; range?: never }> {
  const user = await getCurrentUser();
  if (!user) return { error: reportText(401, "กรุณาเข้าสู่ระบบ") };
  if (!isStaffRole(user.role)) return { error: reportText(403, "เฉพาะครูและผู้ดูแลระบบ") };
  const range = parseDateRange(params.get("from"), params.get("to"));
  if (!range.ok) return { error: reportText(400, range.message) };
  return { range: { from: range.from, to: range.to } };
}
