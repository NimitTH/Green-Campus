// DESIGN-4 6.2: input rules of the student account commands. The database checks the same limits again
// (staff_suspend_student: p_days null or 1..365, reason 1..500 after trimming); these give early Thai messages.

export const SUSPEND_DURATIONS = ["1", "3", "7", "30", "custom", "forever"] as const;
export type SuspendDuration = (typeof SUSPEND_DURATIONS)[number];
export type SuspendInput = { duration: SuspendDuration; customDays: string; reason: string };
export type SuspendFieldErrors = Partial<Record<keyof SuspendInput, string>>;
export type SuspendResult = { ok: true; days: number | null; reason: string } | { ok: false; fieldErrors: SuspendFieldErrors };

export const SUSPEND_DAYS_MAX = 365;
export const SUSPEND_REASON_MAX = 500;

const DURATION_REQUIRED = "เลือกระยะเวลาที่ระงับ";
const DAYS_INVALID = `กรอกจำนวนวันเป็นเลขจำนวนเต็ม 1–${SUSPEND_DAYS_MAX}`;
const REASON_REQUIRED = "กรอกเหตุผลที่ระงับ";
const REASON_TOO_LONG = `เหตุผลยาวเกิน ${SUSPEND_REASON_MAX} ตัวอักษร กรุณาเขียนให้สั้นลง`;

export function isSuspendInput(value: unknown): value is SuspendInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return typeof v.duration === "string" && typeof v.customDays === "string" && typeof v.reason === "string";
}

function isDuration(value: string): value is SuspendDuration {
  return (SUSPEND_DURATIONS as readonly string[]).includes(value);
}

export function validateSuspend(input: SuspendInput): SuspendResult {
  const fieldErrors: SuspendFieldErrors = {};
  let days: number | null = null;

  if (!isDuration(input.duration)) {
    fieldErrors.duration = DURATION_REQUIRED;
  } else if (input.duration === "custom") {
    const raw = input.customDays.trim();
    const n = /^\d{1,3}$/.test(raw) ? Number(raw) : NaN;
    if (!Number.isInteger(n) || n < 1 || n > SUSPEND_DAYS_MAX) fieldErrors.customDays = DAYS_INVALID;
    else days = n;
  } else if (input.duration !== "forever") {
    days = Number(input.duration);
  }

  const reason = input.reason.trim();
  if (!reason) fieldErrors.reason = REASON_REQUIRED;
  else if (Array.from(reason).length > SUSPEND_REASON_MAX) fieldErrors.reason = REASON_TOO_LONG;

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return { ok: true, days, reason };
}

/** The Auth ban that mirrors a suspension (DESIGN-4 6.2): "{days*24}h", about 100 years until lifted. */
export function banDurationFor(days: number | null): string {
  return days === null ? "876000h" : `${days * 24}h`;
}

/** The delete confirmation: the typed text, trimmed, must equal the student's full name exactly. */
export function confirmNameMatches(typed: string, fullName: string): boolean {
  const t = typed.trim();
  return t.length > 0 && t === fullName;
}
