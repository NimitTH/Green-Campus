import { Card } from "@/components/ui";
import { ROLE_LABEL_TH } from "@/lib/admin/validation";
import type { CurrentUser } from "@/lib/auth/dal";
import { createServerClient } from "@/lib/supabase/server";
import { AvatarSection } from "./avatar-section";
import { EmailForm } from "./email-form";
import { NotificationList, type NotificationRow } from "./notification-list";
import { PasswordForm } from "./password-form";
import { ProfileForm } from "./profile-form";

// Shared bodies of /profile + /staff/profile and /notifications + /staff/notifications. Each route sits in
// its own shell (student bottom nav or staff sidebar); the page decides the user and the chrome.

/** The result of an email-change link (?email=changed | link-error). Anything else shows nothing. */
function EmailNotice({ value }: { value?: string }) {
  if (value === "changed") {
    return (
      <p role="status" className="mb-6 rounded-input border border-rule-strong bg-accent-soft p-3 text-sm">
        เปลี่ยนอีเมลแล้ว
      </p>
    );
  }
  if (value === "link-error") {
    return (
      <p role="alert" className="mb-6 rounded-input border border-danger bg-surface p-3 text-sm text-danger">
        ลิงก์ยืนยันใช้ไม่ได้หรือหมดอายุ ลองขอใหม่อีกครั้ง
      </p>
    );
  }
  return null;
}

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
      <p role="alert" className="rounded-card border border-danger bg-surface p-4 text-danger">
        โหลดการแจ้งเตือนไม่สำเร็จ รีเฟรชหน้าแล้วลองอีกครั้ง
      </p>
    );
  }
  return <NotificationList items={(data ?? []) as NotificationRow[]} />;
}
