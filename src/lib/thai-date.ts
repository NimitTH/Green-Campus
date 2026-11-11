// Thai dates for inputs and CSV: dd/mm/BE text (Buddhist era = Gregorian + 543) <-> "YYYY-MM-DD" (Gregorian,
// what <input type="date"> posted and what the server and src/lib/reports/range.ts read). Pure calendar days:
// no time zone is involved.

export const THAI_MONTHS_LONG: readonly string[] = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

export const BE_OFFSET = 543;
const MIN_BE = 2400;
const MAX_BE = 2700;

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

export function isRealDate(y: number, m: number, d: number): boolean {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d) || y < 1 || m < 1 || m > 12 || d < 1) return false;
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** "06/11/2569" -> "2026-11-06"; null when malformed, not a real day, or the year is outside 2400-2700 (BE). */
export function parseThaiDate(text: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const [d, mo, be] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (be < MIN_BE || be > MAX_BE) return null;
  const y = be - BE_OFFSET;
  return isRealDate(y, mo, d) ? `${pad(y, 4)}-${pad(mo)}-${pad(d)}` : null;
}

/** "2026-11-06" -> "06/11/2569"; "" when not a real ISO date. */
export function formatThaiDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return isRealDate(y, mo, d) ? `${m[3]}/${m[2]}/${pad(y + BE_OFFSET, 4)}` : "";
}
