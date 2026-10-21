import type { NextRequest } from "next/server";
import { toCsv } from "@/lib/csv";
import { activityCsvRows, studentCsvRows } from "@/lib/reports/csv-rows";
import { getActivityReport, getStudentReport } from "@/lib/reports/data";
import { guardReportRequest, NO_STORE, reportText } from "@/lib/reports/route-guard";

// GET /api/reports/csv?kind=activities|students&from=YYYY-MM-DD&to=YYYY-MM-DD (Task 16, R105; spec 8.5, 10.1):
// the staff reports as Excel-safe UTF-8 CSV. Default Node runtime; request-time only (reads the session),
// every response private, no-store. Data comes through the user-scoped client; the report functions
// re-check the staff role. Never the service role here. Auth and range: route-guard.ts (shared with the PDF).

export async function GET(request: NextRequest): Promise<Response> {
  const params = request.nextUrl.searchParams;
  const guard = await guardReportRequest(params);
  if (guard.error) return guard.error;
  const { range } = guard;
  const kind = params.get("kind");
  if (kind !== "activities" && kind !== "students") return reportText(400, "ประเภทรายงานไม่ถูกต้อง (activities หรือ students)");

  try {
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
    return reportText(500, "สร้างรายงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
  }
}
