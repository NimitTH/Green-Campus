// Asia/Bangkok is UTC+7 all year (no daylight saving), so a fixed offset is exact.
// Forms use <input type="datetime-local"> whose value has no time zone: we always
// read it as Bangkok wall time and store UTC (timestamptz).

export const BANGKOK_TIME_ZONE = "Asia/Bangkok";
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** "2026-10-17T08:30" (Bangkok) -> "2026-10-17T01:30:00.000Z"; null if not a real date-time. */
export function bangkokLocalToUtcIso(local: string): string | null {
  const m = LOCAL_RE.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi, s] = [m[1], m[2], m[3], m[4], m[5], m[6] ?? "0"].map(Number);
  if (mo < 1 || mo > 12 || h > 23 || mi > 59 || s > 59) return null;
  const wall = Date.UTC(y, mo - 1, d, h, mi, s);
  // Reject overflowing days such as 2026-02-30 (Date.UTC would roll them over).
  const check = new Date(wall);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) {
    return null;
  }
  return new Date(wall - BANGKOK_OFFSET_MS).toISOString();
}

/** UTC instant -> "YYYY-MM-DDTHH:mm" Bangkok wall time (for datetime-local inputs); "" if invalid. */
export function utcToBangkokLocal(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const b = new Date(t + BANGKOK_OFFSET_MS);
  return `${b.getUTCFullYear()}-${pad(b.getUTCMonth() + 1)}-${pad(b.getUTCDate())}T${pad(b.getUTCHours())}:${pad(b.getUTCMinutes())}`;
}

const displayFormat = new Intl.DateTimeFormat("th-TH", {
  timeZone: BANGKOK_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Thai display in Bangkok time, e.g. "31 ต.ค. 2569 23:30"; "-" if invalid. */
export function formatBangkok(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "-";
  return displayFormat.format(new Date(t));
}
