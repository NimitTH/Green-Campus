import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import { REPORTS_PER_PAGE } from "./format";

// Round 6 (old-site features 5): /staff/problem-reports reads through the user-scoped client, so RLS (0039) decides:
// admins see every report. Callers check the role with requireAdmin.

export type ProblemReport = {
  id: string;
  reporterName: string;
  message: string;
  pageUrl: string | null;
  status: "open" | "done";
  adminNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

type Row = {
  id: string;
  reporter_name: string;
  message: string;
  page_url: string | null;
  status: string;
  admin_note: string | null;
  resolved_at: string | null;
  created_at: string;
};

/** One page of reports: open first, then newest first (id breaks ties). Throws on failure. */
export async function listProblemReports(page: number): Promise<{ items: ProblemReport[]; total: number }> {
  const supabase = await createServerClient();
  const from = (Math.max(1, page) - 1) * REPORTS_PER_PAGE;
  const { data, error, count } = await supabase
    .from("problem_reports")
    .select("id, reporter_name, message, page_url, status, admin_note, resolved_at, created_at", { count: "exact" })
    .order("status", { ascending: false }) // 'open' > 'done'
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + REPORTS_PER_PAGE - 1);
  if (error) throw new Error(`listProblemReports: ${error.message}`);
  return {
    total: count ?? 0,
    items: ((data ?? []) as Row[]).map((r) => ({
      id: r.id,
      reporterName: r.reporter_name,
      message: r.message,
      pageUrl: r.page_url,
      status: r.status === "done" ? "done" : "open",
      adminNote: r.admin_note,
      resolvedAt: r.resolved_at,
      createdAt: r.created_at,
    })),
  };
}
