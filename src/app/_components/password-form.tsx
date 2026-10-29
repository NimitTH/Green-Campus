"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { changePassword, type AccountFieldErrors } from "@/app/actions/profile";
import { Button, Card, PasswordInput } from "@/components/ui";
import { GENERIC_ERROR_TH } from "@/lib/errors";

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="mt-1 text-sm text-danger">
      {message}
    </p>
  ) : null;
}

/** Change the password: needs the current password; the forgot-password link sits on the label row. */
export function PasswordForm() {
  const uid = useId();
  const currentId = `${uid}-currentPassword`;
  const newId = `${uid}-newPassword`;
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AccountFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setFieldErrors({});
    setMessage(null);
    try {
      const result = await changePassword({ currentPassword, newPassword });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        if (result.error) setError(result.error);
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setMessage(result.message);
    } catch {
      setError(GENERIC_ERROR_TH);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <Card as="section" aria-labelledby="profile-password" className="mt-6">
      <h2 id="profile-password" className="mb-3 font-display text-lg font-semibold">
        รหัสผ่าน
      </h2>
      <form onSubmit={onSubmit} noValidate>
        {error ? (
          <div role="alert" className="mb-4 rounded-input border border-danger bg-surface p-3 text-sm text-danger">
            {error}
          </div>
        ) : null}
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between gap-3">
            <label htmlFor={currentId} className="text-sm font-medium">
              รหัสผ่านปัจจุบัน
            </label>
            <Link href="/forgot-password" className="inline-flex min-h-11 items-center text-sm text-accent underline underline-offset-4">
              ลืมรหัสผ่าน?
            </Link>
          </div>
          <PasswordInput
            id={currentId}
            name="currentPassword"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            aria-invalid={fieldErrors.currentPassword ? true : undefined}
            aria-describedby={fieldErrors.currentPassword ? `${currentId}-error` : undefined}
          />
          <FieldError id={`${currentId}-error`} message={fieldErrors.currentPassword} />
        </div>
        <div className="mb-4">
          <label htmlFor={newId} className="mb-1 block text-sm font-medium">
            รหัสผ่านใหม่
          </label>
          <PasswordInput
            id={newId}
            name="newPassword"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            aria-invalid={fieldErrors.newPassword ? true : undefined}
            aria-describedby={fieldErrors.newPassword ? `${newId}-error` : undefined}
          />
          <FieldError id={`${newId}-error`} message={fieldErrors.newPassword} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "กำลังบันทึก..." : "เปลี่ยนรหัสผ่าน"}
          </Button>
        </div>
        {message ? (
          <p role="status" className="mt-3 text-sm text-accent">
            {message}
          </p>
        ) : null}
      </form>
    </Card>
  );
}
