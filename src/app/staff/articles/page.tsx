import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/app/_components/activity-ui";
import { CoverFallback } from "@/app/_components/cover-fallback";
import { isNarrowed, parseListParams } from "@/app/_components/list/list-params";
import { ListToolbar, ListToolbarSkeleton } from "@/app/_components/list/list-toolbar";
import { Pagination } from "@/app/_components/list/pagination";
import { loadClamped } from "@/app/_components/list/paging";
import { ListSkeleton } from "@/app/_components/skeletons";
import { ButtonLink, Card, EmptyState, PageHeader, Mono } from "@/components/ui";
import { ARTICLE_CATEGORY_LABEL_TH } from "@/lib/articles/format";
import { STAFF_ARTICLE_CONFIG } from "@/lib/articles/list-config";
import { listArticlesForStaffPage } from "@/lib/articles/queries";
import { requireStaff } from "@/lib/auth/dal";
import { formatBangkok } from "@/lib/datetime";
import { PublishToggle } from "./_components/publish-toggle";

export const metadata: Metadata = { title: "จัดการบทความ | Green Campus" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// cacheComponents: searchParams and the session are request-time data, read them inside <Suspense>.
export default function StaffArticlesPage({ searchParams }: { searchParams: SearchParams }) {
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
      <Suspense fallback={<ListSkeleton view="list" toolbar={{ views: false, filters: 1 }} />}>
        <ArticleList searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

/** 96x64 cover thumbnail, or the CoverFallback when the article has none. */
function Thumb({ url }: { url: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- public Supabase Storage URL
    return <img src={url} alt="" loading="lazy" width={96} height={64} className="h-16 w-24 shrink-0 rounded-input object-cover" />;
  }
  return <CoverFallback kind={"article"} className="h-16 w-24 shrink-0 rounded-input" />;
}

async function ArticleList({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff("/staff/articles");
  const { params, result } = await loadClamped(STAFF_ARTICLE_CONFIG, parseListParams(STAFF_ARTICLE_CONFIG, await searchParams), listArticlesForStaffPage);

  return (
    <>
      <Suspense fallback={<ListToolbarSkeleton views={false} filters={1} />}>
        <ListToolbar base="/staff/articles" config={STAFF_ARTICLE_CONFIG} placeholder="ค้นหาบทความ" />
      </Suspense>
      {result.items.length === 0 ? (
        isNarrowed(STAFF_ARTICLE_CONFIG, params) ? (
          <EmptyState>
            <p>ไม่พบรายการที่ตรงกับคำค้น</p>
            <Link href="/staff/articles" className="mt-2 inline-flex min-h-11 items-center font-medium text-accent underline underline-offset-4">
              ล้างการค้นหา
            </Link>
          </EmptyState>
        ) : (
          <EmptyState>ยังไม่มีบทความ กด &quot;เขียนบทความ&quot; เพื่อเริ่ม</EmptyState>
        )
      ) : (
        <>
          <ul className="space-y-3">
            {result.items.map((a) => (
              <Card as="li" key={a.id} data-testid="staff-article" data-slug={a.slug} className="flex gap-3">
                <Thumb url={a.coverUrl} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="font-semibold break-words">{a.title}</h2>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge tone={a.published ? "green" : "gray"}>{a.published ? "เผยแพร่แล้ว" : "ฉบับร่าง"}</Badge>
                        <Badge>{ARTICLE_CATEGORY_LABEL_TH[a.category]}</Badge>
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
                </div>
              </Card>
            ))}
          </ul>
          <Pagination base="/staff/articles" config={STAFF_ARTICLE_CONFIG} state={params} total={result.total} />
        </>
      )}
    </>
  );
}
