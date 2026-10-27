"use client";

import { useRouter } from "next/navigation";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { adjustStudentLedger } from "@/app/actions/admin";
import { Button, Field, inputClass } from "@/components/ui";
import type { AdjustFieldErrors, AdjustInput } from "@/lib/admin/validation";
import { GENERIC_ERROR_TH } from "@/lib/errors";

const EMPTY: AdjustInput = { points: "", carbonKg: "", note: "" };

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="text-sm text-danger">
      {message}
    </p>
  ) : null;
}

/** "ปรับแต้ม" (R119): signed points and carbon with a required reason, through adjust_ledger. */
export function AdjustForm({ studentId }: { studentId: string }) {
  const router = useRouter();
  const [values, setValues] = useState<AdjustInput>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<AdjustFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  // unique per instance: another student's page can stay alive (hidden <Activity>) next to this one
  const uid = useId();
  const f = (name: string) => `${uid}-${name}`;
  // The success banner belongs to this visit: clear it when the page is hidden (navigating away), so
  // coming back never shows a stale "ปรับแต้มเรียบร้อยแล้ว" (Next docs, Preserving UI state).
  useLayoutEffect(() => () => setSaved(false), []);

  function set<K extends keyof AdjustInput>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setFieldErrors({});
    setSaved(false);
    try {
      const result = await adjustStudentLedger(studentId, values);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        if (result.error) setError(result.error);
        return;
      }
      setValues(EMPTY);
      setSaved(true);
      router.refresh();
    } catch {
      setError(GENERIC_ERROR_TH);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-label="ปรับแต้ม" className="space-y-3">
      {error ? (
        <div role="alert" className="rounded-input border border-danger bg-surface p-3 text-sm text-danger">
          {error}
        </div>
      ) : null}
      {saved ? (
        <p role="status" className="rounded-input border border-accent bg-accent-soft p-3 text-sm text-ink">
          ปรับแต้มเรียบร้อยแล้ว นักเรียนได้รับแจ้งเตือน
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id={f("adjust-points")} label="แต้ม (ใส่ลบเพื่อหัก)">
          <input
            id={f("adjust-points")}
            inputMode="numeric"
            placeholder="เช่น 10 หรือ -5"
            value={values.points}
            onChange={(e) => set("points", e.target.value)}
            aria-invalid={fieldErrors.points ? true : undefined}
            aria-describedby={fieldErrors.points ? f("adjust-points-error") : undefined}
            className={inputClass}
          />
          <FieldError id={f("adjust-points-error")} message={fieldErrors.points} />
        </Field>
        <Field id={f("adjust-carbon")} label="carbon (กก. CO2e, ไม่บังคับ)">
          <input
            id={f("adjust-carbon")}
            inputMode="decimal"
            placeholder="เช่น 0.5 หรือ -0.25"
            value={values.carbonKg}
            onChange={(e) => set("carbonKg", e.target.value)}
            aria-invalid={fieldErrors.carbonKg ? true : undefined}
            aria-describedby={fieldErrors.carbonKg ? f("adjust-carbon-error") : undefined}
            className={inputClass}
          />
          <FieldError id={f("adjust-carbon-error")} message={fieldErrors.carbonKg} />
        </Field>
      </div>
      <Field id={f("adjust-note")} label="เหตุผล (นักเรียนจะเห็นข้อความนี้)">
        <textarea
          id={f("adjust-note")}
          rows={2}
          maxLength={500}
          value={values.note}
          onChange={(e) => set("note", e.target.value)}
          aria-invalid={fieldErrors.note ? true : undefined}
          aria-describedby={fieldErrors.note ? f("adjust-note-error") : undefined}
          className={inputClass}
        />
        <FieldError id={f("adjust-note-error")} message={fieldErrors.note} />
      </Field>
      <Button type="submit" variant="primary" disabled={busy} className="w-full sm:w-auto">
        {busy ? "กำลังบันทึก..." : "บันทึกการปรับแต้ม"}
      </Button>
    </form>
  );
}
