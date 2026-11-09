import Link from "next/link";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { NotificationBell } from "@/components/NotificationBell";
import { getCurrentUser, requireStaff } from "@/lib/auth/dal";
import { isAdminRole } from "@/lib/auth/routes";
import { signOut } from "@/lib/auth/actions";
import { Button, ThemeToggle } from "@/components/ui";
import { PageSkeleton } from "../_components/page-skeleton";
import { SIDEBAR_COLLAPSED, SIDEBAR_COOKIE } from "./_components/sidebar-cookie";
import { StaffDrawer, StaffNavLinks, StaffSidebar, type StaffNavItem } from "./_components/staff-nav";
import { StaffNavIcon } from "./_components/staff-nav-icons";

// Every /staff/** page renders inside StaffGate: non-staff are redirected to /dashboard
// before any child renders. Admin-only pages (/staff/users, /staff/rates) must also call
// requireAdmin() themselves. Layouts do not re-run on every client navigation, so staff
// pages and their data functions must still check the role (DAL) and rely on RLS.
// Spec 9.3 chrome: sidebar (md+) / drawer (phones), bell in the header.
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const nav = (
    <Suspense fallback={<NavSkeleton />}>
      <StaffNav />
    </Suspense>
  );
  return (
    <div className="flex flex-1 flex-col">
      <header className="relative flex items-center justify-between gap-3 border-b border-rule bg-surface px-4 py-1 md:px-6 xl:px-10">
        <div className="flex min-w-0 items-center gap-2">
          <StaffDrawer>
            {nav}
            <ThemeToggle className="mx-3 mt-3" />
          </StaffDrawer>
          <Link href="/staff" className="truncate py-2 font-display text-lg font-semibold text-accent">
            Green Campus · ครูและผู้ดูแล
          </Link>
        </div>
        <NotificationBell href="/staff/notifications" />
      </header>
      <div className="flex flex-1">
        {/* DESIGN-4 4.2: the cookie is request data, so it is read inside <Suspense>; the static shell keeps the expanded sidebar */}
        <Suspense fallback={<StaffSidebar>{nav}</StaffSidebar>}>
          <SidebarFromCookie>{nav}</SidebarFromCookie>
        </Suspense>
        <div className="flex min-w-0 flex-1 flex-col">
          <Suspense fallback={<PageSkeleton />}>
            <StaffGate>{children}</StaffGate>
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function SidebarFromCookie({ children }: { children: React.ReactNode }) {
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === SIDEBAR_COLLAPSED;
  return <StaffSidebar collapsed={collapsed}>{children}</StaffSidebar>;
}

async function StaffGate({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return <>{children}</>;
}

// "บัญชีนักเรียน" (/staff/students) joins MAIN_ITEMS in Task 17 together with its page (controller ruling R1).
const MAIN_ITEMS: StaffNavItem[] = [
  { href: "/staff", label: "หน้าหลัก", icon: "home" },
  { href: "/staff/reviews", label: "ตรวจผล", icon: "reviews" },
  { href: "/staff/activities", label: "กิจกรรม", icon: "activities" },
  { href: "/staff/weigh-station", label: "จุดชั่ง", icon: "station" },
  { href: "/staff/orders", label: "ออเดอร์", icon: "orders" },
  { href: "/staff/rewards", label: "ของรางวัล", icon: "rewards" },
  { href: "/staff/articles", label: "บทความ", icon: "articles" },
  { href: "/staff/reports", label: "รายงาน", icon: "reports" },
];

const ADMIN_ITEMS: StaffNavItem[] = [
  { href: "/staff/users", label: "ผู้ใช้", icon: "users" },
  { href: "/staff/rates", label: "อัตรา", icon: "rates" },
];

const ACCOUNT_ITEMS: StaffNavItem[] = [
  { href: "/staff/profile", label: "โปรไฟล์", icon: "profile" },
  { href: "/staff/notifications", label: "แจ้งเตือน", icon: "notifications" },
];

// Classes prefixed group-data-[collapsed=true]/sidebar apply inside a collapsed sidebar only (never in the drawer).

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
          {/* collapsed: the rule above stands in for the heading */}
          <p className="px-3 pb-1 text-xs text-muted group-data-[collapsed=true]/sidebar:sr-only">ผู้ดูแลระบบ</p>
          <StaffNavLinks items={ADMIN_ITEMS} />
        </div>
      ) : null}
      <div className="border-t border-rule pt-3">
        <StaffNavLinks items={ACCOUNT_ITEMS} />
        <form action={signOut} className="px-3 pt-2 group-data-[collapsed=true]/sidebar:flex group-data-[collapsed=true]/sidebar:justify-center group-data-[collapsed=true]/sidebar:px-0">
          <Button type="submit" variant="card" size="sm" className="group-data-[collapsed=true]/sidebar:w-11 group-data-[collapsed=true]/sidebar:px-0">
            <StaffNavIcon name="signout" className="hidden group-data-[collapsed=true]/sidebar:block" />
            <span className="group-data-[collapsed=true]/sidebar:sr-only">ออกจากระบบ</span>
          </Button>
        </form>
      </div>
    </nav>
  );
}

function NavSkeleton() {
  return <div aria-hidden="true" className="h-64 rounded-card bg-paper-2 motion-safe:animate-pulse" />;
}
