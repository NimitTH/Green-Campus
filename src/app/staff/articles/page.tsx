import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/app/_components/activity-ui";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { listArticlesForStaff } from "@/lib/articles/queries";
import { requireStaff } from "@/lib/auth/dal";
import { formatBangkok } from "@/lib/datetime";
import { PublishToggle } from "./_components/publish-toggle";

export const metadata: Metadata = { title: "จัดการบทความ | Green Campus" };

// cacheComponents: the session is request-time data, read it inside <Suspense>.
export default function StaffArticlesPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">จัดการบทความ</h1>
        <div className="flex items-center gap-3">
          <Link href="/staff" className="text-sm text-green-700 underline">
            กลับ
          </Link>
          <Link
            href="/staff/articles/new"
            className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800"
          >
            เขียนบทความ
          </Link>
        </div>
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <ArticleList />
      </Suspense>
    </main>
  );
}

async function ArticleList() {
  await requireStaff("/staff/articles");
  const articles = await listArticlesForStaff();

  if (articles.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-gray-600 dark:border-gray-700 dark:text-gray-400">
        ยังไม่มีบทความ กด &quot;เขียนบทความ&quot; เพื่อเริ่ม
      </section>
    );
  }

  return (
    <ul className="space-y-3">
      {articles.map((a) => (
        <li key={a.id} data-testid="staff-article" data-slug={a.slug} className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-semibold break-words">{a.title}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge tone={a.published ? "green" : "gray"}>{a.published ? "เผยแพร่แล้ว" : "ฉบับร่าง"}</Badge>
                <span className="text-xs break-all text-gray-500">/articles/{a.slug}</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">แก้ไขล่าสุด {formatBangkok(a.updatedAt)}</p>
            </div>
            <div className="flex flex-wrap items-start gap-2">
              {a.published ? (
                <Link
                  href={`/articles/${a.slug}`}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-900"
                >
                  ดู
                </Link>
              ) : null}
              <Link
                href={`/staff/articles/${a.id}/edit`}
                aria-label={`แก้ไข ${a.title}`}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-900"
              >
                แก้ไข
              </Link>
              <PublishToggle articleId={a.id} title={a.title} published={a.published} updatedAt={a.updatedAt} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
