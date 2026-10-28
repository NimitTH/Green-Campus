import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/app/_components/activity-ui";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { ButtonLink, Card, EmptyState, PageHeader, Mono } from "@/components/ui";
import { getUser, listRecentLedger } from "@/lib/admin/queries";
import { LEDGER_KIND_LABEL_TH, ROLE_LABEL_TH, signed } from "@/lib/admin/validation";
import { requireAdmin } from "@/lib/auth/dal";
import { formatBangkok } from "@/lib/datetime";
import { formatCount, formatKg } from "@/lib/leaderboard/format";
import { isUuid } from "@/lib/uuid";
import { AdjustForm } from "../_components/adjust-form";
import { RoleForm } from "../_components/role-form";

export const metadata: Metadata = { title: "ผู้ใช้ | Green Campus" };

// cacheComponents: params and the session are request-time data, read them inside <Suspense>.
export default function StaffUserPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
      <div className="mb-6">
        <PageHeader
          title="รายละเอียดผู้ใช้"
          actions={
            <ButtonLink href="/staff/users" variant="quiet">
              กลับไปรายชื่อ
            </ButtonLink>
          }
        />
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <UserDetail params={params} />
      </Suspense>
    </main>
  );
}

async function UserDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const uid = `user-${id}`; // per-user: two user pages can be alive at once (useId repeats across server renders)
  await requireAdmin(`/staff/users/${encodeURIComponent(id)}`);
  if (!isUuid(id)) notFound();
  const user = await getUser(id);
  if (!user) notFound();
  const ledger = user.role === "student" ? await listRecentLedger(user.id) : [];

  return (
    <div className="space-y-6">
      <Card as="section">
        <h2 className="font-display text-lg font-semibold break-words">{user.fullName}</h2>
        {user.displayName ? <p className="text-sm break-words text-muted">ชื่อที่แสดง: {user.displayName}</p> : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge tone={user.role === "student" ? "gray" : "green"}>{ROLE_LABEL_TH[user.role]}</Badge>
          {user.isDemo ? <Badge tone="amber">บัญชีสาธิต</Badge> : null}
        </div>
        {user.points !== null ? (
          <dl className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-input bg-paper-2 p-3">
              <dt className="text-sm text-muted">แต้มคงเหลือ</dt>
              <dd data-testid="detail-points" className="font-mono text-2xl font-semibold">
                {formatCount(user.points)}
              </dd>
            </div>
            <div className="rounded-input bg-paper-2 p-3">
              <dt className="text-sm text-muted">carbon สะสม (กก. CO2e)</dt>
              <dd data-testid="detail-carbon" className="font-mono text-2xl font-semibold">
                {formatKg(user.carbonKg ?? 0)}
              </dd>
            </div>
          </dl>
        ) : null}
      </Card>

      <section aria-labelledby={`${uid}-role-heading`}>
        <h2 id={`${uid}-role-heading`} className="mb-2 font-display text-lg font-semibold">
          บทบาท
        </h2>
        <RoleForm userId={user.id} name={user.fullName} role={user.role} />
      </section>

      {user.role === "student" ? (
        <>
          <Card as="section" aria-labelledby={`${uid}-adjust-heading`}>
            <h2 id={`${uid}-adjust-heading`} className="mb-1 font-display text-lg font-semibold">
              ปรับแต้ม
            </h2>
            <p className="mb-3 text-sm text-muted">
              ใช้แก้ยอดที่ผิดพลาดหรือให้แต้มพิเศษ หักได้ไม่เกินแต้มคงเหลือและ carbon สะสม ทุกครั้งต้องระบุเหตุผล
            </p>
            <AdjustForm studentId={user.id} />
          </Card>

          <section aria-labelledby={`${uid}-ledger-heading`}>
            <h2 id={`${uid}-ledger-heading`} className="mb-2 font-display text-lg font-semibold">
              รายการล่าสุด
            </h2>
            {ledger.length === 0 ? (
              <EmptyState className="text-sm">ยังไม่มีรายการแต้ม</EmptyState>
            ) : (
              <ul className="divide-y divide-rule rounded-card border border-rule bg-surface shadow-sheet">
                {ledger.map((r) => (
                  <li key={r.id} data-testid="ledger-row" className="p-3 text-sm">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="font-medium">{LEDGER_KIND_LABEL_TH[r.kind] ?? r.kind}</span>
                      <span>
                        <span className={r.points < 0 ? "text-danger" : "text-accent"}>
                          <span className="font-mono">{signed(r.points)}</span> แต้ม
                        </span>
                        {r.carbonKg !== 0 ? (
                          <span className="text-muted">
                            {" "}
                            · carbon <span className="font-mono">{signed(r.carbonKg, formatKg)}</span> กก.
                          </span>
                        ) : null}
                      </span>
                    </div>
                    {r.note ? <p className="mt-0.5 break-words text-ink">{r.note}</p> : null}
                    <p className="mt-0.5 text-xs text-muted">
                      <Mono text={formatBangkok(r.createdAt)} />
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
