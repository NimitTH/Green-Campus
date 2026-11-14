"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { suspendStudent, unsuspendStudent } from "@/app/actions/accounts";
import { Button, inputClass } from "@/components/ui";
import {
  SUSPEND_DAYS_MAX,
  SUSPEND_REASON_MAX,
  needsUnsuspendRetry,
  showUnsuspendButton,
  type SuspendDuration,
  type SuspendFieldErrors,
} from "@/lib/accounts/validation";
import { GENERIC_ERROR_TH } from "@/lib/errors";

const DURATIONS: { value: SuspendDuration; label: string }[] = [
  { value: "1", label: "1 วัน" },
  { value: "3", label: "3 วัน" },
  { value: "7", label: "7 วัน" },
  { value: "30", label: "30 วัน" },
  { value: "custom", label: "กำหนดเอง" },
  { value: "forever", label: "จนกว่าจะปลด" },
];

/**
 * "ระงับบัญชี" (DESIGN-4 6.2): duration + required reason. A student who is already suspended can get a new period /
 * reason (recorded again) or "ยกเลิกระงับ". The database decides; a failed Auth step shows the retry message. After a
 * failed Auth step on unsuspend the page already reads "ปกติ", so the button stays until a retry succeeds (review I1).
 */
export function SuspendPanel({ studentId, suspended }: { studentId: string; suspended: boolean }) {
  const router = useRouter();
  const [duration, setDuration] = useState<SuspendDuration>("1");
  const [customDays, setCustomDays] = useState("");
  const [reason, setReason] = useState("");
  const [fieldErrors, setFieldErrors] = useState<SuspendFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [retryUnsuspend, setRetryUnsuspend] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const uid = useId();
  const f = (name: string) => `${uid}-${name}`;

  async function run(
    command: () => Promise<{ ok: true } | { ok: false; error?: string; fieldErrors?: SuspendFieldErrors; retry?: boolean }>,
    success: string,
    isUnsuspend = false,
  ) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setDone(null);
    setFieldErrors({});
    try {
      const result = await command();
      // any suspend replaces the pending retry; an unsuspend keeps it only when its Auth step failed
      setRetryUnsuspend(isUnsuspend && needsUnsuspendRetry(result));
      if (result.ok) {
        setDone(success);
        setReason("");
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        if (result.error) setError(result.error);
      }
      // the database step may have counted even when the Auth step failed: show the current status
      router.refresh();
    } catch {
      setError(GENERIC_ERROR_TH);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(() => suspendStudent(studentId, { duration, customDays, reason }), "ระงับบัญชีแล้ว");
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p role="alert" className="rounded-input border border-danger p-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {done ? (
        <p role="status" className="rounded-input border border-accent bg-accent-soft p-3 text-sm text-ink">
          {done}
        </p>
      ) : null}
      {showUnsuspendButton(suspended, retryUnsuspend) ? (
        <Button type="button" variant="primary" disabled={busy} onClick={() => void run(() => unsuspendStudent(studentId), "ยกเลิกระงับแล้ว", true)}>
          ยกเลิกระงับ
        </Button>
      ) : null}
      <form onSubmit={onSubmit} noValidate aria-label="ระงับบัญชี" className="space-y-3">
        <fieldset aria-describedby={fieldErrors.duration ? f("duration-error") : undefined}>
          <legend className="mb-1 text-sm font-medium text-ink">ระยะเวลา</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {DURATIONS.map((d) => (
              <label key={d.value} className="inline-flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={f("duration")}
                  value={d.value}
                  checked={duration === d.value}
                  onChange={() => setDuration(d.value)}
                  className="size-4 accent-accent"
                />
                {d.label}
              </label>
            ))}
          </div>
          {fieldErrors.duration ? (
            <p id={f("duration-error")} className="text-sm text-danger">
              {fieldErrors.duration}
            </p>
          ) : null}
        </fieldset>
        {duration === "custom" ? (
          <div className="flex flex-col gap-1">
            <label htmlFor={f("days")} className="text-sm font-medium text-ink">
              จำนวนวัน (1–{SUSPEND_DAYS_MAX})
            </label>
            <input
              id={f("days")}
              inputMode="numeric"
              value={customDays}
              onChange={(e) => setCustomDays(e.target.value)}
              aria-invalid={fieldErrors.customDays ? true : undefined}
              aria-describedby={fieldErrors.customDays ? f("days-error") : undefined}
              className={`${inputClass} sm:w-40`}
            />
            {fieldErrors.customDays ? (
              <p id={f("days-error")} className="text-sm text-danger">
                {fieldErrors.customDays}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-col gap-1">
          <label htmlFor={f("reason")} className="text-sm font-medium text-ink">
            เหตุผลที่ระงับ
          </label>
          <textarea
            id={f("reason")}
            rows={2}
            maxLength={SUSPEND_REASON_MAX}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-invalid={fieldErrors.reason ? true : undefined}
            aria-describedby={fieldErrors.reason ? f("reason-error") : undefined}
            className={inputClass}
          />
          {fieldErrors.reason ? (
            <p id={f("reason-error")} className="text-sm text-danger">
              {fieldErrors.reason}
            </p>
          ) : null}
        </div>
        <Button type="submit" variant={suspended ? "card" : "danger"} disabled={busy} className="w-full sm:w-auto">
          {busy ? "กำลังบันทึก..." : suspended ? "บันทึกการระงับใหม่" : "ระงับบัญชี"}
        </Button>
      </form>
    </div>
  );
}
