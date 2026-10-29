import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfileDetails } from "@/app/_components/account-sections";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "โปรไฟล์ | Green Campus" };

// Staff version of /profile (M7): same form, staff shell. Sign out is in the staff menu.
type Search = Promise<{ [key: string]: string | string[] | undefined }>;

export default function StaffProfilePage({ searchParams }: { searchParams: Search }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <div className="mb-6">
        <PageHeader title="โปรไฟล์ของฉัน" />
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <Profile searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Profile({ searchParams }: { searchParams: Search }) {
  const user = await requireStaff("/staff/profile");
  const email = (await searchParams).email;
  return <ProfileDetails user={user} emailNotice={typeof email === "string" ? email : undefined} />;
}
