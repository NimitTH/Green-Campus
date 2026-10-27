"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
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
      <Button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-label={`${label} ${title}`}
        variant="card"
      >
        {pending ? "กำลังบันทึก..." : label}
      </Button>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
