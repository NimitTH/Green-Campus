import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/app/_components/activity-ui";
import { PageSkeleton } from "@/app/_components/page-skeleton";
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
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">รายละเอียดผู้ใช้</h1>
        <Link href="/staff/users" className="text-sm text-green-700 underline">
          กลับไปรายชื่อ
        </Link>
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <UserDetail params={params} />
      </Suspense>
    </main>
  );
}

async function UserDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin(`/staff/users/${encodeURIComponent(id)}`);
  if (!isUuid(id)) notFound();
  const user = await getUser(id);
  if (!user) notFound();
  const ledger = user.role === "student" ? await listRecentLedger(user.id) : [];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
        <h2 className="text-lg font-semibold break-words">{user.fullName}</h2>
        {user.displayName ? <p className="text-sm break-words text-gray-600 dark:text-gray-400">ชื่อที่แสดง: {user.displayName}</p> : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge tone={user.role === "student" ? "gray" : "green"}>{ROLE_LABEL_TH[user.role]}</Badge>
          {user.isDemo ? <Badge tone="amber">บัญชีสาธิต</Badge> : null}
        </div>
        {user.points !== null ? (
          <dl className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900">
              <dt className="text-xs text-gray-600 dark:text-gray-400">แต้มคงเหลือ</dt>
              <dd data-testid="detail-points" className="text-xl font-semibold">
                {formatCount(user.points)}
              </dd>
            </div>
            <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900">
              <dt className="text-xs text-gray-600 dark:text-gray-400">carbon สะสม (กก. CO2e)</dt>
              <dd data-testid="detail-carbon" className="text-xl font-semibold">
                {formatKg(user.carbonKg ?? 0)}
              </dd>
            </div>
          </dl>
        ) : null}
      </section>

      <section aria-labelledby="role-heading">
        <h2 id="role-heading" className="mb-2 font-semibold">
          บทบาท
        </h2>
        <RoleForm userId={user.id} name={user.fullName} role={user.role} />
      </section>

      {user.role === "student" ? (
        <>
          <section aria-labelledby="adjust-heading" className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
            <h2 id="adjust-heading" className="mb-1 font-semibold">
              ปรับแต้ม
            </h2>
            <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
              ใช้แก้ยอดที่ผิดพลาดหรือให้แต้มพิเศษ หักได้ไม่เกินแต้มคงเหลือและ carbon สะสม ทุกครั้งต้องระบุเหตุผล
            </p>
            <AdjustForm studentId={user.id} />
          </section>

          <section aria-labelledby="ledger-heading">
            <h2 id="ledger-heading" className="mb-2 font-semibold">
              รายการล่าสุด
            </h2>
            {ledger.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-gray-300 p-4 text-center text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400">
                ยังไม่มีรายการแต้ม
              </p>
            ) : (
              <ul className="divide-y divide-gray-200 rounded-2xl border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
                {ledger.map((r) => (
                  <li key={r.id} data-testid="ledger-row" className="p-3 text-sm">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="font-medium">{LEDGER_KIND_LABEL_TH[r.kind] ?? r.kind}</span>
                      <span>
                        <span className={r.points < 0 ? "text-red-700" : "text-green-800 dark:text-green-300"}>{signed(r.points)} แต้ม</span>
                        {r.carbonKg !== 0 ? <span className="text-gray-600 dark:text-gray-400"> · carbon {signed(r.carbonKg, formatKg)} กก.</span> : null}
                      </span>
                    </div>
                    {r.note ? <p className="mt-0.5 break-words text-gray-700 dark:text-gray-300">{r.note}</p> : null}
                    <p className="mt-0.5 text-xs text-gray-500">{formatBangkok(r.createdAt)}</p>
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
