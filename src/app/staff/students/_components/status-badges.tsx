import { Badge } from "@/components/ui";
import { isSuspendedAt } from "@/lib/auth/dal";
import { formatBangkok } from "@/lib/datetime";

// DESIGN-4 6.1: the account status badges of a student row / header. A suspension counts only while it is in force
// (isSuspendedAt, review M8): an expired one keeps its old suspended_until and must not show "ถูกระงับถึง <past>".
export function StatusBadges({
  suspendedUntil,
  mustChangePassword,
  isDemo,
  now,
}: {
  suspendedUntil: string | null;
  mustChangePassword: boolean;
  isDemo: boolean;
  now: Date;
}) {
  const suspended = suspensionText(suspendedUntil, now);
  if (!suspended && !mustChangePassword && !isDemo) return null;
  return (
    <span className="flex flex-wrap gap-2" data-testid="student-status">
      {suspended ? <Badge tone="red">{suspended}</Badge> : null}
      {mustChangePassword ? <Badge tone="amber">ต้องเปลี่ยนรหัสผ่าน</Badge> : null}
      {isDemo ? <Badge tone="amber">บัญชีสาธิต</Badge> : null}
    </span>
  );
}

/** "ถูกระงับถึง …" / "ระงับจนกว่าจะปลด" text, or null when not suspended at `now`. */
export function suspensionText(suspendedUntil: string | null, now: Date): string | null {
  if (!isSuspendedAt(suspendedUntil, now)) return null;
  return suspendedUntil === "infinity" ? "ระงับจนกว่าจะปลด" : `ถูกระงับถึง ${formatBangkok(suspendedUntil ?? "")}`;
}
