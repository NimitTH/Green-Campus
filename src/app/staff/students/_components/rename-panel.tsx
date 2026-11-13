"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { renameStudent } from "@/app/actions/accounts";
import { Button, inputClass } from "@/components/ui";
import { GENERIC_ERROR_TH } from "@/lib/errors";
import { NAME_LIMITS, type ProfileFieldErrors } from "@/lib/profile/validation";

/** "แก้ชื่อ" (admin, DESIGN-4 6.2): full name + display name, the /profile rules. */
export function RenamePanel({ studentId, fullName, displayName }: { studentId: string; fullName: string; displayName: string | null }) {
  const router = useRouter();
  const [full, setFull] = useState(fullName);
  const [display, setDisplay] = useState(displayName ?? "");
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const uid = useId();
  const f = (name: string) => `${uid}-${name}`;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setFieldErrors({});
    setSaved(false);
    try {
      const result = await renameStudent(studentId, { fullName: full, displayName: display });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        if (result.error) setError(result.error);
        return;
      }
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
    <form onSubmit={onSubmit} noValidate aria-label="แก้ชื่อ" className="space-y-3">
      {error ? (
        <p role="alert" className="rounded-input border border-danger p-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="rounded-input border border-accent bg-accent-soft p-3 text-sm text-ink">
          บันทึกชื่อแล้ว
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={f("full")} className="text-sm font-medium text-ink">
            ชื่อ-นามสกุลจริง
          </label>
          <input
            id={f("full")}
            value={full}
            maxLength={NAME_LIMITS.fullNameMax}
            onChange={(e) => {
              setFull(e.target.value);
              setSaved(false);
            }}
            aria-invalid={fieldErrors.fullName ? true : undefined}
            aria-describedby={fieldErrors.fullName ? f("full-error") : undefined}
            className={inputClass}
          />
          {fieldErrors.fullName ? (
            <p id={f("full-error")} className="text-sm text-danger">
              {fieldErrors.fullName}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={f("display")} className="text-sm font-medium text-ink">
            ชื่อที่แสดง (ไม่บังคับ)
          </label>
          <input
            id={f("display")}
            value={display}
            maxLength={NAME_LIMITS.displayNameMax}
            onChange={(e) => {
              setDisplay(e.target.value);
              setSaved(false);
            }}
            aria-invalid={fieldErrors.displayName ? true : undefined}
            aria-describedby={fieldErrors.displayName ? f("display-error") : undefined}
            className={inputClass}
          />
          {fieldErrors.displayName ? (
            <p id={f("display-error")} className="text-sm text-danger">
              {fieldErrors.displayName}
            </p>
          ) : null}
        </div>
      </div>
      <Button type="submit" variant="primary" disabled={busy} className="w-full sm:w-auto">
        {busy ? "กำลังบันทึก..." : "บันทึกชื่อ"}
      </Button>
    </form>
  );
}
