"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { changeUserRole } from "@/app/actions/admin";
import { Button, inputClass } from "@/components/ui";
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
  // unique per instance: the same user's row can be alive on the list and on the detail page (hidden <Activity>)
  const uid = useId();
  const selectId = `${uid}-role`;

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
        <div className="shrink-0">
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
            className={inputClass}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL_TH[r]}
              </option>
            ))}
          </select>
        </div>
        {confirming ? null : (
          <Button type="button" variant="primary" disabled={pending || selected === role} onClick={() => setConfirming(true)}>
            บันทึก
          </Button>
        )}
      </div>
      {confirming ? (
        <div role="group" aria-label={`ยืนยันเปลี่ยนบทบาทของ ${name}`} className="rounded-input border border-warn bg-surface p-3">
          <p className="mb-2 text-sm text-ink">
            เปลี่ยน {name} จาก {ROLE_LABEL_TH[role]} เป็น {ROLE_LABEL_TH[selected]}?
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="primary" disabled={pending} onClick={save}>
              {pending ? "กำลังบันทึก..." : "ยืนยันเปลี่ยนบทบาท"}
            </Button>
            <Button type="button" variant="card" disabled={pending} onClick={() => setConfirming(false)}>
              ไม่เปลี่ยน
            </Button>
          </div>
        </div>
      ) : null}
      {saved && !error ? (
        <p role="status" className="text-sm text-accent">
          บันทึกบทบาทแล้ว
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
