import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8 sm:justify-center">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 block text-center text-xl font-semibold text-green-700">
          Green Campus
        </Link>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          {children}
        </div>
      </div>
    </main>
  );
}
