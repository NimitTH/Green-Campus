import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/app/_components/activity-ui";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { listUsers, type AdminUser } from "@/lib/admin/queries";
import { cleanSearchTerm, ROLE_LABEL_TH, toPage, toRoleFilter, USERS_PAGE_SIZE, type RoleFilter } from "@/lib/admin/validation";
import { requireAdmin } from "@/lib/auth/dal";
import { formatCount, formatKg } from "@/lib/leaderboard/format";
import { RoleForm } from "./_components/role-form";

export const metadata: Metadata = { title: "จัดการผู้ใช้ | Green Campus" };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

// cacheComponents: searchParams and the session are request-time data, read them inside <Suspense>.
export default function StaffUsersPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">จัดการผู้ใช้</h1>
        <Link href="/staff" className="text-sm text-green-700 underline">
          กลับ
        </Link>
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <Users searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const FILTERS: { value: RoleFilter; label: string }[] = [
  { value: "all", label: "ทุกบทบาท" },
  { value: "student", label: ROLE_LABEL_TH.student },
  { value: "teacher", label: ROLE_LABEL_TH.teacher },
  { value: "admin", label: ROLE_LABEL_TH.admin },
];

function pageHref(q: string, role: RoleFilter, page: number): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (role !== "all") params.set("role", role);
  if (page > 1) params.set("page", String(page));
  const s = params.toString();
  return s ? `/staff/users?${s}` : "/staff/users";
}

async function Users({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin("/staff/users");
  const sp = await searchParams;
  const query = cleanSearchTerm(sp.q);
  const role = toRoleFilter(sp.role);
  const page = toPage(sp.page);
  const { users, total } = await listUsers(query, role, page);
  const pages = Math.max(1, Math.ceil(total / USERS_PAGE_SIZE));
  // R126.5: a page past the end (stale link, hand-typed ?page=) goes to the last page that has rows,
  // so the empty state never claims there are no users.
  if (page > pages) redirect(pageHref(query, role, pages));

  return (
    <>
      <form role="search" method="get" className="mb-4 flex flex-wrap gap-2">
        <label htmlFor="q" className="sr-only">
          ค้นหาชื่อ
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={query}
          placeholder="ชื่อ หรือชื่อที่แสดง"
          className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-base outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/30 dark:border-gray-700 dark:bg-gray-900"
        />
        <label htmlFor="role-filter" className="sr-only">
          บทบาท
        </label>
        <select
          id="role-filter"
          name="role"
          defaultValue={role}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-base dark:border-gray-700 dark:bg-gray-900"
        >
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <button type="submit" className="shrink-0 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800">
          ค้นหา
        </button>
      </form>

      {users.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-gray-600 dark:border-gray-700 dark:text-gray-400">
          {query || role !== "all" ? "ไม่พบผู้ใช้ที่ตรงกับคำค้น" : "ยังไม่มีผู้ใช้"}
        </section>
      ) : (
        <ul className="space-y-3">
          {users.map((u) => (
            <UserRow key={u.id} user={u} />
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <nav aria-label="หน้า" className="mt-4 flex items-center justify-between gap-3 text-sm">
          {page > 1 ? (
            <Link href={pageHref(query, role, page - 1)} className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700">
              ก่อนหน้า
            </Link>
          ) : (
            <span />
          )}
          <span>
            หน้า {formatCount(page)} / {formatCount(pages)} ({formatCount(total)} คน)
          </span>
          {page < pages ? (
            <Link href={pageHref(query, role, page + 1)} className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700">
              ถัดไป
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}

function UserRow({ user }: { user: AdminUser }) {
  return (
    <li data-testid="admin-user" data-user-id={user.id} className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/staff/users/${user.id}`} className="font-semibold break-words hover:underline">
            {user.fullName}
          </Link>
          {user.displayName && user.displayName !== user.fullName ? (
            <p className="text-sm break-words text-gray-600 dark:text-gray-400">ชื่อที่แสดง: {user.displayName}</p>
          ) : null}
          <div className="mt-1 flex flex-wrap gap-2">
            <span data-testid="user-role">
              <Badge tone={user.role === "student" ? "gray" : "green"}>{ROLE_LABEL_TH[user.role]}</Badge>
            </span>
            {user.isDemo ? <Badge tone="amber">บัญชีสาธิต</Badge> : null}
          </div>
          {user.points !== null ? (
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
              แต้มคงเหลือ <span data-testid="user-points">{formatCount(user.points)}</span> · carbon สะสม {formatKg(user.carbonKg ?? 0)} กก.
            </p>
          ) : null}
        </div>
        <Link
          href={`/staff/users/${user.id}`}
          aria-label={`จัดการ ${user.fullName}`}
          className="shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-900"
        >
          {user.role === "student" ? "ปรับแต้ม / ประวัติ" : "รายละเอียด"}
        </Link>
      </div>
      <div className="mt-3">
        <RoleForm userId={user.id} name={user.fullName} role={user.role} />
      </div>
    </li>
  );
}
