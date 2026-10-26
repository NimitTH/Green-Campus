"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { updateProfile } from "@/app/actions/profile";
import { Button, Card, inputClass } from "@/components/ui";
import { GENERIC_ERROR_TH } from "@/lib/errors";
import { NAME_LIMITS, normalizeName, previewDisplayName, type ProfileFieldErrors, type ProfileInput } from "@/lib/profile/validation";

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="mt-1 text-sm text-danger">
      {message}
    </p>
  ) : null;
}

/** Edit full_name and display_name, with a live preview of the leaderboard name (R123). */
export function ProfileForm({ initial }: { initial: ProfileInput }) {
  const router = useRouter();
  const uid = useId();
  const fullNameId = `${uid}-fullName`;
  const displayNameId = `${uid}-displayName`;
  const [values, setValues] = useState<ProfileInput>(initial);
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  function set(key: keyof ProfileInput, value: string) {
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
      const result = await updateProfile(values);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        if (result.error) setError(result.error);
        return;
      }
      setValues({ fullName: normalizeName(values.fullName), displayName: normalizeName(values.displayName) });
      setSaved(true);
      router.refresh();
    } catch {
      setError(GENERIC_ERROR_TH);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const preview = previewDisplayName(normalizeName(values.displayName), normalizeName(values.fullName));

  return (
    <Card as="section">
    <form onSubmit={onSubmit} noValidate>
      {error ? (
        <div role="alert" className="mb-4 rounded-input border border-danger bg-surface p-3 text-sm text-danger">
          {error}
        </div>
      ) : null}
      <div className="mb-4">
        <label htmlFor={fullNameId} className="mb-1 block text-sm font-medium">
          ชื่อ-นามสกุลจริง
        </label>
        <input
          id={fullNameId}
          value={values.fullName}
          onChange={(e) => set("fullName", e.target.value)}
          autoComplete="name"
          aria-invalid={fieldErrors.fullName ? true : undefined}
          aria-describedby={fieldErrors.fullName ? `${fullNameId}-error ${fullNameId}-hint` : `${fullNameId}-hint`}
          className={inputClass}
        />
        <p id={`${fullNameId}-hint`} className="mt-1 text-sm text-muted">
          ไม่เกิน {NAME_LIMITS.fullNameMax} ตัวอักษร ครูใช้ชื่อนี้ตรวจผลและส่งของ
        </p>
        <FieldError id={`${fullNameId}-error`} message={fieldErrors.fullName} />
      </div>
      <div className="mb-4">
        <label htmlFor={displayNameId} className="mb-1 block text-sm font-medium">
          ชื่อที่แสดง (ไม่บังคับ)
        </label>
        <input
          id={displayNameId}
          value={values.displayName}
          onChange={(e) => set("displayName", e.target.value)}
          aria-invalid={fieldErrors.displayName ? true : undefined}
          aria-describedby={fieldErrors.displayName ? `${displayNameId}-error ${displayNameId}-hint` : `${displayNameId}-hint`}
          className={inputClass}
        />
        <p id={`${displayNameId}-hint`} className="mt-1 text-sm text-muted">
          ไม่เกิน {NAME_LIMITS.displayNameMax} ตัวอักษร เว้นว่างเพื่อใช้ชื่อจริง
        </p>
        <FieldError id={`${displayNameId}-error`} message={fieldErrors.displayName} />
      </div>
      <p className="mb-4 rounded-input bg-accent-soft p-3 text-sm">
        ชื่อในหน้าอันดับ: <strong data-testid="profile-preview" className="break-words">{preview}</strong>
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "กำลังบันทึก..." : "บันทึกโปรไฟล์"}
        </Button>
        {saved ? (
          <p role="status" className="text-sm text-accent">
            บันทึกแล้ว
          </p>
        ) : null}
      </div>
    </form>
    </Card>
  );
}
