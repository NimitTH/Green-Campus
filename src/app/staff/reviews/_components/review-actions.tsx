"use client";

import { useActionState, useId, useState } from "react";
import { reviewSubmissionForm, type ReviewFormState } from "@/app/actions/reviews";
import { Button, Card, inputClass } from "@/components/ui";
import { reviewErrorMessageTh } from "@/lib/errors";
import { REJECT_REASON_MAX, rejectReasonError } from "@/lib/reviews/reason";

/** Approve, or reject with a required reason. Both buttons are disabled while either runs. */
export function ReviewActions({ submissionId }: { submissionId: string }) {
  const [state, dispatch, pending] = useActionState<ReviewFormState, FormData>(reviewSubmissionForm, undefined);
  // Controlled: React resets uncontrolled fields after a form action, which would lose the reason on an error.
  // unique per instance: a visited review page stays alive (hidden <Activity>) next to the current one
  const uid = useId();
  const f = (name: string) => `${uid}-${name}`;
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);

  // One error at a time: a client-side reason error hides the previous server error, and every
  // dispatch clears the reason error so the next server result shows.
  function approve(formData: FormData) {
    setReasonError(null);
    dispatch(formData);
  }

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
      {state?.error && !reasonError ? (
        <div
          role="alert"
          className="rounded-input border border-danger p-3 text-sm text-danger"
        >
          {state.error}
        </div>
      ) : null}

      <form action={approve}>
        <input type="hidden" name="submissionId" value={submissionId} />
        <input type="hidden" name="decision" value="approve" />
        <Button type="submit" variant="primary" size="lg" disabled={pending} className="w-full">
          {pending ? "กำลังบันทึก..." : "อนุมัติ"}
        </Button>
      </form>

      <Card>
        <form action={reject} noValidate>
        <input type="hidden" name="submissionId" value={submissionId} />
        <input type="hidden" name="decision" value="reject" />
        <label htmlFor={f("reason")} className="mb-1 block text-sm font-medium text-ink">
          เหตุผลที่ไม่ผ่าน (ต้องกรอกเมื่อกดไม่ผ่าน)
        </label>
        <textarea
          id={f("reason")}
          name="reason"
          rows={3}
          required
          maxLength={REJECT_REASON_MAX}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-invalid={reasonError ? true : undefined}
          aria-describedby={reasonError ? f("reason-error") : f("reason-hint")}
          className={inputClass}
        />
        {reasonError ? (
          <p id={f("reason-error")} className="mt-1 text-sm text-danger">
            {reasonError}
          </p>
        ) : (
          <p id={f("reason-hint")} className="mt-1 text-xs text-muted">
            นักเรียนจะเห็นเหตุผลนี้ ไม่เกิน {REJECT_REASON_MAX} ตัวอักษร
          </p>
        )}
        <Button type="submit" variant="danger" size="lg" disabled={pending} className="mt-3 w-full">
          {pending ? "กำลังบันทึก..." : "ไม่ผ่าน"}
        </Button>
        </form>
      </Card>
    </div>
  );
}
