import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { NotificationsSection } from "@/app/_components/account-sections";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/dal";
import { isStaffRole } from "@/lib/auth/routes";

export const metadata: Metadata = { title: "แจ้งเตือน | Green Campus" };

// Students read their own rows here; staff get the same list at /staff/notifications (staff shell, M7).
export default function NotificationsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <div className="mb-5">
        <PageHeader title="แจ้งเตือน" />
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <Notifications />
      </Suspense>
    </main>
  );
}

async function Notifications() {
  const user = await requireUser("/notifications");
  if (isStaffRole(user.role)) redirect("/staff/notifications");
  return <NotificationsSection />;
}
