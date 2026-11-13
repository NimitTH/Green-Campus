"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { resetStudentPassword } from "@/app/actions/accounts";
import { Button, CopyLinkButton } from "@/components/ui";
import { GENERIC_ERROR_TH } from "@/lib/errors";
import { Modal } from "./modal";

/**
 * "รีเซ็ตรหัสผ่าน" (DESIGN-4 6.2): confirm, then show the temporary password ONCE in the same dialog. The password lives
 * only in this component's state while the dialog is open; closing the dialog forgets it.
 */
export function ResetPasswordPanel({ studentId, name }: { studentId: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const titleId = useId();

  function close() {
    setOpen(false);
    setPassword(null);
    setError(null);
  }

  async function confirm() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await resetStudentPassword(studentId);
      if (result.ok) setPassword(result.password);
      else setError(result.error);
      router.refresh();
    } catch {
      setError(GENERIC_ERROR_TH);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <Button type="button" variant="card" onClick={() => setOpen(true)}>
        รีเซ็ตรหัสผ่าน
      </Button>
      <Modal open={open} onClose={close} labelledBy={titleId}>
        {password ? (
          <div className="space-y-4">
            <h2 id={titleId} className="font-display text-lg font-semibold">
              รหัสผ่านชั่วคราว
            </h2>
            <p data-testid="temp-password" className="rounded-input bg-paper-2 p-3 text-center font-mono text-3xl tracking-wider break-all select-all">
              {password}
            </p>
            <CopyLinkButton text={password} label="คัดลอกรหัสผ่าน" />
            <p className="text-sm text-ink">ให้รหัสนี้กับนักเรียน รหัสจะแสดงครั้งเดียว นักเรียนต้องตั้งรหัสใหม่หลังเข้าสู่ระบบ</p>
            <Button type="button" variant="primary" onClick={close} className="w-full sm:w-auto">
              เสร็จแล้ว
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 id={titleId} className="font-display text-lg font-semibold break-words">
              รีเซ็ตรหัสผ่านของ {name}?
            </h2>
            <p className="text-sm text-muted">ระบบจะตั้งรหัสผ่านชั่วคราวใหม่ รหัสเดิมจะใช้ไม่ได้ และนักเรียนต้องตั้งรหัสใหม่หลังเข้าสู่ระบบ</p>
            {error ? (
              <p role="alert" className="rounded-input border border-danger p-3 text-sm text-danger">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="primary" disabled={busy} onClick={confirm}>
                {busy ? "กำลังบันทึก..." : "ยืนยันรีเซ็ตรหัสผ่าน"}
              </Button>
              <Button type="button" variant="card" disabled={busy} onClick={close}>
                ยกเลิก
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
