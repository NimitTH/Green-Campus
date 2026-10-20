const kgFormat = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 3 });
const intFormat = new Intl.NumberFormat("th-TH");

/** Carbon or weight in kg, th-TH grouping, at most 3 decimals. */
export function formatKg(kg: number): string {
  return kgFormat.format(kg);
}

/** Grams shown as kg. */
export function formatKgFromGrams(grams: number): string {
  return kgFormat.format(grams / 1000);
}

export function formatCount(n: number): string {
  return intFormat.format(n);
}

export type PublicStats = { carbonKg: number; wasteGrams: number; trees: number };

/** Parses the public_stats() jsonb; null for anything that is not the three finite numbers. */
export function parsePublicStats(raw: unknown): PublicStats | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const carbonKg = Number(r.carbon_kg);
  const wasteGrams = Number(r.waste_grams);
  const trees = Number(r.trees);
  if (![carbonKg, wasteGrams, trees].every(Number.isFinite)) return null;
  return { carbonKg, wasteGrams, trees };
}
