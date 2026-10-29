import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ProfileDetails } from "@/app/_components/account-sections";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { SignOutButton } from "@/app/_components/sign-out-button";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/dal";
import { isStaffRole } from "@/lib/auth/routes";

export const metadata: Metadata = { title: "โปรไฟล์ | Green Campus" };

const linkClass =
  "block min-h-11 rounded-card border border-rule bg-surface p-4 font-semibold text-ink shadow-card transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const hintClass = "block text-sm font-normal text-muted";

// "ฉัน" hub (spec 9.2): pages that are not in the bottom nav.
const SHORTCUTS = [
  { href: "/my-submissions", label: "ผลที่ส่ง", hint: "สถานะผลกิจกรรมที่ส่ง" },
  { href: "/leaderboard", label: "อันดับ", hint: "อันดับคาร์บอนของฉัน" },
  { href: "/orders", label: "ออเดอร์", hint: "ออเดอร์และใบเสร็จ" },
  { href: "/articles", label: "บทความ", hint: "ความรู้เรื่องขยะและสิ่งแวดล้อม" },
] as const;

function emailParam(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

// cacheComponents: the session is request-time data, read it inside <Suspense>.
type Search = Promise<{ [key: string]: string | string[] | undefined }>;

export default function ProfilePage({ searchParams }: { searchParams: Search }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <div className="mb-4">
        <PageHeader title="โปรไฟล์ของฉัน" />
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <Profile searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Profile({ searchParams }: { searchParams: Search }) {
  const user = await requireUser("/profile");
  const email = emailParam((await searchParams).email);
  // Staff use the same page inside the staff shell (M7).
  if (isStaffRole(user.role)) redirect(email ? `/staff/profile?email=${encodeURIComponent(email)}` : "/staff/profile");
  return (
    <>
      <ProfileDetails user={user} emailNotice={email} />
      <nav aria-label="ทางลัดของฉัน" className="mt-8 grid grid-cols-2 gap-3">
        {SHORTCUTS.map((s) => (
          <Link key={s.href} href={s.href} className={linkClass}>
            {s.label}
            <span className={hintClass}>{s.hint}</span>
          </Link>
        ))}
      </nav>
      <div className="mt-8">
        <SignOutButton />
      </div>
    </>
  );
}
