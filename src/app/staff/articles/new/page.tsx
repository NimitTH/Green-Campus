import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import type { ArticleInput } from "@/lib/articles/format";
import { requireStaff } from "@/lib/auth/dal";
import { ArticleForm } from "../_components/article-form";

export const metadata: Metadata = { title: "เขียนบทความ | Green Campus" };

const EMPTY: ArticleInput = { title: "", slug: "", body: "", published: false };

export default function NewArticlePage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <h1 className="mb-5 text-xl font-semibold">เขียนบทความ</h1>
      <Suspense fallback={<PageSkeleton />}>
        <NewArticle />
      </Suspense>
    </main>
  );
}

async function NewArticle() {
  await requireStaff("/staff/articles/new");
  return <ArticleForm initial={EMPTY} />;
}
