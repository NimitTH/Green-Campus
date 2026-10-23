// Pure date helpers of the demo seed (I3, fix round 1 M5). No imports, so Vitest can test them directly.

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const BANGKOK_OFFSET = 7 * HOUR; // Asia/Bangkok has no DST

/** Start of the Bangkok calendar month containing `ms` (as epoch ms). */
export function bangkokMonthStart(ms: number): number {
  const d = new Date(ms + BANGKOK_OFFSET);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - BANGKOK_OFFSET;
}

/**
 * Submit and review time of a result that must count in the CURRENT Bangkok month: both inside
 * [max(month start, notBefore), now - 1 s], review strictly after submit when there is room.
 * `frac` in [0, 1] spreads results over the window. Normally the window ends 1 h before now; right after
 * midnight on the 1st (a window of seconds) the results sit a few seconds after the month start instead.
 */
export function currentMonthSlot(now: number, notBefore: number, frac: number): { created: number; reviewed: number } {
  const floor = Math.min(Math.max(bangkokMonthStart(now), notBefore), now);
  const latest = Math.max(floor, now - SECOND);
  const span = latest - floor;
  const lo = floor + Math.min(MINUTE, span * 0.1);
  const hi = floor + Math.max(span - HOUR, span * 0.5);
  const f = Math.min(Math.max(frac, 0), 1);
  const created = Math.round(lo + (hi - lo) * f);
  // reviewed a while after the submission (>= 1 min when there is room), never after `latest`
  const reviewed = Math.round(Math.min(created + Math.max(MINUTE, (latest - created) / 3), latest));
  return { created, reviewed };
}
