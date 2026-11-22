import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/dal";
import { isStaffRole } from "@/lib/auth/routes";
import { SiteFooter } from "../_components/site-footer";
import { SiteHeader } from "../_components/site-header";
import { mainContentProps } from "../_components/main-content";
import { SkipLink } from "../_components/skip-link";
import { BottomNav } from "./_components/student-nav";

// Student area shell (spec 9.2), also used by /dashboard. It shares SiteHeader / SiteFooter with the public
// pages (DESIGN-3 3.1); the session is read only inside the header's <Suspense> and inside each page. Staff
// who open /profile or /notifications are sent to /staff/profile and /staff/notifications by those pages.
// The desktop bell and the mobile bottom-nav item read one shared unread store (a single Realtime channel).
// Bottom padding = bottom nav height + safe area, so the end of every page (the footer) stays above the nav.
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom)+1rem)] md:pb-0">
      <SkipLink />
      <SiteHeader />
      <div {...mainContentProps} className="flex flex-1 flex-col outline-none">
        {children}
      </div>
      <SiteFooter />
      {/* The role is read inside Suspense; the fallback is the student bar without a role-specific item set. */}
      <Suspense fallback={<BottomNav />}>
        <RoleBottomNav />
      </Suspense>
    </div>
  );
}

async function RoleBottomNav() {
  const user = await getCurrentUser();
  return <BottomNav variant={user && isStaffRole(user.role) ? "staff" : "student"} />;
}
