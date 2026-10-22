import { ROLE_LABEL_TH } from "@/lib/admin/validation";
import type { CurrentUser } from "@/lib/auth/dal";
import { createServerClient } from "@/lib/supabase/server";
import { NotificationList, type NotificationRow } from "./notification-list";
import { ProfileForm } from "./profile-form";

// Shared bodies of /profile + /staff/profile and /notifications + /staff/notifications. Each route sits in
// its own shell (student bottom nav or staff sidebar); the page decides the user and the chrome.

export function ProfileDetails({ user }: { user: CurrentUser }) {
  return (
    <>
      <dl className="mb-6 grid gap-3 rounded-2xl border border-gray-200 p-4 text-sm sm:grid-cols-2 dark:border-gray-800">
        <div>
          <dt className="text-gray-600 dark:text-gray-400">บทบาท</dt>
          <dd data-testid="profile-role" className="font-medium">
            {ROLE_LABEL_TH[user.role]}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-gray-600 dark:text-gray-400">อีเมล</dt>
          <dd data-testid="profile-email" className="font-medium break-all">
            {user.email ?? "-"}
          </dd>
        </div>
      </dl>
      <ProfileForm initial={{ fullName: user.fullName, displayName: user.displayName ?? "" }} />
    </>
  );
}

/** The caller's latest 50 notifications (RLS: user_id = auth.uid()). Call after the session check. */
export async function NotificationsSection() {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, body, link, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("load notifications failed", error.code, error.message);
    return (
      <p role="alert" className="rounded-2xl border border-red-300 p-4 text-red-700">
        โหลดการแจ้งเตือนไม่สำเร็จ รีเฟรชหน้าแล้วลองอีกครั้ง
      </p>
    );
  }
  return <NotificationList items={(data ?? []) as NotificationRow[]} />;
}
