import Link from "next/link";
import { Suspense } from "react";
import { NotificationBell } from "@/components/NotificationBell";
import { getCurrentUser, requireStaff } from "@/lib/auth/dal";
import { isAdminRole } from "@/lib/auth/routes";
import { ThemeToggle } from "@/components/ui";
import { PageSkeleton } from "../_components/page-skeleton";
import { SignOutButton } from "../_components/sign-out-button";
import { StaffDrawer, StaffNavLinks, StaffSidebar, type StaffNavItem } from "./_components/staff-nav";

// Every /staff/** page renders inside StaffGate: non-staff are redirected to /dashboard
// before any child renders. Admin-only pages (/staff/users, /staff/rates) must also call
// requireAdmin() themselves. Layouts do not re-run on every client navigation, so staff
// pages and their data functions must still check the role (DAL) and rely on RLS.
// Spec 9.3 chrome: sidebar (md+) / drawer (phones), bell in the header.
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="relative flex items-center justify-between gap-3 border-b border-rule bg-surface px-4 py-1 md:px-6 xl:px-10">
        <div className="flex min-w-0 items-center gap-2">
          <StaffDrawer>
            <Suspense fallback={<NavSkeleton />}>
              <StaffNav />
            </Suspense>
            <ThemeToggle className="px-3 pt-3" />
          </StaffDrawer>
          <Link href="/staff" className="truncate py-2 font-display text-lg font-semibold text-accent">
            Green Campus · ครูและผู้ดูแล
          </Link>
        </div>
        <NotificationBell href="/staff/notifications" />
      </header>
      <div className="flex flex-1">
        <StaffSidebar>
          <Suspense fallback={<NavSkeleton />}>
            <StaffNav />
          </Suspense>
          <ThemeToggle className="mt-auto pt-3 [&_[role=radio]]:flex-1 [&_[role=radio]]:px-1 [&_[role=radio]]:text-xs [&_[role=radiogroup]]:flex [&_[role=radiogroup]]:w-full" />
        </StaffSidebar>
        <div className="flex min-w-0 flex-1 flex-col">
          <Suspense fallback={<PageSkeleton />}>
            <StaffGate>{children}</StaffGate>
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function StaffGate({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return <>{children}</>;
}

const MAIN_ITEMS: StaffNavItem[] = [
  { href: "/staff", label: "หน้าหลัก" },
  { href: "/staff/reviews", label: "ตรวจผล" },
  { href: "/staff/activities", label: "กิจกรรม" },
  { href: "/staff/weigh-station", label: "จุดชั่ง" },
  { href: "/staff/orders", label: "ออเดอร์" },
  { href: "/staff/rewards", label: "ของรางวัล" },
  { href: "/staff/articles", label: "บทความ" },
  { href: "/staff/reports", label: "รายงาน" },
];

const ADMIN_ITEMS: StaffNavItem[] = [
  { href: "/staff/users", label: "ผู้ใช้" },
  { href: "/staff/rates", label: "อัตรา" },
];

const ACCOUNT_ITEMS: StaffNavItem[] = [
  { href: "/staff/profile", label: "โปรไฟล์" },
  { href: "/staff/notifications", label: "แจ้งเตือน" },
];

/** Menu items by role, decided here on the server (admin items are not sent to teachers). */
async function StaffNav() {
  const user = await getCurrentUser();
  // StaffGate redirects non-staff; render nothing for them meanwhile.
  if (!user || (user.role !== "teacher" && user.role !== "admin")) return null;
  const admin = isAdminRole(user.role);
  return (
    <nav aria-label="เมนูผู้ดูแล" className="space-y-3 text-sm">
      <StaffNavLinks items={MAIN_ITEMS} />
      {admin ? (
        <div className="border-t border-rule pt-3">
          <p className="px-3 pb-1 text-xs text-muted">ผู้ดูแลระบบ</p>
          <StaffNavLinks items={ADMIN_ITEMS} />
        </div>
      ) : null}
      <div className="border-t border-rule pt-3">
        <StaffNavLinks items={ACCOUNT_ITEMS} />
        <div className="px-3 pt-2">
          <SignOutButton />
        </div>
      </div>
    </nav>
  );
}

function NavSkeleton() {
  return <div aria-hidden="true" className="h-64 rounded-card bg-paper-2 motion-safe:animate-pulse" />;
}
