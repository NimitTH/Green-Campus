"use client";

import { useId, useRef, useState } from "react";
import { deleteStudent } from "@/app/actions/accounts";
import { Button, inputClass } from "@/components/ui";
import { confirmNameMatches } from "@/lib/accounts/validation";
import { GENERIC_ERROR_TH } from "@/lib/errors";
import { Modal } from "./modal";

/**
 * "ลบบัญชี" (admin, DESIGN-4 6.2): "ลบบัญชีถาวร" is enabled only when the typed text (trimmed) equals the student's full
 * name exactly. The server checks the same against the name the database returns. On success the action redirects
 * to /staff/students?deleted=1.
 */
export function DeletePanel({ studentId, fullName }: { studentId: string; fullName: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const uid = useId();
  const titleId = `${uid}-title`;
  const inputId = `${uid}-confirm`;
  const matches = confirmNameMatches(typed, fullName);

  function close() {
    setOpen(false);
    setTyped("");
    setError(null);
  }

  async function confirm() {
    if (busyRef.current || !matches) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await deleteStudent(studentId, typed);
      // success navigates away (server redirect); only a refusal comes back here
      if (result && !result.ok) setError(result.error);
    } catch {
      setError(GENERIC_ERROR_TH);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <Button type="button" variant="danger" onClick={() => setOpen(true)}>
        ลบบัญชี
      </Button>
      <Modal open={open} onClose={close} labelledBy={titleId} busy={busy}>
        <div className="space-y-4">
          <h2 id={titleId} className="font-display text-lg font-semibold break-words">
            ลบบัญชีของ {fullName}?
          </h2>
          <p className="text-sm text-muted">ข้อมูลทั้งหมดของนักเรียนคนนี้จะถูกลบถาวร กู้คืนไม่ได้</p>
          <div className="flex flex-col gap-1">
            <label htmlFor={inputId} className="text-sm font-medium text-ink">
              พิมพ์ชื่อ-นามสกุล <strong className="break-words">{fullName}</strong> เพื่อยืนยัน
            </label>
            <input
              id={inputId}
              value={typed}
              autoComplete="off"
              onChange={(e) => {
                setTyped(e.target.value);
                setError(null);
              }}
              className={inputClass}
            />
          </div>
          {error ? (
            <p role="alert" className="rounded-input border border-danger p-3 text-sm text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="danger" disabled={!matches || busy} onClick={confirm}>
              {busy ? "กำลังลบ..." : "ลบบัญชีถาวร"}
            </Button>
            <Button type="button" variant="card" disabled={busy} onClick={close}>
              ยกเลิก
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
