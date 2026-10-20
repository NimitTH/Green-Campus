import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import type { ActivityType } from "./abnormal";

// Read helpers for /staff/reviews. They run as the signed-in user, so RLS decides what is
// visible (staff read every submission). Callers check the role via the DAL first.

type ProfileName = { full_name: string; display_name: string | null };
type One<T> = T | T[] | null;

function one<T>(value: One<T>): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function nameOf(profile: ProfileName | null): string {
  return profile?.display_name?.trim() || profile?.full_name || "-";
}

export type PendingSubmission = {
  id: string;
  createdAt: string;
  studentName: string;
  activityTitle: string;
  activityType: ActivityType;
  quantities: number[];
};

type PendingRaw = {
  id: string;
  created_at: string;
  activities: One<{ title: string; type: ActivityType }>;
  student: One<ProfileName>;
  submission_items: { quantity: number }[] | null;
};

/** Pending submissions, oldest first (R39). */
export async function listPendingSubmissions(): Promise<PendingSubmission[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("submissions")
    .select(
      "id, created_at, activities(title, type), student:profiles!submissions_student_id_fkey(full_name, display_name), submission_items(quantity)",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`listPendingSubmissions: ${error.message}`);
  return ((data ?? []) as unknown as PendingRaw[]).map((row) => {
    const activity = one(row.activities);
    return {
      id: row.id,
      createdAt: row.created_at,
      studentName: nameOf(one(row.student)),
      activityTitle: activity?.title ?? "-",
      activityType: activity?.type ?? "fixed",
      quantities: (row.submission_items ?? []).map((i) => i.quantity),
    };
  });
}

export type ReviewItem = {
  quantity: number;
  category: { name: string; pointsPerKg: number; carbonKgPerKg: number } | null;
};

export type SubmissionForReview = {
  id: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  reviewedAt: string | null;
  rejectReason: string | null;
  evidencePath: string | null;
  studentId: string;
  studentName: string;
  reviewerName: string | null;
  activity: { id: string; title: string; type: ActivityType; unitPoints: number; unitCarbonKg: number | null };
  items: ReviewItem[];
  /** The earn row written at approval (approved submissions only). */
  earned: { points: number; carbonKg: number } | null;
};

type DetailRaw = {
  id: string;
  status: SubmissionForReview["status"];
  created_at: string;
  reviewed_at: string | null;
  reject_reason: string | null;
  evidence_path: string | null;
  student_id: string;
  student: One<ProfileName>;
  reviewer: One<ProfileName>;
  activities: One<{ id: string; title: string; type: ActivityType; unit_points: number; unit_carbon_kg: number | string | null }>;
  submission_items:
    | {
        quantity: number;
        waste_categories: One<{ name: string; points_per_kg: number; carbon_kg_per_kg: number | string }>;
      }[]
    | null;
  ledger_entries: { kind: string; points: number; carbon_kg: number | string }[] | null;
};

export async function getSubmissionForReview(id: string): Promise<SubmissionForReview | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("submissions")
    .select(
      [
        "id, status, created_at, reviewed_at, reject_reason, evidence_path, student_id",
        "student:profiles!submissions_student_id_fkey(full_name, display_name)",
        "reviewer:profiles!submissions_reviewed_by_fkey(full_name, display_name)",
        "activities(id, title, type, unit_points, unit_carbon_kg)",
        "submission_items(quantity, waste_categories(name, points_per_kg, carbon_kg_per_kg))",
        "ledger_entries(kind, points, carbon_kg)",
      ].join(", "),
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getSubmissionForReview: ${error.message}`);
  if (!data) return null;
  const row = data as unknown as DetailRaw;
  const activity = one(row.activities);
  if (!activity) return null;
  const reviewer = one(row.reviewer);
  const earn = (row.ledger_entries ?? []).find((l) => l.kind === "earn");

  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    rejectReason: row.reject_reason,
    evidencePath: row.evidence_path,
    studentId: row.student_id,
    studentName: nameOf(one(row.student)),
    reviewerName: reviewer ? nameOf(reviewer) : null,
    activity: {
      id: activity.id,
      title: activity.title,
      type: activity.type,
      unitPoints: activity.unit_points,
      unitCarbonKg: activity.unit_carbon_kg === null ? null : Number(activity.unit_carbon_kg),
    },
    items: (row.submission_items ?? []).map((item) => {
      const category = one(item.waste_categories);
      return {
        quantity: item.quantity,
        category: category
          ? { name: category.name, pointsPerKg: category.points_per_kg, carbonKgPerKg: Number(category.carbon_kg_per_kg) }
          : null,
      };
    }),
    earned: earn ? { points: earn.points, carbonKg: Number(earn.carbon_kg) } : null,
  };
}

/** Totals (Σ quantity) of the other pending/approved submissions of an activity (abnormal flag, R40). */
export async function otherSubmissionTotals(activityId: string, excludeId: string): Promise<number[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("submissions")
    .select("id, submission_items(quantity)")
    .eq("activity_id", activityId)
    .in("status", ["pending", "approved"])
    .neq("id", excludeId);
  if (error) throw new Error(`otherSubmissionTotals: ${error.message}`);
  return ((data ?? []) as unknown as { submission_items: { quantity: number }[] | null }[]).map((row) =>
    (row.submission_items ?? []).reduce((sum, i) => sum + i.quantity, 0),
  );
}

const EVIDENCE_URL_SECONDS = 300;

/**
 * Short-lived signed URL for the evidence photo (spec 8.4, R40). Uses the request's user-scoped
 * client, so the storage policy evidence_select (owner folder or is_staff) decides; never the
 * service role. Null when there is no photo or signing fails.
 */
export async function evidenceSignedUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabase = await createServerClient();
  const { data, error } = await supabase.storage.from("evidence").createSignedUrl(path, EVIDENCE_URL_SECONDS);
  if (error) {
    console.error("evidence signed url failed", error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}

/** Counts of the student's OTHER pending and approved submissions in the same activity (staff RLS). */
export async function studentActivityHistory(
  activityId: string,
  studentId: string,
  excludeId: string,
): Promise<{ pending: number; approved: number }> {
  const supabase = await createServerClient();
  const count = async (status: "pending" | "approved") => {
    const { count: n, error } = await supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("activity_id", activityId)
      .eq("student_id", studentId)
      .eq("status", status)
      .neq("id", excludeId);
    if (error) throw new Error(`studentActivityHistory: ${error.message}`);
    return n ?? 0;
  };
  const [pending, approved] = await Promise.all([count("pending"), count("approved")]);
  return { pending, approved };
}
