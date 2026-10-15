import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-2xl font-semibold">Green Campus</h1>
      <p className="text-gray-600 dark:text-gray-400">ระบบจัดการขยะในวิทยาลัย</p>
      <div className="flex w-full max-w-xs flex-col gap-3">
        <Link
          href="/register"
          className="rounded-lg bg-green-700 px-4 py-3 font-semibold text-white hover:bg-green-800"
        >
          สมัครสมาชิก
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-gray-300 px-4 py-3 font-semibold hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-900"
        >
          เข้าสู่ระบบ
        </Link>
      </div>
    </main>
  );
}
