"use client";

import { useId, useRef, useState } from "react";
import { changeEmail, type AccountFieldErrors } from "@/app/actions/profile";
import { Button, Card, inputClass, PasswordInput } from "@/components/ui";
import { GENERIC_ERROR_TH } from "@/lib/errors";

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="mt-1 text-sm text-danger">
      {message}
    </p>
  ) : null;
}

/** Change the sign-in email: needs the current password, then confirm links go to the old and new address. */
export function EmailForm({ currentEmail }: { currentEmail: string }) {
  const uid = useId();
  const emailId = `${uid}-newEmail`;
  const passwordId = `${uid}-currentPassword`;
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
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
      const result = await changeEmail({ newEmail, currentPassword });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        if (result.error) setError(result.error);
        return;
      }
      setNewEmail("");
      setCurrentPassword("");
      setMessage(result.message);
    } catch {
      setError(GENERIC_ERROR_TH);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <Card as="section" aria-labelledby="profile-email" className="mt-6">
      <h2 id="profile-email" className="mb-3 font-display text-lg font-semibold">
        อีเมล
      </h2>
      <p className="mb-4 text-sm break-all">
        อีเมลปัจจุบัน: <strong>{currentEmail}</strong>
      </p>
      <form onSubmit={onSubmit} noValidate>
        {error ? (
          <div role="alert" className="mb-4 rounded-input border border-danger bg-surface p-3 text-sm text-danger">
            {error}
          </div>
        ) : null}
        <div className="mb-4">
          <label htmlFor={emailId} className="mb-1 block text-sm font-medium">
            อีเมลใหม่
          </label>
          <input
            id={emailId}
            name="newEmail"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            autoComplete="email"
            aria-invalid={fieldErrors.newEmail ? true : undefined}
            aria-describedby={fieldErrors.newEmail ? `${emailId}-error` : undefined}
            className={inputClass}
          />
          <FieldError id={`${emailId}-error`} message={fieldErrors.newEmail} />
        </div>
        <div className="mb-4">
          <label htmlFor={passwordId} className="mb-1 block text-sm font-medium">
            รหัสผ่านปัจจุบัน
          </label>
          <PasswordInput
            id={passwordId}
            name="currentPassword"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            aria-invalid={fieldErrors.currentPassword ? true : undefined}
            aria-describedby={fieldErrors.currentPassword ? `${passwordId}-error` : undefined}
          />
          <FieldError id={`${passwordId}-error`} message={fieldErrors.currentPassword} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "กำลังบันทึก..." : "เปลี่ยนอีเมล"}
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
