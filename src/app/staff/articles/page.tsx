import type { Metadata } from "next";
import { Suspense } from "react";
import { Badge } from "@/app/_components/activity-ui";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { ButtonLink, Card, EmptyState, PageHeader, Mono } from "@/components/ui";
import { listArticlesForStaff } from "@/lib/articles/queries";
import { requireStaff } from "@/lib/auth/dal";
import { formatBangkok } from "@/lib/datetime";
import { PublishToggle } from "./_components/publish-toggle";

export const metadata: Metadata = { title: "จัดการบทความ | Green Campus" };

// cacheComponents: the session is request-time data, read it inside <Suspense>.
export default function StaffArticlesPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <div className="mb-6">
        <PageHeader
          title="จัดการบทความ"
          actions={
            <>
              <ButtonLink href="/staff" variant="quiet">
                กลับ
              </ButtonLink>
              <ButtonLink href="/staff/articles/new" variant="primary">
                เขียนบทความ
              </ButtonLink>
            </>
          }
        />
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
      <EmptyState>ยังไม่มีบทความ กด &quot;เขียนบทความ&quot; เพื่อเริ่ม</EmptyState>
    );
  }

  return (
    <ul className="space-y-3">
      {articles.map((a) => (
        <Card as="li" key={a.id} data-testid="staff-article" data-slug={a.slug}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-semibold break-words">{a.title}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge tone={a.published ? "green" : "gray"}>{a.published ? "เผยแพร่แล้ว" : "ฉบับร่าง"}</Badge>
                <span className="text-xs break-all text-muted">/articles/{a.slug}</span>
              </div>
              <p className="mt-1 text-xs text-muted">
                แก้ไขล่าสุด <Mono text={formatBangkok(a.updatedAt)} />
              </p>
            </div>
            <div className="flex flex-wrap items-start gap-2">
              {a.published ? (
                <ButtonLink href={`/articles/${a.slug}`} variant="card">
                  ดู
                </ButtonLink>
              ) : null}
              <ButtonLink href={`/staff/articles/${a.id}/edit`} aria-label={`แก้ไข ${a.title}`} variant="card">
                แก้ไข
              </ButtonLink>
              <PublishToggle articleId={a.id} title={a.title} published={a.published} updatedAt={a.updatedAt} />
            </div>
          </div>
        </Card>
      ))}
    </ul>
  );
}
