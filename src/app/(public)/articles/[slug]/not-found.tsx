import Link from "next/link";

export default function ArticleNotFound() {
  return (
    <section className="rounded-2xl border border-dashed border-gray-300 p-6 text-center dark:border-gray-700">
      <h1 className="text-lg font-semibold">ไม่พบบทความนี้</h1>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">บทความอาจถูกยกเลิกการเผยแพร่หรือถูกลบไปแล้ว</p>
      <Link href="/articles" className="mt-3 inline-block text-sm text-green-700 underline">
        ดูบทความทั้งหมด
      </Link>
    </section>
  );
}
