import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CoverFallback } from "@/app/_components/cover-fallback";
import { ListToolbar, ListToolbarSkeleton } from "@/app/_components/list/list-toolbar";
import { isNarrowed, parseListParams, type ListState } from "@/app/_components/list/list-params";
import { Pagination } from "@/app/_components/list/pagination";
import { loadClamped } from "@/app/_components/list/paging";
import { ListSkeleton } from "@/app/_components/skeletons";
import { Badge, Card, EmptyState } from "@/components/ui";
import { ARTICLE_CATEGORY_LABEL_TH } from "@/lib/articles/format";
import { ARTICLE_LIST_CONFIG } from "@/lib/articles/list-config";
import { listPublishedArticlesPage, type PublicArticleListItem } from "@/lib/articles/public";
import { formatBangkok } from "@/lib/datetime";

export const metadata: Metadata = { title: "บทความ | Green Campus", description: "บทความความรู้เรื่องขยะและสิ่งแวดล้อม" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Public (anon) list of published articles (DESIGN-3 5.1, DESIGN-4 3): search, sort + direction, the category
// filter, card/list view, 12 per page. The heading is in the static shell; the toolbar (useSearchParams) and the
// results (awaiting searchParams) each stream in their own <Suspense>, so the route stays a partial prerender. The
// data is cached (lib/articles/public.ts) and the staff actions expire it on every write.
export default function ArticlesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 md:px-6 lg:py-12">
      <h1 className="mb-6 font-display text-3xl font-semibold text-ink">
        <span className="ink-highlight">บทความความรู้</span>
      </h1>
      <Suspense fallback={<ListToolbarSkeleton filters={1} />}>
        <ListToolbar base="/articles" config={ARTICLE_LIST_CONFIG} placeholder="ค้นหาบทความ" />
      </Suspense>
      <Suspense fallback={<ListSkeleton toolbar={false} />}>
        <ArticleResults searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function load(p: ListState) {
  try {
    // only the fields the query uses, so the card and list views share one cache entry
    return await listPublishedArticlesPage({ q: p.q, sort: p.sort, dir: p.dir, filters: p.filters, page: p.page });
  } catch {
    return null;
  }
}

async function ArticleResults({ searchParams }: { searchParams: SearchParams }) {
  // past the end (e.g. ?page=999 or the list shrank): the last page instead
  const { params, result } = await loadClamped(ARTICLE_LIST_CONFIG, parseListParams(ARTICLE_LIST_CONFIG, await searchParams), load);
  if (!result) return <p className="text-sm text-muted">ยังโหลดบทความไม่ได้ในขณะนี้ ลองรีเฟรชอีกครั้ง</p>;
  if (result.total === 0 || result.items.length === 0) {
    if (isNarrowed(ARTICLE_LIST_CONFIG, params)) {
      return (
        <EmptyState>
          <p>ไม่พบรายการที่ตรงกับคำค้น</p>
          <Link href="/articles" className="mt-2 inline-flex min-h-11 items-center font-medium text-accent underline underline-offset-4">
            ล้างการค้นหา
          </Link>
        </EmptyState>
      );
    }
    return <EmptyState>ยังไม่มีบทความ</EmptyState>;
  }
  return (
    <>
      {params.view === "list" ? (
        <ul className="divide-y divide-rule rounded-card border border-rule bg-surface shadow-sheet">
          {result.items.map((a) => (
            <ArticleRow key={a.id} article={a} />
          ))}
        </ul>
      ) : (
        <ul className="grid gap-6 pt-2 sm:grid-cols-2 md:grid-cols-3">
          {result.items.map((a) => (
            <ArticleCard key={a.id} article={a} />
          ))}
        </ul>
      )}
      <Pagination base="/articles" config={ARTICLE_LIST_CONFIG} state={params} total={result.total} />
    </>
  );
}

const LINK_FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** Cover image, or the article CoverFallback when the article has none. */
function Cover({ url, className }: { url: string | null; className: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- public Supabase Storage URL, already resized in the browser
    return <img src={url} alt="" loading="lazy" className={`${className} object-cover`} />;
  }
  return <CoverFallback kind="article" className={className} />;
}

function CategoryBadge({ article }: { article: PublicArticleListItem }) {
  return (
    <span className="flex">
      <Badge>{ARTICLE_CATEGORY_LABEL_TH[article.category]}</Badge>
    </span>
  );
}

function Byline({ article }: { article: PublicArticleListItem }) {
  return (
    <p className="mt-1 text-sm text-muted">
      โดย {article.authorName ?? "-"} · {formatBangkok(article.createdAt)}
    </p>
  );
}

function ArticleCard({ article: a }: { article: PublicArticleListItem }) {
  return (
    <Card as="li" flush deco="pin" tilt data-testid="article-card" className="min-w-0 hover:border-accent">
      <Link href={`/articles/${a.slug}`} className={`block h-full rounded-card p-2.5 pb-4 ${LINK_FOCUS}`}>
        <Cover url={a.coverUrl} className="aspect-[4/3] w-full rounded-input" />
        <div className="mx-1 mt-3">
          <CategoryBadge article={a} />
          <h2 className="mt-2 line-clamp-3 font-display text-lg leading-snug font-semibold break-words text-ink">{a.title}</h2>
          {a.excerpt ? <p className="mt-1 line-clamp-2 text-sm break-words text-ink">{a.excerpt}</p> : null}
          <Byline article={a} />
        </div>
      </Link>
    </Card>
  );
}

function ArticleRow({ article: a }: { article: PublicArticleListItem }) {
  return (
    <li data-testid="article-card" className="min-w-0">
      <Link href={`/articles/${a.slug}`} className={`flex gap-3 rounded-card p-3 hover:bg-accent-soft md:p-4 ${LINK_FOCUS}`}>
        <Cover url={a.coverUrl} className="h-16 w-24 shrink-0 rounded-input" />
        <div className="min-w-0">
          <CategoryBadge article={a} />
          <h2 className="mt-1 font-display text-base leading-snug font-semibold break-words text-ink">{a.title}</h2>
          {a.excerpt ? <p className="mt-0.5 line-clamp-2 text-sm break-words text-ink">{a.excerpt}</p> : null}
          <Byline article={a} />
        </div>
      </Link>
    </li>
  );
}
