import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { ButtonLink, PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth/dal";
import { createServerClient } from "@/lib/supabase/server";
import { WeighStation } from "./_components/weigh-station";

export const metadata: Metadata = { title: "จุดชั่ง | Green Campus" };

export default function WeighStationPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
      <div className="mb-6">
        <PageHeader
          title="จุดชั่ง · ออกรหัส"
          actions={
            <ButtonLink href="/staff" variant="quiet">
              กลับ
            </ButtonLink>
          }
        />
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <Station />
      </Suspense>
    </main>
  );
}

/** Activities that need a code and whose submit window is open (not draft, starts_at <= now <= ends_at + 3 days). */
async function Station() {
  await requireStaff("/staff/weigh-station");
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("activities")
    .select("id, title")
    .eq("requires_code", true)
    .neq("status", "draft")
    .lte("starts_at", nowIso())
    .gte("ends_at", graceStartIso())
    .order("starts_at", { ascending: false });
  if (error) throw new Error(`weigh-station activities: ${error.message}`);
  const activities = (data ?? []) as { id: string; title: string }[];

  if (activities.length === 0) {
    return (
      <section className="rounded-card border border-dashed border-rule-strong p-6 text-center text-muted">
        ยังไม่มีกิจกรรมที่ใช้รหัสจุดชั่งและอยู่ในช่วงส่งผล
      </section>
    );
  }
  return <WeighStation activities={activities} />;
}

// Outside the component: react-hooks/purity forbids reading the clock while rendering.
function nowIso(): string {
  return new Date().toISOString();
}

/** ends_at must be no older than this (ends_at + 3 days >= now, ruling R18). */
function graceStartIso(): string {
  return new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
}
