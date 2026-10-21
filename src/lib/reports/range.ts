// Date-range handling for the reports page and CSV route (Task 16, R105/R106). Dates are plain
// Bangkok calendar days (YYYY-MM-DD); the database compares them with activities.ends_at in Bangkok time.

export const MAX_RANGE_DAYS = 731;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

function dayNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = DATE_RE.exec(value);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const check = new Date(t);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return Math.round(t / DAY_MS);
}

export type DateRange = { from: string; to: string };
export type RangeResult = ({ ok: true } & DateRange) | { ok: false; message: string };

export function parseDateRange(from: string | null | undefined, to: string | null | undefined): RangeResult {
  const a = dayNumber(from);
  const b = dayNumber(to);
  if (a === null || b === null) return { ok: false, message: "ช่วงวันที่ไม่ถูกต้อง (ต้องเป็นรูปแบบ YYYY-MM-DD)" };
  if (a > b) return { ok: false, message: "วันที่เริ่มต้องไม่อยู่หลังวันที่สิ้นสุด" };
  if (b - a + 1 > MAX_RANGE_DAYS) return { ok: false, message: `เลือกช่วงวันที่ได้ไม่เกิน ${MAX_RANGE_DAYS} วัน` };
  return { ok: true, from: from as string, to: to as string };
}

/** First and last day of the Bangkok calendar month containing `now`. */
export function bangkokMonthRange(now: Date): DateRange {
  const b = new Date(now.getTime() + BANGKOK_OFFSET_MS);
  const y = b.getUTCFullYear();
  const m = b.getUTCMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return { from: `${y}-${pad(m + 1)}-01`, to: `${y}-${pad(m + 1)}-${pad(last)}` };
}
