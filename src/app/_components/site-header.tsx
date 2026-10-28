import Link from "next/link";
import { ButtonLink, ThemeToggle } from "@/components/ui";
import { LeafMark } from "./leaf-mark";

// Shared top bar for public and auth pages. No session read here, so cached pages stay cacheable.
const NAV_LINK =
  "min-h-11 items-center px-1 text-sm text-ink underline-offset-4 hover:text-accent hover:underline";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-[color-mix(in_oklab,var(--paper)_82%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[70rem] items-center gap-x-1 px-4 py-1 md:gap-x-3 md:px-6">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 pr-1 font-display text-base font-semibold whitespace-nowrap text-accent sm:text-lg">
          <LeafMark />
          {/* Phones: the leaf alone, so the bar fits one row; the name stays the link's accessible name. */}
          <span className="max-[439px]:sr-only">Green Campus</span>
        </Link>
        <ThemeToggle className="ml-auto" />
        <nav aria-label="เมนูสาธารณะ" className="flex items-center gap-x-1 md:gap-x-3">
          <Link href="/articles" className={`hidden sm:inline-flex ${NAV_LINK}`}>
            บทความ
          </Link>
          <Link href="/dashboard" className={`inline-flex ${NAV_LINK} max-sm:max-w-[6.5rem] max-sm:leading-tight`}>
            เข้าสู่ระบบ / หน้าของฉัน
          </Link>
          <ButtonLink href="/register" variant="primary" size="sm" className="whitespace-nowrap">
            สมัครสมาชิก
          </ButtonLink>
        </nav>
      </div>
    </header>
  );
}
