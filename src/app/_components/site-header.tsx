import Link from "next/link";
import { Suspense } from "react";
import { HeaderAccount } from "./header-account";
import { LeafMark } from "./leaf-mark";

// DESIGN-3 3.1/3.2: the one top bar of every page outside /staff/**. It does not read the session itself: the
// right side (and the student centre nav) stream in through HeaderAccount inside <Suspense>, so everything
// else on the page stays in the static shell ("/" and "/articles" build as partial prerenders).
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-[color-mix(in_oklab,var(--paper)_82%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[70rem] items-center gap-x-1 px-4 py-1 md:gap-x-3 md:px-6">
        <Link href="/" className="inline-flex min-h-11 shrink-0 items-center gap-2 pr-1 font-display text-base font-semibold whitespace-nowrap text-accent sm:text-lg">
          <LeafMark />
          {/* Phones: the leaf alone, so the bar fits one row; the name stays the link's accessible name. */}
          <span className="max-[439px]:sr-only">Green Campus</span>
        </Link>
        <Suspense fallback={<HeaderAccountSkeleton />}>
          <HeaderAccount />
        </Suspense>
      </div>
    </header>
  );
}

/** Empty box the size of the signed-out controls (no text), so the bar does not shift when the session arrives. */
function HeaderAccountSkeleton() {
  return <div aria-hidden="true" className="ml-auto h-11 w-[13.5rem] shrink-0 md:w-[15.5rem]" />;
}
