import type { ActivityReportRow } from "@/lib/reports/data";
import type { SummaryData } from "./summary";

// Task 17 (R109): the summary PDF's data, derived only from report_activities rows (Task 16), so the
// PDF counts exactly what the reports page and the activities CSV count (spec 10: approved results of
// ended activities, ranged by the Bangkok ends_at date). No SQL of its own.

/** The four waste groups, in the CSV's column order and with its labels. */
export const CATEGORY_LABELS = ["พลาสติก", "กระดาษ", "โลหะ/แก้ว", "ขยะทั่วไป/อื่นๆ"] as const;

// Sums of numeric(…, 3) carbon values: round off binary floating point noise (0.1 + 0.2).
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** Midnight Bangkok (UTC+7, no daylight saving) of a YYYY-MM-DD day. */
const bangkokDay = (isoDate: string) => new Date(`${isoDate}T00:00:00+07:00`);

export function summaryFromReport(rows: ActivityReportRow[], from: string, to: string): SummaryData {
  const grams = [0, 0, 0, 0];
  const totals = { carbonKg: 0, wasteGrams: 0, trees: 0, points: 0, activities: rows.length };
  const byActivity = rows.map((r) => {
    const parts = [r.gramsPlastic, r.gramsPaper, r.gramsMetalGlass, r.gramsOther];
    parts.forEach((g, i) => (grams[i] += g));
    const wasteGrams = parts.reduce((a, b) => a + b, 0);
    totals.carbonKg += r.carbonKg;
    totals.wasteGrams += wasteGrams;
    totals.trees += r.trees;
    totals.points += r.points;
    return { title: r.title, carbonKg: r.carbonKg, wasteGrams, trees: r.trees };
  });
  totals.carbonKg = round6(totals.carbonKg);
  return {
    from: bangkokDay(from),
    to: bangkokDay(to),
    totals,
    byActivity,
    byCategory: CATEGORY_LABELS.map((name, i) => ({ name, grams: grams[i] })),
  };
}
