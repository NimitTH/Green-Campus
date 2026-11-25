"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

const LABEL = "แจ้งปัญหาการใช้งาน";

/**
 * Round 6 (old-site features 5): the footer link to the problem form, carrying the current page as ?from=.
 * Cache Components: usePathname() can suspend while a static shell is prerendered, so the fallback is the plain link.
 */
export function ReportProblemLink({ className }: { className: string }) {
  return (
    <Suspense
      fallback={
        <Link href="/report-problem" className={className}>
          {LABEL}
        </Link>
      }
    >
      <WithPath className={className} />
    </Suspense>
  );
}

function WithPath({ className }: { className: string }) {
  const pathname = usePathname();
  const href = pathname && pathname !== "/report-problem" ? `/report-problem?from=${encodeURIComponent(pathname)}` : "/report-problem";
  return (
    <Link href={href} className={className}>
      {LABEL}
    </Link>
  );
}
