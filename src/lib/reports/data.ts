import { createServerClient } from "@/lib/supabase/server";

// Report data (Task 16): the two staff-only report_* functions, called with the user-scoped client
// (never the service role). Grams stay integers here; the CSV and the page convert to kg.

export type ActivityReportRow = {
  title: string;
  endsOn: string;
  participants: number;
  approvedSubmissions: number;
  gramsPlastic: number;
  gramsPaper: number;
  gramsMetalGlass: number;
  gramsOther: number;
  trees: number;
  points: number;
  carbonKg: number;
};
export type StudentReportRow = { fullName: string; points: number; carbonKg: number; gramsTotal: number; trees: number };

type RawActivity = {
  title: string;
  ends_on: string;
  participants: number;
  approved_submissions: number;
  grams_plastic: number | string;
  grams_paper: number | string;
  grams_metal_glass: number | string;
  grams_other: number | string;
  trees: number | string;
  points: number | string;
  carbon_kg: number | string;
};
type RawStudent = { full_name: string; points: number | string; carbon_kg: number | string; grams_total: number | string; trees: number | string };

export async function getActivityReport(from: string, to: string): Promise<ActivityReportRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("report_activities", { p_from: from, p_to: to });
  if (error) throw new Error(`report_activities: ${error.message}`);
  return ((data ?? []) as RawActivity[]).map((r) => ({
    title: r.title,
    endsOn: r.ends_on,
    participants: Number(r.participants),
    approvedSubmissions: Number(r.approved_submissions),
    gramsPlastic: Number(r.grams_plastic),
    gramsPaper: Number(r.grams_paper),
    gramsMetalGlass: Number(r.grams_metal_glass),
    gramsOther: Number(r.grams_other),
    trees: Number(r.trees),
    points: Number(r.points),
    carbonKg: Number(r.carbon_kg),
  }));
}

export async function getStudentReport(from: string, to: string): Promise<StudentReportRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("report_students", { p_from: from, p_to: to });
  if (error) throw new Error(`report_students: ${error.message}`);
  return ((data ?? []) as RawStudent[]).map((r) => ({
    fullName: r.full_name,
    points: Number(r.points),
    carbonKg: Number(r.carbon_kg),
    gramsTotal: Number(r.grams_total),
    trees: Number(r.trees),
  }));
}
