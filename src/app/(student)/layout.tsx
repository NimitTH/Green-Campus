import Link from "next/link";
import { NotificationBell } from "@/components/NotificationBell";

// Student area shell. No session read here: each page checks the user inside <Suspense>.
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        <Link href="/dashboard" className="font-semibold text-green-700">
          Green Campus
        </Link>
        <nav aria-label="เมนูหลัก" className="flex gap-4 text-sm">
          <Link href="/dashboard" className="hover:underline">
            หน้าหลัก
          </Link>
          <Link href="/activities" className="hover:underline">
            กิจกรรม
          </Link>
          <Link href="/my-submissions" className="hover:underline">
            ผลที่ส่ง
          </Link>
        </nav>
        <NotificationBell />
      </header>
      {children}
    </div>
  );
}
