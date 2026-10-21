"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setArticlePublished } from "@/app/actions/articles";

/** Publish or unpublish an article from the list (optimistic concurrency on updated_at). */
export function PublishToggle({
  articleId,
  title,
  published,
  updatedAt,
}: {
  articleId: string;
  title: string;
  published: boolean;
  updatedAt: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const label = published ? "ยกเลิกเผยแพร่" : "เผยแพร่";

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await setArticlePublished(articleId, !published, updatedAt);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-label={`${label} ${title}`}
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-900"
      >
        {pending ? "กำลังบันทึก..." : label}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
