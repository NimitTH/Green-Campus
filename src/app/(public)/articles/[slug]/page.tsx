import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { excerpt, splitParagraphs } from "@/lib/articles/format";
import { getPublishedArticle } from "@/lib/articles/public";
import { formatBangkok } from "@/lib/datetime";

type Params = Promise<{ slug: string }>;

// Public article. The body is plain text: each blank-line-separated paragraph is rendered as text in
// its own <p> (whitespace-pre-line keeps single line breaks); nothing is parsed as HTML or markdown.
//
// The lookup is cached (lib/articles/public.ts) and runs before any <Suspense> boundary, so a missing,
// unpublished or malformed slug is a real HTTP 404 (notFound() before streaming starts), not a 200
// with the not-found UI streamed in. Awaiting params outside <Suspense> makes the route blocking, which
// Cache Components only accept when the page says so (instant = false; route segment config docs).
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
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <article>
        <Link href="/articles" className="text-sm text-green-700 underline">
          ← บทความทั้งหมด
        </Link>
        <h1 className="mt-3 text-2xl font-semibold break-words">{article.title}</h1>
        <p className="mt-1 text-xs text-gray-500">{formatBangkok(article.createdAt)}</p>
        {article.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- public Supabase Storage URL, already resized in the browser
          <img src={article.coverUrl} alt="" className="mt-4 max-h-80 w-full rounded-2xl object-cover" />
        ) : null}
        <div data-testid="article-body" className="mt-4 space-y-4 leading-relaxed">
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
