import Link from "next/link";
import { WasteByCategory } from "@/components/charts/WasteByCategory";
import { Badge } from "@/app/_components/activity-ui";
import { Card, EmptyState, Stat } from "@/components/ui";
import { submissionStatusLabelTh } from "@/lib/activities/labels";
import { formatBangkok } from "@/lib/datetime";
import { createServerClient } from "@/lib/supabase/server";

const carbonFormat = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 3 });
const intFormat = new Intl.NumberFormat("th-TH");
const TONE: Record<string, "gray" | "green" | "amber"> = { pending: "amber", approved: "green", rejected: "gray" };

type Recent = {
  id: string;
  status: string;
  created_at: string;
  activities: { title: string } | { title: string }[] | null;
};
type ApprovedRow = {
  activities: { type: string } | { type: string }[] | null;
  submission_items: { quantity: number }[];
};

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

// Must be rendered after the session read (inside <Suspense>), see the dashboard page.
export async function StudentStats({ studentId }: { studentId: string }) {
  const supabase = await createServerClient();
  const [balance, categories, totals, recent, approved, approvedCount] = await Promise.all([
    supabase.from("student_balance").select("points, carbon_kg").eq("student_id", studentId).maybeSingle(),
    supabase.from("waste_categories").select("id, name").order("name"),
    supabase.from("student_waste_totals").select("waste_category_id, grams").eq("student_id", studentId),
    supabase
      .from("submissions")
      .select("id, status, created_at, activities(title)")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("submissions")
      .select("activities!inner(type), submission_items(quantity)")
      .eq("activities.type", "trees")
      .eq("student_id", studentId)
      .eq("status", "approved"),
    supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("status", "approved"),
  ]);
  for (const r of [balance, categories, totals, recent, approved, approvedCount]) {
    if (r.error) throw new Error(`dashboard: ${r.error.message}`);
  }

  const points = Number(balance.data?.points ?? 0);
  const carbon = Number(balance.data?.carbon_kg ?? 0);
  const gramsById = new Map((totals.data ?? []).map((t) => [t.waste_category_id as string, Number(t.grams)]));
  const chartData = [...(categories.data ?? [])]
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map((c) => ({
      name: c.name as string,
      kg: (gramsById.get(c.id as string) ?? 0) / 1000,
    }));
  const totalGrams = [...gramsById.values()].reduce((a, b) => a + b, 0);
  const approvedRows = (approved.data ?? []) as unknown as ApprovedRow[];
  const trees = approvedRows.reduce((sum, r) => sum + r.submission_items.reduce((s, i) => s + i.quantity, 0), 0);
  const recentRows = (recent.data ?? []) as unknown as Recent[];

  return (
    <>
      <Card tone="accent" className="mb-4 grid grid-cols-2 gap-4">
        <Stat label="แต้มคงเหลือ" size="lg" data-testid="points" className="break-words">
          {intFormat.format(points)}
        </Stat>
        <Stat label="คาร์บอนสะสม" size="lg" className="break-words">
          <span data-testid="carbon">{carbonFormat.format(carbon)}</span>{" "}
          <span className="text-sm font-normal">กก. CO2e</span>
        </Stat>
      </Card>
      {trees > 0 ? (
        <p data-testid="trees" className="mb-4 text-sm text-muted">
          ปลูกต้นไม้แล้วทั้งหมด {intFormat.format(trees)} ต้น
        </p>
      ) : null}

      <Card as="section" className="mb-4">
        <h2 className="mb-3 font-display font-semibold">น้ำหนักขยะที่อนุมัติแล้ว (กก.) แยกตามกลุ่ม</h2>
        {totalGrams > 0 ? (
          <WasteByCategory data={chartData} />
        ) : (approvedCount.count ?? 0) === 0 ? (
          <EmptyState>
            <p>ยังไม่มีผลกิจกรรม</p>
            <Link href="/activities" className="text-accent underline">
              ดูกิจกรรม
            </Link>
          </EmptyState>
        ) : (
          <EmptyState>ยังไม่มีผลขยะที่อนุมัติ</EmptyState>
        )}
      </Card>

      <Card as="section">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display font-semibold">ประวัติล่าสุด</h2>
          <Link href="/my-submissions" className="text-sm text-accent underline">
            ดูทั้งหมด
          </Link>
        </div>
        {recentRows.length === 0 ? (
          <p className="text-sm text-muted">ยังไม่มีผลที่ส่ง</p>
        ) : (
          <ul className="divide-y divide-rule">
            {recentRows.map((r) => (
              <li key={r.id} data-testid="recent-submission" className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <div>
                  <p className="break-words">{one(r.activities)?.title ?? "-"}</p>
                  <p className="text-xs text-muted">{formatBangkok(r.created_at)}</p>
                </div>
                <Badge tone={TONE[r.status] ?? "gray"}>{submissionStatusLabelTh(r.status)}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
