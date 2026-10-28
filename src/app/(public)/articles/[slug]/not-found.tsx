import Link from "next/link";
import { buttonClass, EmptyState } from "@/components/ui";

export default function ArticleNotFound() {
  return (
    <EmptyState className="mx-auto my-8 w-[calc(100%-2rem)] max-w-xl md:my-12">
      <h1 className="font-display text-xl font-semibold text-ink">
        <span className="ink-highlight">ไม่พบบทความนี้</span>
      </h1>
      <p className="mt-1 text-sm text-muted">บทความอาจถูกยกเลิกการเผยแพร่หรือถูกลบไปแล้ว</p>
      <Link href="/articles" className={buttonClass({ variant: "card", className: "mt-4" })}>
        ดูบทความทั้งหมด
      </Link>
    </EmptyState>
  );
}
