import Link from "next/link";
import { Suspense } from "react";
import { Card, EmptyState } from "@/components/ui";
import { ROLE_LABEL_TH } from "@/lib/admin/validation";
import type { CurrentUser } from "@/lib/auth/dal";
import { STAFF_NOTIFICATION_CONFIG, STUDENT_NOTIFICATION_CONFIG } from "@/lib/notifications/list-config";
import { countUnreadNotifications, listNotificationsPage } from "@/lib/notifications/queries";
import { AvatarSection } from "./avatar-section";
import { EmailForm } from "./email-form";
import { EmailNotice } from "./email-notice";
import { ListToolbar, ListToolbarSkeleton } from "./list/list-toolbar";
import { isNarrowed, parseListParams, type ListConfig, type ListState } from "./list/list-params";
import { Pagination } from "./list/pagination";
import { loadClamped } from "./list/paging";
import { NotificationList } from "./notification-list";
import { ListSkeleton } from "@/app/_components/skeletons";
import { PasswordForm } from "./password-form";
import { ProfileForm } from "./profile-form";

// Shared bodies of /profile + /staff/profile and /notifications + /staff/notifications. Each route sits in
// its own shell (student bottom nav or staff sidebar); the page decides the user and the chrome.

export function ProfileDetails({ user, emailNotice }: { user: CurrentUser; emailNotice?: string }) {
  return (
    <>
      <EmailNotice value={emailNotice} />
      <AvatarSection userId={user.id} name={user.displayName ?? user.fullName} url={user.avatarUrl} />
      <Card as="section" className="mb-6">
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">บทบาท</dt>
          <dd data-testid="profile-role" className="font-medium">
            {ROLE_LABEL_TH[user.role]}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted">อีเมล</dt>
          <dd data-testid="profile-email" className="font-medium break-all">
            {user.email ?? "-"}
          </dd>
        </div>
      </dl>
      </Card>
      <ProfileForm initial={{ fullName: user.fullName, displayName: user.displayName ?? "" }} />
      <EmailForm currentEmail={user.email ?? "-"} />
      <PasswordForm />
    </>
  );
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function load(config: ListConfig, p: ListState) {
  try {
    return await listNotificationsPage(p, config);
  } catch (e) {
    console.error("load notifications failed", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Unread rows over the whole list (not just the page shown); null when the count fails. */
async function loadUnread() {
  try {
    return await countUnreadNotifications();
  } catch (e) {
    console.error("count unread notifications failed", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * The caller's notifications with search, sort, the type filter and pagination (DESIGN-4 3). Call after the session
 * check, inside <Suspense>. The toolbar reads the URL itself (useSearchParams) in its own boundary.
 */
export function NotificationsSection({ base, role, searchParams }: { base: string; role: "student" | "staff"; searchParams: SearchParams }) {
  const config = role === "student" ? STUDENT_NOTIFICATION_CONFIG : STAFF_NOTIFICATION_CONFIG;
  return (
    <>
      {/* DESIGN-4 3.1: a small note under the heading, for students only, whatever the list shows */}
      {role === "student" ? <p className="-mt-2 mb-4 text-sm text-muted">ระบบเก็บการแจ้งเตือนล่าสุด 100 รายการ</p> : null}
      <Suspense fallback={<ListToolbarSkeleton views={false} filters={1} />}>
        <ListToolbar base={base} config={config} placeholder="ค้นหาการแจ้งเตือน" />
      </Suspense>
      <Suspense fallback={<ListSkeleton view="list" toolbar={false} />}>
        <NotificationResults base={base} config={config} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function NotificationResults({ base, config, searchParams }: { base: string; config: ListConfig; searchParams: SearchParams }) {
  const [{ params, result }, unread] = await Promise.all([
    // past the end (e.g. ?page=999 or the list shrank after a delete): the last page instead
    loadClamped(config, parseListParams(config, await searchParams), (p) => load(config, p)),
    loadUnread(),
  ]);
  if (!result) {
    return (
      <p role="alert" className="rounded-card border border-danger bg-surface p-4 text-danger">
        โหลดการแจ้งเตือนไม่สำเร็จ รีเฟรชหน้าแล้วลองอีกครั้ง
      </p>
    );
  }
  if (result.total === 0 || result.items.length === 0) {
    if (isNarrowed(config, params)) {
      return (
        <EmptyState>
          <p>ไม่พบรายการที่ตรงกับคำค้น</p>
          <Link href={base} className="mt-2 inline-flex min-h-11 items-center font-medium text-accent underline underline-offset-4">
            ล้างการค้นหา
          </Link>
        </EmptyState>
      );
    }
    return <EmptyState>ยังไม่มีการแจ้งเตือน</EmptyState>;
  }
  return (
    <>
      {/* a failed count keeps the button usable: the action itself reports errors */}
      <NotificationList items={result.items} hasUnread={unread === null || unread > 0} />
      <Pagination base={base} config={config} state={params} total={result.total} />
    </>
  );
}
