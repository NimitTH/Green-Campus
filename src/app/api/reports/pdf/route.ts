import type { NextRequest } from "next/server";
import { renderSummary } from "@/lib/pdf/summary";
import { summaryFromReport } from "@/lib/pdf/summary-data";
import { getActivityReport } from "@/lib/reports/data";
import { guardReportRequest, NO_STORE, reportText } from "@/lib/reports/route-guard";

// GET /api/reports/pdf?from=YYYY-MM-DD&to=YYYY-MM-DD (Task 17, R110; spec 8.5, 10.2): the summary
// report with three charts as a PDF download. Staff only, checked before anything is generated (401,
// 403, 400 as the CSV route). The rows come from report_activities through the user-scoped client
// (never the service role), so it counts exactly what the CSV counts. Node runtime, the default
// (pdfmake and the font files need it; with cacheComponents the `runtime` config is rejected). The
// fonts are in this route's trace through next.config.ts outputFileTracingIncludes "/api/reports/**".

export async function GET(request: NextRequest): Promise<Response> {
  const guard = await guardReportRequest(request.nextUrl.searchParams);
  if (guard.error) return guard.error;
  const { range } = guard;

  let pdf: Uint8Array;
  try {
    pdf = await renderSummary(summaryFromReport(await getActivityReport(range.from, range.to), range.from, range.to));
  } catch (error) {
    // Logged server-side only; the browser gets a generic message.
    console.error("report pdf failed", error);
    return reportText(500, "สร้างรายงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
  }
  return new Response(new Blob([pdf as Uint8Array<ArrayBuffer>], { type: "application/pdf" }), {
    status: 200,
    headers: {
      ...NO_STORE,
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="report-summary-${range.from}-${range.to}.pdf"`,
    },
  });
}
