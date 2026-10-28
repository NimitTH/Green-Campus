import Link from "next/link";
import { ButtonLink, ThemeToggle } from "@/components/ui";

// Shared top bar for public and auth pages. No session read here, so cached pages stay cacheable.
export function LeafMark() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false" className="shrink-0 text-accent">
      <path d="M5 19C5 10 10 5 20 4c0 10-5 15-13 15" fill="currentColor" />
      <path d="M5 19c3-5 6-8 10-10" fill="none" stroke="var(--paper)" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

const NAV_LINK =
  "min-h-11 items-center px-1 text-sm text-ink underline-offset-4 hover:text-accent hover:underline";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-[color-mix(in_oklab,var(--paper)_82%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[70rem] items-center gap-x-1 px-4 py-1 md:gap-x-3 md:px-6">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 pr-1 font-display text-base font-semibold text-accent sm:text-lg">
          <LeafMark />
          Green Campus
        </Link>
        <ThemeToggle className="ml-auto" />
        <nav aria-label="เมนูสาธารณะ" className="flex items-center gap-x-1 md:gap-x-3">
          <Link href="/articles" className={`hidden sm:inline-flex ${NAV_LINK}`}>
            บทความ
          </Link>
          <Link href="/dashboard" className={`inline-flex ${NAV_LINK} max-sm:max-w-[6.5rem] max-sm:leading-tight`}>
            เข้าสู่ระบบ / หน้าของฉัน
          </Link>
          <ButtonLink href="/register" variant="primary" size="sm">
            สมัครสมาชิก
          </ButtonLink>
        </nav>
      </div>
    </header>
  );
}
