import { EmptyState, Mono } from "@/components/ui";
import type { AccountEvent, AccountEventAction } from "@/lib/accounts/queries";
import { formatBangkok } from "@/lib/datetime";

const ACTION_LABEL_TH: Record<AccountEventAction, string> = {
  password_reset: "รีเซ็ตรหัสผ่าน",
  suspend: "ระงับ",
  unsuspend: "ยกเลิกระงับ",
  rename: "แก้ชื่อ",
  delete: "ลบบัญชี",
};

/** "ประวัติการจัดการบัญชี" (DESIGN-4 6.1): date, who, command, reason / detail (the database's Thai text, as-is). */
export function AccountEvents({ events }: { events: AccountEvent[] }) {
  if (events.length === 0) return <EmptyState className="text-sm">ยังไม่มีประวัติการจัดการบัญชี</EmptyState>;
  return (
    <ul className="divide-y divide-rule rounded-card border border-rule bg-surface shadow-sheet">
      {events.map((e) => (
        <li key={e.id} data-testid="account-event" data-action={e.action} className="p-3 text-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <span className="font-medium">{ACTION_LABEL_TH[e.action] ?? e.action}</span>
            <span className="text-xs text-muted">
              <Mono text={formatBangkok(e.createdAt)} />
            </span>
          </div>
          <p className="mt-0.5 break-words text-muted">โดย {e.actorName}</p>
          {e.detail ? <p className="mt-0.5 break-words text-ink">{e.detail}</p> : null}
        </li>
      ))}
    </ul>
  );
}
