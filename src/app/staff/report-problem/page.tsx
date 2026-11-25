import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportProblemForm } from "@/app/_components/report-problem-form";
import { FormSkeleton } from "@/app/_components/skeletons";
import { PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth/dal";
import { safeReportPath } from "@/lib/problem-reports/format";

export const metadata: Metadata = { title: "แจ้งปัญหาการใช้งาน | Green Campus" };

type Search = Promise<{ [key: string]: string | string[] | undefined }>;

// Round 6 (old-site features 5): the staff version of /report-problem (same form, staff shell).
export default function StaffReportProblemPage({ searchParams }: { searchParams: Search }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <div className="mb-4">
        <PageHeader title="แจ้งปัญหาการใช้งาน" />
      </div>
      <p className="mb-4 text-sm text-muted">เว็บมีปัญหา กดแล้วไม่ทำงาน หรือเห็นอะไรผิดปกติ เล่าให้ผู้ดูแลระบบทราบได้ที่นี่</p>
      <Suspense fallback={<FormSkeleton />}>
        <Report searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Report({ searchParams }: { searchParams: Search }) {
  const raw = (await searchParams).from;
  const from = safeReportPath(typeof raw === "string" ? raw : null);
  await requireStaff(from ? `/staff/report-problem?from=${encodeURIComponent(from)}` : "/staff/report-problem");
  return <ReportProblemForm from={from} idPrefix="staff" />;
}
