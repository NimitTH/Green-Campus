import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyLinkButton } from "@/components/ui";
import { excerpt, splitParagraphs } from "@/lib/articles/format";
import { getPublishedArticle } from "@/lib/articles/public";
import { formatBangkok } from "@/lib/datetime";

type Params = Promise<{ slug: string }>;

// Public article. The body is plain text: each blank-line-separated paragraph is rendered as text in
// its own <p> (whitespace-pre-line keeps single line breaks); nothing is parsed as HTML or markdown.
//
// The lookup is cached (lib/articles/public.ts) and runs before any <Suspense> boundary. That gives a
// real HTTP 404 in `next dev` only: in production this route is partially prerendered and its static shell
// starts streaming first, which fixes the status at 200 (found by the prod e2e run, I7). The HTTP 404 is
// therefore produced by src/proxy.ts (rewrite to the static /article-not-found); notFound() here stays as
// the fallback (e.g. a failed Proxy lookup) and still renders the Thai not-found UI with noindex.
// Awaiting params outside <Suspense> makes the route blocking, which Cache Components only accept when the
// page says so (instant = false; route segment config docs).
export const instant = false;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublishedArticle(slug).catch(() => null);
  if (!article) return { title: "ไม่พบบทความ | Green Campus" };
  return { title: `${article.title} | Green Campus`, description: excerpt(article.body) };
}

export default async function ArticlePage({ params }: { params: Params }) {
  const { slug } = await params;
  const article = await getPublishedArticle(slug);
  if (!article) notFound();
  return (
    <main className="mx-auto w-full max-w-[65ch] flex-1 px-4 py-8 md:px-6 lg:py-12">
      <article>
        <Link href="/articles" className="inline-flex min-h-11 items-center text-sm text-accent underline underline-offset-4">
          ← บทความทั้งหมด
        </Link>
        {article.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- public Supabase Storage URL, already resized in the browser
          <img src={article.coverUrl} alt="" className="mt-4 max-h-80 w-full rounded-card object-cover" />
        ) : null}
        <h1 className="mt-6 font-display text-3xl leading-tight font-semibold break-words text-ink">{article.title}</h1>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="text-sm text-muted">
            โดย {article.authorName ?? "-"} · {formatBangkok(article.createdAt)}
          </p>
          <CopyLinkButton />
        </div>
        <div data-testid="article-body" className="mt-6 space-y-4 text-lg leading-relaxed text-ink">
          {splitParagraphs(article.body).map((p, i) => (
            <p key={i} className="break-words whitespace-pre-line">
              {p}
            </p>
          ))}
        </div>
      </article>
    </main>
  );
}
