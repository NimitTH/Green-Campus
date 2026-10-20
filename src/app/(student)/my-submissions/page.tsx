import type { Metadata } from "next";
import { Suspense } from "react";
import { Badge } from "@/app/_components/activity-ui";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { requireUser } from "@/lib/auth/dal";
import { submissionStatusLabelTh, typeLabelTh } from "@/lib/activities/labels";
import { formatBangkok } from "@/lib/datetime";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "ผลที่ส่ง | Green Campus" };

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
  activities: { title: string; type: string } | { title: string; type: string }[] | null;
  submission_items: {
    quantity: number;
    waste_categories: { name: string } | { name: string }[] | null;
  }[];
};

type Earn = { ref_submission_id: string; points: number; carbon_kg: number | string };

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const kgFormat = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 3 });
const carbonFormat = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 3 });

function amountsTh(row: Row, type: string | undefined): string {
  if (type === "waste") {
    return row.submission_items
      .map((i) => ({ name: one(i.waste_categories)?.name ?? "-", grams: i.quantity }))
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
      .map((i) => `${i.name} ${kgFormat.format(i.grams / 1000)} กก.`)
      .join(", ");
  }
  if (type === "trees") {
    return `${row.submission_items.reduce((s, i) => s + i.quantity, 0).toLocaleString("th-TH")} ต้น`;
  }
  return "เข้าร่วม";
}

const TONE: Record<string, "gray" | "green" | "amber"> = { pending: "amber", approved: "green", rejected: "gray" };

async function SubmissionList() {
  const user = await requireUser("/my-submissions");
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("submissions")
    .select(
      "id, status, created_at, reject_reason, activities(title, type), submission_items(quantity, waste_categories(name))",
    )
    .eq("student_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`my-submissions: ${error.message}`);
  const rows = (data ?? []) as unknown as Row[];

  const approvedIds = rows.filter((r) => r.status === "approved").map((r) => r.id);
  const earns = new Map<string, Earn>();
  if (approvedIds.length > 0) {
    const { data: ledger, error: ledgerError } = await supabase
      .from("ledger_entries")
      .select("ref_submission_id, points, carbon_kg")
      .eq("kind", "earn")
      .in("ref_submission_id", approvedIds);
    if (ledgerError) throw new Error(`my-submissions: ${ledgerError.message}`);
    for (const e of (ledger ?? []) as Earn[]) earns.set(e.ref_submission_id, e);
  }

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
        const activity = one(row.activities);
        const earn = earns.get(row.id);
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
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {activity ? typeLabelTh(activity.type) : "-"} · {amountsTh(row, activity?.type)}
            </p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">ส่งเมื่อ {formatBangkok(row.created_at)}</p>
            {row.status === "approved" && earn ? (
              <p className="mt-2 text-sm text-green-800 dark:text-green-300">
                ได้ {earn.points.toLocaleString("th-TH")} แต้ม · {carbonFormat.format(Number(earn.carbon_kg))} กก. CO2e
              </p>
            ) : null}
            {row.status === "rejected" && row.reject_reason ? (
              <p className="mt-2 text-sm text-red-800 dark:text-red-300">เหตุผล: {row.reject_reason}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
