import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfileDetails } from "@/app/_components/account-sections";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { requireStaff } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "โปรไฟล์ | Green Campus" };

// Staff version of /profile (M7): same form, staff shell. Sign out is in the staff menu.
export default function StaffProfilePage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold">โปรไฟล์ของฉัน</h1>
      <Suspense fallback={<PageSkeleton />}>
        <Profile />
      </Suspense>
    </main>
  );
}

async function Profile() {
  const user = await requireStaff("/staff/profile");
  return <ProfileDetails user={user} />;
}
