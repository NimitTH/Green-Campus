import type { Metadata } from "next";
import { Suspense } from "react";
import { FormSkeleton } from "@/app/_components/skeletons";
import { PageHeader } from "@/components/ui";
import type { ArticleInput } from "@/lib/articles/format";
import { requireStaff } from "@/lib/auth/dal";
import { ArticleForm } from "../_components/article-form";

export const metadata: Metadata = { title: "เขียนบทความ | Green Campus" };

const EMPTY: ArticleInput = { title: "", slug: "", body: "", published: false, category: "knowledge" };

export default function NewArticlePage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <div className="mb-6">
        <PageHeader title="เขียนบทความ" />
      </div>
      <Suspense fallback={<FormSkeleton />}>
        <NewArticle />
      </Suspense>
    </main>
  );
}

async function NewArticle() {
  await requireStaff("/staff/articles/new");
  return <ArticleForm initial={EMPTY} />;
}
