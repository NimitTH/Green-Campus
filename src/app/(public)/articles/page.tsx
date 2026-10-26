import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { Card, EmptyState } from "@/components/ui";
import { listPublishedArticles, type PublicArticleSummary } from "@/lib/articles/public";
import { formatBangkok } from "@/lib/datetime";

export const metadata: Metadata = { title: "บทความ | Green Campus", description: "บทความความรู้เรื่องขยะและสิ่งแวดล้อม" };

// Public (anon) list of published articles, newest first. The data is cached (lib/articles/public.ts)
// and the staff actions expire it on every write.
export default function ArticlesPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 md:px-6 lg:py-12">
      <h1 className="mb-6 font-display text-3xl font-semibold text-ink">บทความความรู้</h1>
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
  if (!articles) return <p className="text-sm text-muted">ยังโหลดบทความไม่ได้ในขณะนี้ ลองรีเฟรชอีกครั้ง</p>;
  if (articles.length === 0) {
    return (
      <EmptyState>ยังไม่มีบทความ</EmptyState>
    );
  }
  return (
    <ul className="space-y-4">
      {articles.map((a) => (
        <Card as="li" flush key={a.id} data-testid="article-card" className="transition-colors hover:border-accent">
          <Link
            href={`/articles/${a.slug}`}
            className="flex gap-3 rounded-card p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:p-4"
          >
            {a.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- public Supabase Storage URL, already resized in the browser
              <img src={a.coverUrl} alt="" loading="lazy" className="h-20 w-24 shrink-0 rounded-card object-cover sm:h-24 sm:w-32" />
            ) : (
              <div aria-hidden="true" className="flex h-20 w-24 shrink-0 items-center justify-center rounded-card bg-accent-soft text-3xl sm:h-24 sm:w-32">
                🌱
              </div>
            )}
            <div className="min-w-0">
              <h2 className="font-display text-lg font-semibold break-words text-ink">{a.title}</h2>
              <p className="mt-1 text-sm text-muted">{formatBangkok(a.createdAt)}</p>
              {a.excerpt ? <p className="mt-1 text-sm break-words text-ink">{a.excerpt}</p> : null}
            </div>
          </Link>
        </Card>
      ))}
    </ul>
  );
}
