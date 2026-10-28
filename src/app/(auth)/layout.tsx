import Link from "next/link";
import { Card } from "@/components/ui";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8 md:px-6 sm:justify-center">
      <div className="w-full max-w-sm">
        <div className="mb-2 flex justify-end">
          <ThemeToggle />
        </div>
        <Link href="/" className="mb-6 block text-center font-display text-2xl font-semibold text-accent">
          Green Campus
        </Link>
        <Card>{children}</Card>
      </div>
    </main>
  );
}
