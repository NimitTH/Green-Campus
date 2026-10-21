import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { isStaffRole } from "@/lib/auth/routes";
import { toCsv } from "@/lib/csv";
import { activityCsvRows, studentCsvRows } from "@/lib/reports/csv-rows";
import { getActivityReport, getStudentReport } from "@/lib/reports/data";
import { parseDateRange } from "@/lib/reports/range";

// GET /api/reports/csv?kind=activities|students&from=YYYY-MM-DD&to=YYYY-MM-DD (Task 16, R105; spec 8.5, 10.1):
// the staff reports as Excel-safe UTF-8 CSV. Default Node runtime; request-time only (reads the session),
// every response private, no-store. Data comes through the user-scoped client; the report functions
// re-check the staff role. Never the service role here.

const NO_STORE = { "Cache-Control": "private, no-store" };

function text(code: 400 | 401 | 403 | 500, body: string): Response {
  return new Response(body, { status: code, headers: { ...NO_STORE, "Content-Type": "text/plain; charset=utf-8" } });
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await getCurrentUser();
    if (!user) return text(401, "กรุณาเข้าสู่ระบบ");
    if (!isStaffRole(user.role)) return text(403, "เฉพาะครูและผู้ดูแลระบบ");

    const params = request.nextUrl.searchParams;
    const kind = params.get("kind");
    if (kind !== "activities" && kind !== "students") return text(400, "ประเภทรายงานไม่ถูกต้อง (activities หรือ students)");
    const range = parseDateRange(params.get("from"), params.get("to"));
    if (!range.ok) return text(400, range.message);

    const rows =
      kind === "activities"
        ? activityCsvRows(await getActivityReport(range.from, range.to))
        : studentCsvRows(await getStudentReport(range.from, range.to));
    return new Response(toCsv(rows), {
      status: 200,
      headers: {
        ...NO_STORE,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="report-${kind}-${range.from}-${range.to}.csv"`,
      },
    });
  } catch (error) {
    // Logged server-side only; the browser gets a generic message.
    console.error("report csv failed", error);
    return text(500, "สร้างรายงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
  }
}
