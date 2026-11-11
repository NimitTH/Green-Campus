import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { NotificationsSection } from "@/app/_components/account-sections";
import { ListSkeleton } from "@/app/_components/skeletons";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/dal";
import { isStaffRole } from "@/lib/auth/routes";

export const metadata: Metadata = { title: "แจ้งเตือน | Green Campus" };

// Students read their own rows here; staff get the same list at /staff/notifications (staff shell, M7).
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function NotificationsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <div className="mb-5">
        <PageHeader title="แจ้งเตือน" />
      </div>
      <Suspense fallback={<ListSkeleton view="list" toolbar={false} />}>
        <Notifications searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Notifications({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser("/notifications");
  if (isStaffRole(user.role)) redirect("/staff/notifications");
  return <NotificationsSection base="/notifications" role="student" searchParams={searchParams} />;
}
