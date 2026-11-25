"use client";

import { useActionState, useState } from "react";
import { submitProblemReport, type ReportFormState } from "@/app/actions/problem-reports";
import { Button, Field, inputClass } from "@/components/ui";
import { REPORT_MESSAGE_MAX } from "@/lib/problem-reports/format";

/**
 * Round 6 (old-site features 5): the website problem form, shared by /report-problem and /staff/report-problem.
 * `from` is the page the user came from (?from=, already checked on the server), or null.
 */
export function ReportProblemForm({ from, idPrefix }: { from: string | null; idPrefix: string }) {
  const messageId = `${idPrefix}-report-message`; // route-prefixed: hidden <Activity> layouts can keep both forms mounted
  const [state, action, pending] = useActionState<ReportFormState, FormData>(submitProblemReport, undefined);
  const pageUrl = from;
  // controlled, so a failed send keeps the text (React resets uncontrolled fields after an action); a successful one clears it
  const [message, setMessage] = useState("");
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state?.ok) setMessage("");
  }


  const failed = state && !state.ok ? state : null;
  return (
    <form action={action} noValidate>
      {state?.ok ? (
        <p role="status" className="mb-4 rounded-input border border-accent bg-accent-soft p-3 text-sm text-accent">
          ส่งเรื่องแล้ว ขอบคุณที่แจ้ง ผู้ดูแลจะได้รับแจ้งเตือน
        </p>
      ) : null}
      {failed?.error ? (
        <p role="alert" className="mb-4 rounded-input border border-danger bg-surface p-3 text-sm text-danger">
          {failed.error}
        </p>
      ) : null}
      <Field id={messageId} label="เล่าปัญหาที่พบ" hint={`ไม่เกิน ${REPORT_MESSAGE_MAX.toLocaleString("th-TH")} ตัวอักษร`} error={failed?.fieldError} className="mb-4">
        <textarea
          id={messageId}
          name="message"
          rows={6}
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          aria-invalid={failed?.fieldError ? true : undefined}
          className={`${inputClass} min-h-32`}
          placeholder="เช่น กดส่งผลแล้วขึ้นข้อความผิดพลาด"
        />
      </Field>
      {pageUrl ? (
        <div className="mb-4 text-sm">
          <p className="text-muted">หน้าที่พบปัญหา</p>
          <p data-testid="report-page-url" className="font-mono break-all text-ink">
            {pageUrl}
          </p>
          <input type="hidden" name="pageUrl" value={pageUrl} />
        </div>
      ) : null}
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "กำลังส่ง..." : "ส่งเรื่อง"}
      </Button>
    </form>
  );
}
