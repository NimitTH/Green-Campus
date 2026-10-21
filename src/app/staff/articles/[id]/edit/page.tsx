import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { getArticleForStaff } from "@/lib/articles/queries";
import { requireStaff } from "@/lib/auth/dal";
import { isAdminRole } from "@/lib/auth/routes";
import { isUuid } from "@/lib/uuid";
import { ArticleForm } from "../../_components/article-form";
import { DeleteArticleButton } from "../../_components/delete-article-button";

export const metadata: Metadata = { title: "แก้ไขบทความ | Green Campus" };

// cacheComponents: params are request-time data, read them inside <Suspense>.
export default function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <h1 className="mb-5 text-xl font-semibold">แก้ไขบทความ</h1>
      <Suspense fallback={<PageSkeleton />}>
        <EditArticle params={params} />
      </Suspense>
    </main>
  );
}

async function EditArticle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStaff(`/staff/articles/${encodeURIComponent(id)}/edit`);
  if (!isUuid(id)) notFound();
  const article = await getArticleForStaff(id);
  if (!article) notFound();
  return (
    <>
      {/* keyed by updated_at: a newer version (after a save elsewhere) remounts the form */}
      <ArticleForm
        key={article.updatedAt}
        id={article.id}
        coverUrl={article.coverUrl}
        updatedAt={article.updatedAt}
        initial={{ title: article.title, slug: article.slug, body: article.body, published: article.published }}
      />
      {isAdminRole(user.role) ? (
        <section aria-labelledby="delete-heading" className="mt-10 border-t border-gray-200 pt-6 dark:border-gray-800">
          <h2 id="delete-heading" className="mb-2 font-semibold">
            ลบบทความ
          </h2>
          <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">ลบได้เฉพาะผู้ดูแลระบบ ถ้าแค่ไม่อยากให้เห็น ให้ยกเลิกการเผยแพร่แทน</p>
          <DeleteArticleButton articleId={article.id} name={article.title} />
        </section>
      ) : null}
    </>
  );
}
