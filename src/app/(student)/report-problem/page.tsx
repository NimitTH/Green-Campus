import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ReportProblemForm } from "@/app/_components/report-problem-form";
import { FormSkeleton } from "@/app/_components/skeletons";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/dal";
import { isStaffRole } from "@/lib/auth/routes";
import { safeReportPath } from "@/lib/problem-reports/format";

export const metadata: Metadata = { title: "แจ้งปัญหาการใช้งาน | Green Campus" };

type Search = Promise<{ [key: string]: string | string[] | undefined }>;

// Round 6 (old-site features 5): a student reports a problem with the website. Staff use /staff/report-problem.
// cacheComponents: the session and searchParams are request-time data, read them inside <Suspense>.
export default function ReportProblemPage({ searchParams }: { searchParams: Search }) {
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
  const user = await requireUser(from ? `/report-problem?from=${encodeURIComponent(from)}` : "/report-problem");
  if (isStaffRole(user.role)) redirect(from ? `/staff/report-problem?from=${encodeURIComponent(from)}` : "/staff/report-problem");
  return <ReportProblemForm from={from} idPrefix="student" />;
}
