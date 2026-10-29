import Link from "next/link";
import { NotificationBell } from "@/components/NotificationBell";
import { ButtonLink, ThemeToggle } from "@/components/ui";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/dal";
import { isStaffRole } from "@/lib/auth/routes";
import { AccountMenu, type AccountMenuLink } from "./account-menu";
import { MainNav } from "./main-nav";

// DESIGN-3 3.2: the session-dependent part of the shared header. SiteHeader renders it inside <Suspense>, so the
// session read (getCurrentUser calls connection()) stays out of the static shell of "/" and "/articles".

type HeaderUser = Pick<CurrentUser, "role" | "fullName" | "displayName" | "email" | "avatarUrl">;

const STUDENT_LINKS: AccountMenuLink[] = [{ href: "/profile", label: "โปรไฟล์" }];
const STAFF_LINKS: AccountMenuLink[] = [
  { href: "/staff", label: "หน้าผู้ดูแล" },
  { href: "/staff/profile", label: "โปรไฟล์" },
];

const TEXT_LINK = "inline-flex min-h-11 items-center px-1 text-sm text-ink underline-offset-4 hover:text-accent hover:underline";

export async function HeaderAccount() {
  const user = await getCurrentUser();
  return <HeaderAccountView user={user} />;
}

/** Pure view of the three header variants: signed out, student, teacher/admin. */
export function HeaderAccountView({ user }: { user: HeaderUser | null }) {
  if (!user) {
    return (
      <div className="ml-auto flex items-center gap-x-1 md:gap-x-3">
        <ThemeToggle />
        <nav aria-label="เมนูสาธารณะ" className="flex items-center gap-x-1 md:gap-x-3">
          <Link href="/login" className={TEXT_LINK}>
            เข้าสู่ระบบ
          </Link>
          <ButtonLink href="/register" variant="primary" size="sm" className="whitespace-nowrap">
            สมัครสมาชิก
          </ButtonLink>
        </nav>
      </div>
    );
  }

  const menu = (
    <AccountMenu
      name={user.displayName ?? user.fullName}
      email={user.email ?? ""}
      avatarUrl={user.avatarUrl}
      links={isStaffRole(user.role) ? STAFF_LINKS : STUDENT_LINKS}
    />
  );

  if (isStaffRole(user.role)) {
    return (
      <div className="ml-auto flex items-center gap-x-1">
        <ThemeToggle />
        {menu}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-x-1">
      <MainNav />
      <div className="ml-auto flex shrink-0 items-center gap-x-1 md:ml-0">
        {/* Phones get the bell as the bottom-nav "แจ้งเตือน" item. */}
        <div className="hidden md:block">
          <NotificationBell />
        </div>
        <ThemeToggle />
        {menu}
      </div>
    </div>
  );
}
