"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { adjustStudentLedger } from "@/app/actions/admin";
import type { AdjustFieldErrors, AdjustInput } from "@/lib/admin/validation";
import { GENERIC_ERROR_TH } from "@/lib/errors";

const EMPTY: AdjustInput = { points: "", carbonKg: "", note: "" };

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/30 aria-[invalid=true]:border-red-500 dark:border-gray-700 dark:bg-gray-900";

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="mt-1 text-sm text-red-600">
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
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      ) : null}
      {saved ? (
        <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
          ปรับแต้มเรียบร้อยแล้ว นักเรียนได้รับแจ้งเตือน
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="adjust-points" className="mb-1 block text-sm font-medium">
            แต้ม (ใส่ลบเพื่อหัก)
          </label>
          <input
            id="adjust-points"
            inputMode="numeric"
            placeholder="เช่น 10 หรือ -5"
            value={values.points}
            onChange={(e) => set("points", e.target.value)}
            aria-invalid={fieldErrors.points ? true : undefined}
            aria-describedby={fieldErrors.points ? "adjust-points-error" : undefined}
            className={inputClass}
          />
          <FieldError id="adjust-points-error" message={fieldErrors.points} />
        </div>
        <div>
          <label htmlFor="adjust-carbon" className="mb-1 block text-sm font-medium">
            carbon (กก. CO2e, ไม่บังคับ)
          </label>
          <input
            id="adjust-carbon"
            inputMode="decimal"
            placeholder="เช่น 0.5 หรือ -0.25"
            value={values.carbonKg}
            onChange={(e) => set("carbonKg", e.target.value)}
            aria-invalid={fieldErrors.carbonKg ? true : undefined}
            aria-describedby={fieldErrors.carbonKg ? "adjust-carbon-error" : undefined}
            className={inputClass}
          />
          <FieldError id="adjust-carbon-error" message={fieldErrors.carbonKg} />
        </div>
      </div>
      <div>
        <label htmlFor="adjust-note" className="mb-1 block text-sm font-medium">
          เหตุผล (นักเรียนจะเห็นข้อความนี้)
        </label>
        <textarea
          id="adjust-note"
          rows={2}
          maxLength={500}
          value={values.note}
          onChange={(e) => set("note", e.target.value)}
          aria-invalid={fieldErrors.note ? true : undefined}
          aria-describedby={fieldErrors.note ? "adjust-note-error" : undefined}
          className={inputClass}
        />
        <FieldError id="adjust-note-error" message={fieldErrors.note} />
      </div>
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-green-700 px-4 py-3 text-base font-semibold text-white hover:bg-green-800 disabled:opacity-60 sm:w-auto"
      >
        {busy ? "กำลังบันทึก..." : "บันทึกการปรับแต้ม"}
      </button>
    </form>
  );
}
