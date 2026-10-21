"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { updateProfile } from "@/app/actions/profile";
import { GENERIC_ERROR_TH } from "@/lib/errors";
import { NAME_LIMITS, normalizeName, previewDisplayName, type ProfileFieldErrors, type ProfileInput } from "@/lib/profile/validation";

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-base outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/30 aria-[invalid=true]:border-red-500 dark:border-gray-700 dark:bg-gray-900";

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="mt-1 text-sm text-red-600">
      {message}
    </p>
  ) : null;
}

/** Edit full_name and display_name, with a live preview of the leaderboard name (R123). */
export function ProfileForm({ initial }: { initial: ProfileInput }) {
  const router = useRouter();
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
    <form onSubmit={onSubmit} noValidate className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
      {error ? (
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      ) : null}
      <div className="mb-4">
        <label htmlFor="fullName" className="mb-1 block text-sm font-medium">
          ชื่อ-นามสกุลจริง
        </label>
        <input
          id="fullName"
          value={values.fullName}
          onChange={(e) => set("fullName", e.target.value)}
          autoComplete="name"
          aria-invalid={fieldErrors.fullName ? true : undefined}
          aria-describedby={fieldErrors.fullName ? "fullName-error fullName-hint" : "fullName-hint"}
          className={inputClass}
        />
        <p id="fullName-hint" className="mt-1 text-xs text-gray-500">
          ไม่เกิน {NAME_LIMITS.fullNameMax} ตัวอักษร ครูใช้ชื่อนี้ตรวจผลและส่งของ
        </p>
        <FieldError id="fullName-error" message={fieldErrors.fullName} />
      </div>
      <div className="mb-4">
        <label htmlFor="displayName" className="mb-1 block text-sm font-medium">
          ชื่อที่แสดง (ไม่บังคับ)
        </label>
        <input
          id="displayName"
          value={values.displayName}
          onChange={(e) => set("displayName", e.target.value)}
          aria-invalid={fieldErrors.displayName ? true : undefined}
          aria-describedby={fieldErrors.displayName ? "displayName-error displayName-hint" : "displayName-hint"}
          className={inputClass}
        />
        <p id="displayName-hint" className="mt-1 text-xs text-gray-500">
          ไม่เกิน {NAME_LIMITS.displayNameMax} ตัวอักษร เว้นว่างเพื่อใช้ชื่อจริง
        </p>
        <FieldError id="displayName-error" message={fieldErrors.displayName} />
      </div>
      <p className="mb-4 rounded-lg bg-green-50 p-3 text-sm dark:bg-green-950">
        ชื่อในหน้าอันดับ: <strong data-testid="profile-preview" className="break-words">{preview}</strong>
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-green-700 px-4 py-3 text-base font-semibold text-white hover:bg-green-800 disabled:opacity-60"
        >
          {busy ? "กำลังบันทึก..." : "บันทึกโปรไฟล์"}
        </button>
        {saved ? (
          <p role="status" className="text-sm text-green-800 dark:text-green-300">
            บันทึกแล้ว
          </p>
        ) : null}
      </div>
    </form>
  );
}
