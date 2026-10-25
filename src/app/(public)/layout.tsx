import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";

// Public shell (/articles, spec 9.1). No session read here, so the pages stay cacheable for everyone.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        <Link href="/" className="font-semibold text-green-700">
          Green Campus
        </Link>
        <nav aria-label="เมนูสาธารณะ" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href="/articles" className="hover:underline">
            บทความ
          </Link>
          <Link href="/dashboard" className="hover:underline">
            เข้าสู่ระบบ / หน้าของฉัน
          </Link>
        </nav>
        <ThemeToggle compact />
      </header>
      {children}
    </div>
  );
}
