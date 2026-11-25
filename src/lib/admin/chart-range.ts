// Round 6 (old-site features 2): the range choices for the /staff charts, read from search params.
import { bangkokDayStartIso, presetRange } from "@/lib/reports/range";

export type CarbonMonths = 6 | 12;
export type WastePeriod = "30d" | "12m" | "all";

export const CARBON_MONTHS: CarbonMonths[] = [6, 12];
export const WASTE_PERIODS: WastePeriod[] = ["30d", "12m", "all"];

/** Unknown or missing values fall back to the defaults: 6 months, all waste. */
export function parseChartRange(params: { months?: string; waste?: string }): { months: CarbonMonths; waste: WastePeriod } {
  const months: CarbonMonths = params.months === "12" ? 12 : 6;
  const waste: WastePeriod = params.waste === "30d" || params.waste === "12m" ? params.waste : "all";
  return { months, waste };
}

/** The start of the waste period (Bangkok midnight of its first day, same days as the report presets), or null for all. */
export function wasteSince(period: WastePeriod, now: Date): string | null {
  if (period === "all") return null;
  return bangkokDayStartIso(presetRange(period, now).from);
}
