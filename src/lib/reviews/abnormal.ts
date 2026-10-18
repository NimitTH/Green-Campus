/**
 * Abnormal-amount flag on the review screen (spec 9.4, ruling R40).
 *
 * A submission's total is Σ grams (waste) or the tree count (trees); fixed submissions have no
 * total and are never flagged. The flag shows when the total is more than 3 × the average total
 * of the OTHER pending/approved submissions of the same activity. With no others: no flag.
 */

export type ActivityType = "waste" | "trees" | "fixed";

export const ABNORMAL_FACTOR = 3;

export function submissionTotal(type: ActivityType, quantities: number[]): number | null {
  if (type === "fixed") return null;
  return quantities.reduce((sum, q) => sum + q, 0);
}

export function isAbnormalTotal(total: number | null, otherTotals: number[]): boolean {
  if (total === null || otherTotals.length === 0) return false;
  const sum = otherTotals.reduce((acc, t) => acc + t, 0);
  // total > FACTOR × (sum / n), compared without dividing (integers stay exact).
  return total * otherTotals.length > ABNORMAL_FACTOR * sum;
}
