import type { Metadata } from "next";
import { Suspense } from "react";
import { WasteByCategory } from "@/components/charts/WasteByCategory";
import { Avatar, Card, EmptyState } from "@/components/ui";
import { Badge } from "@/app/_components/activity-ui";
import { RangeLinks } from "@/app/_components/range-links";
import { CARBON_MONTHS, WASTE_PERIODS, parseChartRange, wasteSince, type CarbonMonths, type WastePeriod } from "@/lib/admin/chart-range";
import { getStaffCharts } from "@/lib/admin/queries";
import { requireStaff } from "@/lib/auth/dal";
import { greetingFor, greetingName } from "@/lib/greeting";
import { DashboardSkeleton } from "@/app/_components/skeletons";
import { CarbonByMonth } from "./_components/carbon-by-month";
import { StaffStats } from "./_components/staff-stats";

export const metadata: Metadata = { title: "ครูและผู้ดูแล | Green Campus" };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
const WASTE_LABEL: Record<WastePeriod, string> = { "30d": "30 วัน", "12m": "12 เดือน", all: "ทั้งหมด" };

function chartHref(months: CarbonMonths, waste: WastePeriod): string {
  const params = new URLSearchParams();
  if (months !== 6) params.set("months", String(months));
  if (waste !== "all") params.set("waste", waste);
  const s = params.toString();
  return s ? `/staff?${s}` : "/staff";
}

export default function StaffPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <Suspense fallback={<DashboardSkeleton />}>
        <StaffHome searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

// DESIGN-4 4.3: the student dashboard header (greeting, 72px avatar, role badge before the name, email), the
// unchanged work/totals stats, then two school-wide charts, each streamed in its own boundary. No menu cards: the
// sidebar (or the drawer on phones) is the menu.
async function StaffHome({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireStaff();
  const sp = await searchParams;
  // round 6: the chart ranges live in the URL; unknown values fall back to 6 months / all waste
  const range = parseChartRange({ months: one(sp.months), waste: one(sp.waste) });
  const since = wasteSince(range.waste, new Date());
  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-[clamp(1.75rem,2vw+1rem,2.25rem)] font-semibold leading-tight tracking-[-0.01em] text-ink">
          {`${greetingFor(new Date())} ${greetingName(user)}`}
        </h1>
        <div className="mt-3 flex items-center gap-3">
          <Avatar name={greetingName(user)} url={user.avatarUrl} size={72} />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-semibold break-words text-ink">
              <Badge tone={user.role === "admin" ? "amber" : "green"} data-testid="staff-role">
                {user.role === "admin" ? "ผู้ดูแลระบบ" : "ครู"}
              </Badge>
              <span data-testid="staff-name">{user.fullName}</span>
            </p>
            <p className="text-sm break-all text-muted">{user.email}</p>
          </div>
        </div>
      </div>
      <Suspense fallback={<div aria-hidden="true" className="mb-6 h-40 motion-safe:animate-pulse rounded-card bg-paper-2" />}>
        <StaffStats />
      </Suspense>
      <div className="grid gap-4 md:grid-cols-2">
        <Card as="section">
          <h2 className="mb-3 font-display font-semibold">carbon ที่ลดได้รายเดือน (กก. CO₂e)</h2>
          <RangeLinks
            label="ช่วงกราฟ carbon"
            className="mb-3"
            items={CARBON_MONTHS.map((m) => ({ href: chartHref(m, range.waste), label: `${m} เดือน`, current: m === range.months }))}
          />
          <Suspense fallback={<ChartSkeleton />}>
            <CarbonChart months={range.months} since={since} />
          </Suspense>
        </Card>
        <Card as="section">
          <h2 className="mb-3 font-display font-semibold">ขยะแยกตามกลุ่ม (กก.)</h2>
          <RangeLinks
            label="ช่วงกราฟขยะ"
            className="mb-3"
            items={WASTE_PERIODS.map((w) => ({ href: chartHref(range.months, w), label: WASTE_LABEL[w], current: w === range.waste }))}
          />
          <Suspense fallback={<ChartSkeleton />}>
            <WasteChart months={range.months} since={since} />
          </Suspense>
        </Card>
      </div>
    </>
  );
}

type ChartProps = { months: CarbonMonths; since: string | null };

async function loadCharts({ months, since }: ChartProps) {
  try {
    return await getStaffCharts(months, since);
  } catch (e) {
    console.error("StaffCharts failed", e instanceof Error ? e.message : e);
    return null;
  }
}

async function CarbonChart(props: ChartProps) {
  const charts = await loadCharts(props);
  if (!charts) return <ChartError />;
  if (charts.months.every((m) => m.carbonKg === 0)) return <ChartEmpty />;
  return <CarbonByMonth data={charts.months} />;
}

async function WasteChart(props: ChartProps) {
  const charts = await loadCharts(props);
  if (!charts) return <ChartError />;
  if (charts.waste.every((w) => w.kg === 0)) return <ChartEmpty />;
  return <WasteByCategory data={charts.waste} />;
}

function ChartSkeleton() {
  return <div aria-hidden="true" className="h-64 motion-safe:animate-pulse rounded-card bg-paper-2" />;
}

function ChartEmpty() {
  return <EmptyState className="grid h-64 place-items-center">ยังไม่มีข้อมูล</EmptyState>;
}

// chart height, like ChartSkeleton and ChartEmpty, so the card does not jump (Task 18 review M7)
function ChartError() {
  return (
    <div className="grid h-64 place-items-center">
      <p role="alert" className="rounded-input border border-warn p-3 text-sm text-warn">
        ยังโหลดสถิติรวมไม่ได้ในขณะนี้
      </p>
    </div>
  );
}
