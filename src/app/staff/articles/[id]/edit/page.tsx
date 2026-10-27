import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { PageHeader } from "@/components/ui";
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
      <div className="mb-6">
        <PageHeader title="แก้ไขบทความ" />
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <EditArticle params={params} />
      </Suspense>
    </main>
  );
}

async function EditArticle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // per-route id: two edit pages can be alive at once (hidden <Activity>); useId is identical across separate server renders
  const deleteHeadingId = `delete-heading-${id}`;
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
        <section aria-labelledby={deleteHeadingId} className="mt-10 border-t border-rule pt-6">
          <h2 id={deleteHeadingId} className="mb-2 font-display text-lg font-semibold">
            ลบบทความ
          </h2>
          <p className="mb-3 text-sm text-muted">ลบได้เฉพาะผู้ดูแลระบบ ถ้าแค่ไม่อยากให้เห็น ให้ยกเลิกการเผยแพร่แทน</p>
          <DeleteArticleButton articleId={article.id} name={article.title} />
        </section>
      ) : null}
    </>
  );
}
