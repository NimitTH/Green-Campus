"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { changeUserRole } from "@/app/actions/admin";
import { ROLE_LABEL_TH } from "@/lib/admin/validation";
import type { Role } from "@/lib/auth/routes";

const ROLES: Role[] = ["student", "teacher", "admin"];

/** Role select + "บันทึก" with a confirm step (R119). The database applies the last-admin and demo rules. */
export function RoleForm({ userId, name, role }: { userId: string; name: string; role: Role }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Role>(role);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const running = useRef(false);
  const selectId = `role-${userId}`;

  function save() {
    if (running.current) return;
    running.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const result = await changeUserRole(userId, selected);
        if (!result.ok) {
          setError(result.error);
        } else {
          setSaved(true);
          router.refresh();
        }
        setConfirming(false);
      } finally {
        running.current = false;
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={selectId} className="sr-only">
          บทบาทของ {name}
        </label>
        <select
          id={selectId}
          value={selected}
          disabled={pending}
          onChange={(e) => {
            setSelected(e.target.value as Role);
            setConfirming(false);
            setSaved(false);
            setError(null);
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL_TH[r]}
            </option>
          ))}
        </select>
        {confirming ? null : (
          <button
            type="button"
            disabled={pending || selected === role}
            onClick={() => setConfirming(true)}
            className="rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50"
          >
            บันทึก
          </button>
        )}
      </div>
      {confirming ? (
        <div role="group" aria-label={`ยืนยันเปลี่ยนบทบาทของ ${name}`} className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
          <p className="mb-2 text-sm text-amber-900 dark:text-amber-100">
            เปลี่ยน {name} จาก {ROLE_LABEL_TH[role]} เป็น {ROLE_LABEL_TH[selected]}?
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={save}
              className="rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-60"
            >
              {pending ? "กำลังบันทึก..." : "ยืนยันเปลี่ยนบทบาท"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(false)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700"
            >
              ไม่เปลี่ยน
            </button>
          </div>
        </div>
      ) : null}
      {saved && !error ? (
        <p role="status" className="text-sm text-green-800 dark:text-green-300">
          บันทึกบทบาทแล้ว
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
