import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";

// Public shell (/articles, spec 9.1). No session read here, so the pages stay cacheable for everyone.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-rule bg-surface px-4 py-1 md:px-6 xl:px-10">
        <Link href="/" className="py-2 font-display text-lg font-semibold text-accent">
          Green Campus
        </Link>
        <nav aria-label="เมนูสาธารณะ" className="flex flex-wrap items-center gap-x-4 text-sm">
          <Link href="/articles" className="inline-flex min-h-11 items-center text-ink underline-offset-4 hover:text-accent hover:underline">
            บทความ
          </Link>
          <Link href="/dashboard" className="inline-flex min-h-11 items-center text-ink underline-offset-4 hover:text-accent hover:underline">
            เข้าสู่ระบบ / หน้าของฉัน
          </Link>
        </nav>
        <ThemeToggle compact className="ml-auto" />
      </header>
      {children}
    </div>
  );
}
