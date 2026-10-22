import Link from "next/link";
import { NotificationBell } from "@/components/NotificationBell";
import { BottomNav, StudentTopNav } from "./_components/student-nav";

// Student area shell (spec 9.2), also used by /dashboard. No session read here: each page checks the user
// inside <Suspense>. Staff who open /profile or /notifications are sent to /staff/profile and
// /staff/notifications by those pages, so this shell is the student chrome only.
// The desktop bell and the mobile bottom-nav item read one shared unread store (a single Realtime channel).
// Bottom padding = bottom nav height + safe area, so the end of every page stays above the nav.
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom)+1rem)] md:pb-0">
      <header className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-2 dark:border-gray-800">
        <Link href="/dashboard" className="shrink-0 py-2 font-semibold text-green-700">
          Green Campus
        </Link>
        <StudentTopNav />
        {/* Phones get the bell as the bottom-nav "แจ้งเตือน" item. */}
        <div className="hidden md:block">
          <NotificationBell />
        </div>
      </header>
      {children}
      <BottomNav />
    </div>
  );
}
