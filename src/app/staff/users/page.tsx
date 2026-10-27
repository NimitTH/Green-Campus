import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/app/_components/activity-ui";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { Button, ButtonLink, Card, EmptyState, PageHeader, inputClass } from "@/components/ui";
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
      <div className="mb-6">
        <PageHeader
          title="จัดการผู้ใช้"
          actions={
            <ButtonLink href="/staff" variant="quiet">
              กลับ
            </ButtonLink>
          }
        />
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
  const uid = "users"; // route-prefixed: /staff/orders has its own search box (useId repeats across server renders)
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
        <label htmlFor={`${uid}-q`} className="sr-only">
          ค้นหาชื่อ
        </label>
        <input
          id={`${uid}-q`}
          name="q"
          type="search"
          defaultValue={query}
          placeholder="ชื่อ หรือชื่อที่แสดง"
          className={`${inputClass} min-w-0 flex-1`}
        />
        <label htmlFor={`${uid}-role`} className="sr-only">
          บทบาท
        </label>
        <div className="shrink-0">
          <select id={`${uid}-role`} name="role" defaultValue={role} className={inputClass}>
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="primary" className="shrink-0">
          ค้นหา
        </Button>
      </form>

      {users.length === 0 ? (
        <EmptyState>{query || role !== "all" ? "ไม่พบผู้ใช้ที่ตรงกับคำค้น" : "ยังไม่มีผู้ใช้"}</EmptyState>
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
            <ButtonLink href={pageHref(query, role, page - 1)} variant="card">
              ก่อนหน้า
            </ButtonLink>
          ) : (
            <span />
          )}
          <span className="text-muted">
            หน้า <span className="font-mono">{formatCount(page)}</span> / <span className="font-mono">{formatCount(pages)}</span> (
            <span className="font-mono">{formatCount(total)}</span> คน)
          </span>
          {page < pages ? (
            <ButtonLink href={pageHref(query, role, page + 1)} variant="card">
              ถัดไป
            </ButtonLink>
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
    <Card as="li" data-testid="admin-user" data-user-id={user.id}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/staff/users/${user.id}`} className="font-semibold break-words text-accent hover:underline">
            {user.fullName}
          </Link>
          {user.displayName && user.displayName !== user.fullName ? (
            <p className="text-sm break-words text-muted">ชื่อที่แสดง: {user.displayName}</p>
          ) : null}
          <div className="mt-1 flex flex-wrap gap-2">
            <span data-testid="user-role">
              <Badge tone={user.role === "student" ? "gray" : "green"}>{ROLE_LABEL_TH[user.role]}</Badge>
            </span>
            {user.isDemo ? <Badge tone="amber">บัญชีสาธิต</Badge> : null}
          </div>
          {user.points !== null ? (
            <p className="mt-1 text-sm text-muted">
              แต้มคงเหลือ{" "}
              <span data-testid="user-points" className="font-mono">
                {formatCount(user.points)}
              </span>{" "}
              · carbon สะสม <span className="font-mono">{formatKg(user.carbonKg ?? 0)}</span> กก.
            </p>
          ) : null}
        </div>
        <ButtonLink href={`/staff/users/${user.id}`} aria-label={`จัดการ ${user.fullName}`} variant="card" className="shrink-0">
          {user.role === "student" ? "ปรับแต้ม / ประวัติ" : "รายละเอียด"}
        </ButtonLink>
      </div>
      <div className="mt-3">
        <RoleForm userId={user.id} name={user.fullName} role={user.role} />
      </div>
    </Card>
  );
}
