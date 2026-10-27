"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { saveRate } from "@/app/actions/admin";
import { Button, Card, Field, inputClass } from "@/components/ui";
import type { RateFieldErrors, RateInput } from "@/lib/admin/validation";
import { GENERIC_ERROR_TH } from "@/lib/errors";

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="text-sm text-danger">
      {message}
    </p>
  ) : null;
}

/**
 * One waste category card. The form inside is keyed by updated_at, so after a save it remounts with the
 * new values and version. The "บันทึกแล้ว" message lives here, outside that key, so it survives the
 * remount (R126.4); it clears when the admin edits again.
 */
export function RateCard(props: { id: string; code: string; initial: RateInput; updatedAt: string }) {
  const [saved, setSaved] = useState(false);
  return (
    <Card data-testid={`rate-${props.code}`}>
      {saved ? (
        <p
          role="status"
          data-testid={`rate-${props.code}-saved`}
          className="mb-3 rounded-input bg-accent-soft p-2 text-sm text-ink"
        >
          บันทึกแล้ว
        </p>
      ) : null}
      <RateForm key={props.updatedAt} {...props} onSaved={() => setSaved(true)} onEdit={() => setSaved(false)} />
    </Card>
  );
}

/**
 * One waste category (R120). The form keeps the updated_at it was loaded with; the save only writes
 * while the row still has it, so two admins never overwrite each other silently.
 */
function RateForm({
  id,
  initial,
  updatedAt,
  onSaved,
  onEdit,
}: {
  id: string;
  code?: string;
  initial: RateInput;
  updatedAt: string;
  onSaved: () => void;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<RateInput>(initial);
  const [fieldErrors, setFieldErrors] = useState<RateFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  // unique per instance (DESIGN 1.3): was a fixed `rate-${code}-${name}`
  const uid = useId();
  const f = (name: keyof RateInput) => `${uid}-${name}`;

  function set<K extends keyof RateInput>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    onEdit();
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setFieldErrors({});
    onEdit();
    try {
      const result = await saveRate({ ...values, id, loadedUpdatedAt: updatedAt });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        if (result.error) setError(result.error);
        return;
      }
      onSaved();
      router.refresh();
    } catch {
      setError(GENERIC_ERROR_TH);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const fields: { key: keyof RateInput; label: string; inputMode?: "numeric" | "decimal" }[] = [
    { key: "name", label: "ชื่อกลุ่ม" },
    { key: "pointsPerKg", label: "แต้มต่อกิโลกรัม", inputMode: "numeric" },
    { key: "carbonKgPerKg", label: "carbon ต่อกิโลกรัม (กก. CO2e)", inputMode: "decimal" },
  ];

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-label={`อัตรา ${initial.name}`}
    >
      <input type="hidden" name="loadedUpdatedAt" value={updatedAt} />
      {error ? (
        <div role="alert" className="mb-3 rounded-input border border-danger bg-surface p-3 text-sm text-danger">
          {error}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        {fields.map(({ key, label, inputMode }) => (
          <Field key={key} id={f(key)} label={label}>
            <input
              id={f(key)}
              inputMode={inputMode}
              value={values[key]}
              onChange={(e) => set(key, e.target.value)}
              aria-invalid={fieldErrors[key] ? true : undefined}
              aria-describedby={fieldErrors[key] ? `${f(key)}-error` : undefined}
              className={inputClass}
            />
            <FieldError id={`${f(key)}-error`} message={fieldErrors[key]} />
          </Field>
        ))}
      </div>
      <Field id={f("sourceNote")} label="ที่มาของค่า carbon" className="mt-3">
        <textarea
          id={f("sourceNote")}
          rows={2}
          value={values.sourceNote}
          onChange={(e) => set("sourceNote", e.target.value)}
          aria-invalid={fieldErrors.sourceNote ? true : undefined}
          aria-describedby={fieldErrors.sourceNote ? `${f("sourceNote")}-error` : undefined}
          className={inputClass}
        />
        <FieldError id={`${f("sourceNote")}-error`} message={fieldErrors.sourceNote} />
      </Field>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "กำลังบันทึก..." : "บันทึกอัตรา"}
        </Button>
      </div>
    </form>
  );
}
