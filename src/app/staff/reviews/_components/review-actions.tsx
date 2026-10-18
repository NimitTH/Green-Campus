"use client";

import { useActionState, useState } from "react";
import { reviewSubmissionForm, type ReviewFormState } from "@/app/actions/reviews";
import { reviewErrorMessageTh } from "@/lib/errors";
import { REJECT_REASON_MAX, rejectReasonError } from "@/lib/reviews/reason";

/** Approve, or reject with a required reason. Both buttons are disabled while either runs. */
export function ReviewActions({ submissionId }: { submissionId: string }) {
  const [state, dispatch, pending] = useActionState<ReviewFormState, FormData>(reviewSubmissionForm, undefined);
  // Controlled: React resets uncontrolled fields after a form action, which would lose the reason on an error.
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);

  function reject(formData: FormData) {
    const code = rejectReasonError(reason);
    if (code) {
      setReasonError(reviewErrorMessageTh(code));
      return;
    }
    setReasonError(null);
    dispatch(formData);
  }

  return (
    <div className="space-y-5">
      {state?.error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          {state.error}
        </div>
      ) : null}

      <form action={dispatch}>
        <input type="hidden" name="submissionId" value={submissionId} />
        <input type="hidden" name="decision" value="approve" />
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-green-700 px-4 py-3 text-base font-semibold text-white hover:bg-green-800 disabled:opacity-60"
        >
          {pending ? "กำลังบันทึก..." : "อนุมัติ"}
        </button>
      </form>

      <form action={reject} noValidate className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
        <input type="hidden" name="submissionId" value={submissionId} />
        <input type="hidden" name="decision" value="reject" />
        <label htmlFor="reason" className="mb-1 block text-sm font-medium">
          เหตุผลที่ไม่ผ่าน (ต้องกรอกเมื่อกดไม่ผ่าน)
        </label>
        <textarea
          id="reason"
          name="reason"
          rows={3}
          required
          maxLength={REJECT_REASON_MAX}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-invalid={reasonError ? true : undefined}
          aria-describedby={reasonError ? "reason-error" : "reason-hint"}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/30 aria-[invalid=true]:border-red-500 dark:border-gray-700 dark:bg-gray-900"
        />
        {reasonError ? (
          <p id="reason-error" className="mt-1 text-sm text-red-600">
            {reasonError}
          </p>
        ) : (
          <p id="reason-hint" className="mt-1 text-xs text-gray-500">
            นักเรียนจะเห็นเหตุผลนี้ ไม่เกิน {REJECT_REASON_MAX} ตัวอักษร
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="mt-3 w-full rounded-lg border border-red-300 px-4 py-3 text-base font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
        >
          {pending ? "กำลังบันทึก..." : "ไม่ผ่าน"}
        </button>
      </form>
    </div>
  );
}
