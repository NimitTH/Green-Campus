import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { isNarrowed, parseListParams } from "@/app/_components/list/list-params";
import { ListToolbar, ListToolbarSkeleton } from "@/app/_components/list/list-toolbar";
import { Pagination } from "@/app/_components/list/pagination";
import { loadClamped } from "@/app/_components/list/paging";
import { ListSkeleton } from "@/app/_components/skeletons";
import { Avatar, ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { STUDENT_ACCOUNT_CONFIG } from "@/lib/accounts/list-config";
import { listStudentAccounts, type StudentAccount } from "@/lib/accounts/queries";
import { requireStaff } from "@/lib/auth/dal";
import { formatCount } from "@/lib/leaderboard/format";
import { StatusBadges } from "./_components/status-badges";

export const metadata: Metadata = { title: "บัญชีนักเรียน | Green Campus" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// DESIGN-4 6.1. cacheComponents: searchParams and the session are request-time data, read them inside <Suspense>.
export default function StaffStudentsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <div className="mb-6">
        <PageHeader
          title="บัญชีนักเรียน"
          actions={
            <ButtonLink href="/staff" variant="quiet">
              กลับ
            </ButtonLink>
          }
        />
      </div>
      <Suspense fallback={<ListSkeleton view="list" />}>
        <StudentList searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function StudentList({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff("/staff/students");
  const sp = await searchParams;
  const { params, result } = await loadClamped(STUDENT_ACCOUNT_CONFIG, parseListParams(STUDENT_ACCOUNT_CONFIG, sp), listStudentAccounts);
  const now = new Date();

  return (
    <>
      {sp.deleted === "1" ? (
        <p role="status" className="mb-4 rounded-input border border-accent bg-accent-soft p-3 text-sm text-ink">
          ลบบัญชีแล้ว
        </p>
      ) : null}
      <Suspense fallback={<ListToolbarSkeleton views={false} filters={1} />}>
        <ListToolbar base="/staff/students" config={STUDENT_ACCOUNT_CONFIG} placeholder="ค้นหานักเรียน" />
      </Suspense>
      {result.items.length === 0 ? (
        isNarrowed(STUDENT_ACCOUNT_CONFIG, params) ? (
          <EmptyState>
            <p>ไม่พบรายการที่ตรงกับคำค้น</p>
            <Link href="/staff/students" className="mt-2 inline-flex min-h-11 items-center font-medium text-accent underline underline-offset-4">
              ล้างการค้นหา
            </Link>
          </EmptyState>
        ) : (
          <EmptyState>ยังไม่มีนักเรียน</EmptyState>
        )
      ) : (
        <>
          <ul className="divide-y divide-rule overflow-hidden rounded-card border border-rule bg-surface shadow-sheet">
            {result.items.map((s) => (
              <StudentRow key={s.id} student={s} now={now} />
            ))}
          </ul>
          <Pagination base="/staff/students" config={STUDENT_ACCOUNT_CONFIG} state={params} total={result.total} />
        </>
      )}
    </>
  );
}

function StudentRow({ student, now }: { student: StudentAccount; now: Date }) {
  return (
    <li data-testid="student-row" data-student-id={student.id}>
      <Link
        href={`/staff/students/${student.id}`}
        className="flex min-h-11 items-center gap-3 p-3 hover:bg-accent-soft focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      >
        <Avatar name={student.fullName} url={student.avatarUrl} size={36} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold break-words text-ink">{student.fullName}</p>
          {student.email ? <p className="text-sm break-all text-muted">{student.email}</p> : null}
          <div className="mt-1">
            <StatusBadges suspendedUntil={student.suspendedUntil} mustChangePassword={student.mustChangePassword} isDemo={student.isDemo} now={now} />
          </div>
        </div>
        <p className="shrink-0 text-sm text-muted">
          <span data-testid="student-points" className="font-mono text-ink">
            {formatCount(student.points)}
          </span>{" "}
          แต้ม
        </p>
      </Link>
    </li>
  );
}
