import type { Metadata } from "next";
import { Suspense } from "react";
import { NotificationsSection } from "@/app/_components/account-sections";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "แจ้งเตือน | Green Campus" };

// Staff version of /notifications (M7): same list (RLS: own rows only), staff shell.
export default function StaffNotificationsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <div className="mb-6">
        <PageHeader title="แจ้งเตือน" />
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <Notifications />
      </Suspense>
    </main>
  );
}

async function Notifications() {
  await requireStaff("/staff/notifications");
  return <NotificationsSection />;
}
