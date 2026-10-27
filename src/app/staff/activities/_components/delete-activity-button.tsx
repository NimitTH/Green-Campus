"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui";
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
        <Button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label={`ลบ ${title}`}
          variant="danger"
        >
          ลบ
        </Button>
        {state?.error ? (
          <p role="alert" className="mt-2 text-sm text-danger">
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
      className="w-full rounded-card border border-danger bg-surface p-3"
    >
      <input type="hidden" name="activityId" value={activityId} />
      <p className="mb-3 text-sm text-ink">ยืนยันลบกิจกรรมนี้? ผู้เข้าร่วมจะถูกลบด้วย</p>
      {state?.error ? (
        <p role="alert" className="mb-3 text-sm font-medium text-danger">
          {state.error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
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
    </form>
  );
}
