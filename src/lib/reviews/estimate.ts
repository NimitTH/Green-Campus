import { estimateWaste } from "@/lib/units";
import type { ActivityType } from "./abnormal";

// Estimate on the review screen at the CURRENT rates. approve_submission (SQL, spec 6.1) is the
// source of truth and uses the rates at the moment of approval; this only mirrors it for display.

export type EstimateItem = {
  quantity: number;
  category: { pointsPerKg: number; carbonKgPerKg: number } | null;
};

export function estimateSubmission(
  activity: { type: ActivityType; unitPoints: number; unitCarbonKg: number | null },
  items: EstimateItem[],
): { points: number; carbonKg: number } {
  if (activity.type === "waste") {
    return estimateWaste(
      items.map((item) => ({
        grams: item.quantity,
        rates: { pointsPerKg: item.category?.pointsPerKg ?? 0, carbonKgPerKg: item.category?.carbonKgPerKg ?? 0 },
      })),
    );
  }
  const count = activity.type === "trees" ? items.reduce((sum, i) => sum + i.quantity, 0) : 1;
  const carbon = count * (activity.unitCarbonKg ?? 0);
  return { points: count * activity.unitPoints, carbonKg: Math.round(Number(carbon.toPrecision(12)) * 1000) / 1000 };
}
