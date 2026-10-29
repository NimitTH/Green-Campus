"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}
const readHash = () => window.location.hash;
const serverHash = () => null;

const statusClass = "mb-6 rounded-input border border-rule-strong bg-accent-soft p-3 text-sm";

/**
 * The result of an email-change link (?email=changed | pending | link-error). GoTrue reports the first of
 * the two confirmations in the URL fragment (#message=...), which only the browser can see, so a
 * link-error is shown only after checking the fragment: a message with no error means "pending".
 */
export function EmailNotice({ value }: { value?: string }) {
  const hash = useSyncExternalStore(subscribe, readHash, serverHash);
  let kind = value;
  if (value === "link-error") {
    if (hash === null) return null; // server render: wait for the fragment before showing an error
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    if (params.get("message") && !params.has("error") && !params.has("error_code")) kind = "pending";
  }

  if (kind === "changed") {
    return (
      <p role="status" className={statusClass}>
        เปลี่ยนอีเมลแล้ว
      </p>
    );
  }
  if (kind === "pending") {
    return (
      <p role="status" className={statusClass}>
        ยืนยันอีเมลหนึ่งฉบับแล้ว กรุณากดลิงก์ยืนยันในอีเมลอีกฉบับเพื่อเปลี่ยนอีเมลให้เสร็จ
      </p>
    );
  }
  if (kind === "link-error") {
    return (
      <p role="alert" className="mb-6 rounded-input border border-danger bg-surface p-3 text-sm text-danger">
        ลิงก์ยืนยันใช้ไม่ได้หรือหมดอายุ ลองขอใหม่อีกครั้ง
      </p>
    );
  }
  return null;
}
