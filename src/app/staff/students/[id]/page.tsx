import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DetailSkeleton } from "@/app/_components/skeletons";
import { AdjustForm } from "@/app/staff/users/_components/adjust-form";
import { Avatar, ButtonLink, Card, Mono, PageHeader } from "@/components/ui";
import { getStudentAccount, isDemoAccount, listAccountEvents } from "@/lib/accounts/queries";
import { requireStaff } from "@/lib/auth/dal";
import { isAdminRole } from "@/lib/auth/routes";
import { formatBangkok } from "@/lib/datetime";
import { formatCount, formatKg } from "@/lib/leaderboard/format";
import { isUuid } from "@/lib/uuid";
import { AccountEvents } from "../_components/account-events";
import { DeletePanel } from "../_components/delete-panel";
import { RenamePanel } from "../_components/rename-panel";
import { ResetPasswordPanel } from "../_components/reset-password-panel";
import { StatusBadges, suspensionText } from "../_components/status-badges";
import { SuspendPanel } from "../_components/suspend-panel";

export const metadata: Metadata = { title: "บัญชีนักเรียน | Green Campus" };

// DESIGN-4 6.1. cacheComponents: params and the session are request-time data, read them inside <Suspense>.
export default function StaffStudentPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
      <div className="mb-6">
        <PageHeader
          title="บัญชีนักเรียน"
          actions={
            <ButtonLink href="/staff/students" variant="quiet">
              กลับไปรายชื่อ
            </ButtonLink>
          }
        />
      </div>
      <Suspense fallback={<DetailSkeleton />}>
        <StudentDetail params={params} />
      </Suspense>
    </main>
  );
}

function Panel({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card as="section" aria-labelledby={id} data-testid="account-panel">
      <h2 id={id} className="mb-1 font-display text-lg font-semibold">
        {title}
      </h2>
      {description ? <p className="mb-3 text-sm text-muted">{description}</p> : null}
      {children}
    </Card>
  );
}

async function StudentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireStaff(`/staff/students/${encodeURIComponent(id)}`);
  if (!isUuid(id)) notFound();
  const [student, events, viewerIsDemo] = await Promise.all([getStudentAccount(id), listAccountEvents(id, 20), isDemoAccount(viewer.id)]);
  if (!student) notFound();

  const uid = `student-${id}`; // per-student: two student pages can be alive at once (useId repeats across server renders)
  const now = new Date();
  const suspension = suspensionText(student.suspendedUntil, now);
  const admin = isAdminRole(viewer.role);
  // DESIGN-4 6.3: demo staff manage demo students only (the database refuses with demo_scope anyway)
  const canManage = !viewerIsDemo || student.isDemo;

  return (
    <div className="space-y-6">
      <Card as="section" aria-labelledby={`${uid}-name`}>
        <div className="flex flex-wrap items-start gap-4">
          <Avatar name={student.fullName} url={student.avatarUrl} size={72} />
          <div className="min-w-0 flex-1">
            <h2 id={`${uid}-name`} className="font-display text-xl font-semibold break-words">
              {student.fullName}
            </h2>
            {student.displayName ? <p className="text-sm break-words text-muted">ชื่อที่แสดง: {student.displayName}</p> : null}
            {student.email ? <p className="text-sm break-all text-muted">{student.email}</p> : null}
            <p className="text-sm text-muted">
              สมัครเมื่อ <Mono text={formatBangkok(student.createdAt)} />
            </p>
            <div className="mt-2">
              <StatusBadges suspendedUntil={student.suspendedUntil} mustChangePassword={student.mustChangePassword} isDemo={student.isDemo} now={now} />
            </div>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-input bg-paper-2 p-3">
            <dt className="text-sm text-muted">แต้มคงเหลือ</dt>
            <dd data-testid="detail-points" className="font-mono text-2xl font-semibold">
              {formatCount(student.points)}
            </dd>
          </div>
          <div className="rounded-input bg-paper-2 p-3">
            <dt className="text-sm text-muted">carbon สะสม (กก. CO2e)</dt>
            <dd data-testid="detail-carbon" className="font-mono text-2xl font-semibold">
              {formatKg(student.carbonKg)}
            </dd>
          </div>
        </dl>
      </Card>

      <section aria-labelledby={`${uid}-status`}>
        <h2 id={`${uid}-status`} className="mb-2 font-display text-lg font-semibold">
          สถานะ
        </h2>
        <div data-testid="account-status" className="rounded-card border border-rule bg-surface p-4 text-sm shadow-sheet">
          {suspension ? (
            <>
              <p className="font-semibold text-danger">{suspension}</p>
              {student.suspendReason ? <p className="mt-1 break-words">เหตุผล: {student.suspendReason}</p> : null}
              {student.suspendedByName ? <p className="mt-1 break-words text-muted">โดย {student.suspendedByName}</p> : null}
            </>
          ) : (
            <p className="font-semibold text-accent">ปกติ</p>
          )}
          {student.mustChangePassword ? <p className="mt-1 text-warn">ต้องเปลี่ยนรหัสผ่าน</p> : null}
        </div>
      </section>

      {canManage ? (
        <>
          <Panel id={`${uid}-reset`} title="รีเซ็ตรหัสผ่าน" description="ตั้งรหัสผ่านชั่วคราวให้นักเรียนที่ลืมรหัส นักเรียนต้องตั้งรหัสใหม่หลังเข้าสู่ระบบ">
            <ResetPasswordPanel studentId={student.id} name={student.fullName} />
          </Panel>
          <Panel id={`${uid}-suspend`} title="ระงับบัญชี" description="นักเรียนที่ถูกระงับเข้าสู่ระบบไม่ได้และไม่แสดงในหน้าอันดับ">
            <SuspendPanel studentId={student.id} suspended={suspension !== null} />
          </Panel>
          {admin ? (
            <>
              <Panel id={`${uid}-rename`} title="แก้ชื่อ">
                <RenamePanel studentId={student.id} fullName={student.fullName} displayName={student.displayName} />
              </Panel>
              <Panel
                id={`${uid}-adjust`}
                title="ปรับแต้ม"
                description="ใช้แก้ยอดที่ผิดพลาดหรือให้แต้มพิเศษ หักได้ไม่เกินแต้มคงเหลือและ carbon สะสม ทุกครั้งต้องระบุเหตุผล"
              >
                <AdjustForm studentId={student.id} />
              </Panel>
              <Panel id={`${uid}-delete`} title="ลบบัญชี" description="ลบบัญชีและข้อมูลทั้งหมดของนักเรียนถาวร ประวัติการจัดการบัญชียังเก็บไว้">
                <DeletePanel studentId={student.id} fullName={student.fullName} />
              </Panel>
            </>
          ) : null}
        </>
      ) : (
        <p role="note" className="rounded-card border border-warn bg-surface p-4 text-sm text-ink">
          บัญชีสาธิตจัดการได้เฉพาะนักเรียนสาธิต
        </p>
      )}

      <section aria-labelledby={`${uid}-events`}>
        <h2 id={`${uid}-events`} className="mb-2 font-display text-lg font-semibold">
          ประวัติการจัดการบัญชี
        </h2>
        <AccountEvents events={events} />
      </section>
    </div>
  );
}
