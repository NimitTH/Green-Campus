"use client";

import { useActionState, useState } from "react";
import { deleteActivityForm, type DeleteActivityFormState } from "@/app/actions/activities";

/** Two-step delete: "ลบ" shows an inline confirmation (no browser dialogs). */
export function DeleteActivityButton({ activityId, title }: { activityId: string; title: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState<DeleteActivityFormState, FormData>(
    deleteActivityForm,
    undefined,
  );

  if (!confirming) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label={`ลบ ${title}`}
          className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
        >
          ลบ
        </button>
        {state?.error ? (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {state.error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form
      action={action}
      role="group"
      aria-label={`ยืนยันการลบ ${title}`}
      className="w-full rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950"
    >
      <input type="hidden" name="activityId" value={activityId} />
      <p className="mb-3 text-sm text-red-800 dark:text-red-200">ยืนยันลบกิจกรรมนี้? ผู้เข้าร่วมจะถูกลบด้วย</p>
      {state?.error ? (
        <p role="alert" className="mb-3 text-sm font-medium text-red-800 dark:text-red-200">
          {state.error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
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
    </form>
  );
}
