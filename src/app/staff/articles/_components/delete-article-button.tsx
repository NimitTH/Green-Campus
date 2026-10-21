"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label={`ลบ ${name}`}
          className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
        >
          ลบ
        </button>
        {error ? (
          <p role="alert" className="mt-2 text-sm text-red-700">
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
      className="w-full rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950"
    >
      <p className="mb-3 text-sm text-red-800 dark:text-red-200">ยืนยันลบบทความนี้? ลบแล้วกู้คืนไม่ได้ และรูปปกจะถูกลบด้วย</p>
      {error ? (
        <p role="alert" className="mb-3 text-sm font-medium text-red-800 dark:text-red-200">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={confirm}
          disabled={pending}
          className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
        >
          {pending ? "กำลังลบ..." : "ยืนยันลบ"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(false)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700"
        >
          ยกเลิก
        </button>
      </div>
    </div>
  );
}
