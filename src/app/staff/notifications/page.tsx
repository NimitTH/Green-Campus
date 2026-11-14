import type { Metadata } from "next";
import { Suspense } from "react";
import { NotificationsSection } from "@/app/_components/account-sections";
import { ListSkeleton } from "@/app/_components/skeletons";
import { ButtonLink, PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "แจ้งเตือน | Green Campus" };

// Staff version of /notifications (M7): same list (RLS: own rows only), staff shell.
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function StaffNotificationsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <div className="mb-6">
        <PageHeader
          title="แจ้งเตือน"
          actions={
            <ButtonLink href="/staff" variant="quiet">
              กลับ
            </ButtonLink>
          }
        />
      </div>
      <Suspense fallback={<ListSkeleton view="list" toolbar={{ views: false, filters: 1 }} thumb={false} />}>
        <Notifications searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Notifications({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff("/staff/notifications");
  return <NotificationsSection base="/staff/notifications" role="staff" searchParams={searchParams} />;
}
