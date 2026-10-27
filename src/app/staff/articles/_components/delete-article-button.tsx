"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { deleteArticle } from "@/app/actions/articles";

/** Two-step delete (admin only; the page does not render it for teachers). */
export function DeleteArticleButton({ articleId, name }: { articleId: string; name: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteArticle(articleId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/staff/articles");
      router.refresh();
    });
  }

  if (!confirming) {
    return (
      <div>
        <Button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label={`ลบ ${name}`}
          variant="danger"
        >
          ลบ
        </Button>
        {error ? (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label={`ยืนยันการลบ ${name}`}
      className="w-full rounded-card border border-danger bg-surface p-3"
    >
      <p className="mb-3 text-sm text-ink">ยืนยันลบบทความนี้? ลบแล้วกู้คืนไม่ได้ และรูปปกจะถูกลบด้วย</p>
      {error ? (
        <p role="alert" className="mb-3 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={confirm}
          disabled={pending}
          variant="danger"
        >
          {pending ? "กำลังลบ..." : "ยืนยันลบ"}
        </Button>
        <Button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(false)}
          variant="card"
        >
          ยกเลิก
        </Button>
      </div>
    </div>
  );
}
