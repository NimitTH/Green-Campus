// Time-based progress of an activity for the home page cards (DESIGN-2 5.2). Pure: the caller passes `now`.
// Bangkok is UTC+7 all year (no daylight saving), so calendar days are counted on a fixed offset.
const DAY_MS = 24 * 60 * 60 * 1000;
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Days since the epoch on the Bangkok wall calendar. */
const bangkokDay = (t: number) => Math.floor((t + BANGKOK_OFFSET_MS) / DAY_MS);

/**
 * percent: share of the start..end span already elapsed (whole number, 0..100; 0 before the start, 100 after the end).
 * daysLeft: Bangkok calendar days from today to the end day (0 on the last day, never below 0).
 */
export function activityProgress(startsAt: string, endsAt: string, now: Date): { percent: number; daysLeft: number } {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  const t = now.getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || Number.isNaN(t)) return { percent: 0, daysLeft: 0 };
  const percent =
    end <= start ? (t >= end ? 100 : 0) : Math.min(100, Math.max(0, Math.round(((t - start) / (end - start)) * 100)));
  return { percent, daysLeft: Math.max(0, bangkokDay(end) - bangkokDay(t)) };
}
