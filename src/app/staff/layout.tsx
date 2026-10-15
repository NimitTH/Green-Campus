import Link from "next/link";
import { Suspense } from "react";
import { requireStaff } from "@/lib/auth/dal";
import { PageSkeleton } from "../_components/page-skeleton";

// Every /staff/** page renders inside StaffGate: non-staff are redirected to /dashboard
// before any child renders. Admin-only pages (/staff/users, /staff/rates) must also call
// requireAdmin() themselves. Layouts do not re-run on every client navigation, so staff
// pages and their data functions must still check the role (DAL) and rely on RLS.
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        <Link href="/staff" className="font-semibold text-green-700">
          Green Campus · ครูและผู้ดูแล
        </Link>
      </header>
      <Suspense fallback={<PageSkeleton />}>
        <StaffGate>{children}</StaffGate>
      </Suspense>
    </div>
  );
}

async function StaffGate({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return <>{children}</>;
}
