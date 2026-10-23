import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { listPublishedArticles, type PublicArticleSummary } from "@/lib/articles/public";
import { formatBangkok } from "@/lib/datetime";

export const metadata: Metadata = { title: "บทความ | Green Campus", description: "บทความความรู้เรื่องขยะและสิ่งแวดล้อม" };

// Public (anon) list of published articles, newest first. The data is cached (lib/articles/public.ts)
// and the staff actions expire it on every write.
export default function ArticlesPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold">บทความความรู้</h1>
      <Suspense fallback={<PageSkeleton />}>
        <ArticleList />
      </Suspense>
    </main>
  );
}

async function ArticleList() {
  let articles: PublicArticleSummary[] | null;
  try {
    articles = await listPublishedArticles();
  } catch {
    articles = null;
  }
  if (!articles) return <p className="text-sm text-gray-500">ยังโหลดบทความไม่ได้ในขณะนี้ ลองรีเฟรชอีกครั้ง</p>;
  if (articles.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-gray-600 dark:border-gray-700 dark:text-gray-400">
        ยังไม่มีบทความ
      </section>
    );
  }
  return (
    <ul className="space-y-4">
      {articles.map((a) => (
        <li key={a.id} data-testid="article-card">
          <Link
            href={`/articles/${a.slug}`}
            className="flex gap-3 rounded-2xl border border-gray-200 p-3 hover:border-green-600 dark:border-gray-800"
          >
            {a.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- public Supabase Storage URL, already resized in the browser
              <img src={a.coverUrl} alt="" loading="lazy" className="h-20 w-24 shrink-0 rounded-lg object-cover sm:h-24 sm:w-32" />
            ) : (
              <div aria-hidden="true" className="flex h-20 w-24 shrink-0 items-center justify-center rounded-lg bg-green-50 text-3xl sm:h-24 sm:w-32 dark:bg-green-950">
                🌱
              </div>
            )}
            <div className="min-w-0">
              <h2 className="font-semibold break-words">{a.title}</h2>
              <p className="mt-1 text-xs text-gray-500">{formatBangkok(a.createdAt)}</p>
              {a.excerpt ? <p className="mt-1 text-sm break-words text-gray-700 dark:text-gray-300">{a.excerpt}</p> : null}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
