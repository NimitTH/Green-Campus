import type { Metadata } from "next";
import { Suspense } from "react";
import { Badge } from "@/app/_components/activity-ui";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { requireUser } from "@/lib/auth/dal";
import { submissionStatusLabelTh } from "@/lib/activities/labels";
import { formatBangkok } from "@/lib/datetime";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "ผลที่ส่ง | Green Campus" };

// Minimal history for Task 8; Task 11 extends this page.
export default function MySubmissionsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <h1 className="mb-5 text-xl font-semibold">ผลที่ส่ง</h1>
      <Suspense fallback={<PageSkeleton />}>
        <SubmissionList />
      </Suspense>
    </main>
  );
}

type Row = {
  id: string;
  status: string;
  created_at: string;
  reject_reason: string | null;
  activities: { title: string } | { title: string }[] | null;
};

const TONE: Record<string, "gray" | "green" | "amber"> = { pending: "amber", approved: "green", rejected: "gray" };

async function SubmissionList() {
  const user = await requireUser("/my-submissions");
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("submissions")
    .select("id, status, created_at, reject_reason, activities(title)")
    .eq("student_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`my-submissions: ${error.message}`);
  const rows = (data ?? []) as unknown as Row[];

  if (rows.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-gray-600 dark:border-gray-700 dark:text-gray-400">
        ยังไม่มีผลที่ส่ง
      </section>
    );
  }

  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const activity = Array.isArray(row.activities) ? row.activities[0] : row.activities;
        return (
          <li
            key={row.id}
            data-testid="submission"
            className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium break-words">{activity?.title ?? "-"}</p>
              <Badge tone={TONE[row.status] ?? "gray"}>{submissionStatusLabelTh(row.status)}</Badge>
            </div>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">ส่งเมื่อ {formatBangkok(row.created_at)}</p>
            {row.status === "rejected" && row.reject_reason ? (
              <p className="mt-2 text-sm text-red-800 dark:text-red-300">เหตุผล: {row.reject_reason}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
