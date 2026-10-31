import Link from "next/link";
import { Card } from "@/components/ui";
import { SiteFooter } from "../_components/site-footer";
import { SiteHeader } from "../_components/site-header";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="flex flex-1 flex-col items-center px-4 py-8 md:px-6 sm:justify-center">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-6 flex min-h-11 items-center justify-center font-display text-2xl font-semibold text-accent">
            Green Campus
          </Link>
          <Card deco="tape">{children}</Card>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
