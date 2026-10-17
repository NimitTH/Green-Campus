/**
 * Client-side unit conversion and estimate helpers.
 *
 * The SQL function in the database (spec §6.1) is the SOURCE OF TRUTH for
 * points and carbon. `estimateWaste` mirrors that formula only to drive the
 * "estimate" box in the UI; never persist or trust its output.
 *
 * Weights are integer grams everywhere:
 *   points = floor(sum(grams * points_per_kg) / 1000)   per submission
 *   carbon = round(sum(grams * carbon_kg_per_kg) / 1000, 3)
 */

export type Rates = { pointsPerKg: number; carbonKgPerKg: number };

const GRAMS_PER_KG = 1000;
const GRAMS_PER_KHIT = 100; // 1 khit (ขีด) = 100 g
/** Upper bound for a single weight: 1,000,000 kg. Also fits a Postgres int. */
export const MAX_GRAMS = 1_000_000_000;

function assertNumber(value: unknown, name: string): asserts value is number {
  if (typeof value !== "number") {
    throw new TypeError(`${name} must be a number, got ${value === null ? "null" : typeof value}`);
  }
}

function assertNonNegativeFinite(value: unknown, name: string): asserts value is number {
  assertNumber(value, name);
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite non-negative number, got ${value}`);
  }
}

function assertNonNegativeInteger(value: unknown, name: string): asserts value is number {
  assertNonNegativeFinite(value, name);
  if (!Number.isInteger(value)) {
    throw new RangeError(`${name} must be a non-negative integer, got ${value}`);
  }
}

/**
 * Convert kilograms plus khit (1 khit = 100 g) to integer grams.
 * Fractional kg is rounded to the nearest gram (Math.round(kg * 1000)); the
 * rounding is done on the float product kg * 1000, so 1.0005 kg gives 1001 g (half rounds up).
 */
export function toGrams(kg: number, khit: number): number {
  assertNonNegativeFinite(kg, "kg");
  assertNonNegativeInteger(khit, "khit");
  const kgGrams = Math.round(kg * GRAMS_PER_KG);
  const khitGrams = khit * GRAMS_PER_KHIT;
  const total = kgGrams + khitGrams;
  if (!Number.isSafeInteger(total) || total > MAX_GRAMS) {
    throw new RangeError(`weight is too large (maximum ${MAX_GRAMS} g)`);
  }
  return total;
}

/**
 * Estimate points and carbon for a set of items (same formula as SQL §6.1).
 * Items are summed first, then points are floored once and carbon rounded once.
 */
export function estimateWaste(items: { grams: number; rates: Rates }[]): {
  points: number;
  carbonKg: number;
} {
  if (!Array.isArray(items)) {
    throw new TypeError("items must be an array");
  }
  let pointsNumerator = 0; // sum(grams * pointsPerKg); every step guarded to stay an exact safe integer
  let carbonMilliKg = 0; // sum(grams * carbonKgPerKg) == carbon in milli-kg
  for (const item of items) {
    if (item === null || typeof item !== "object" || item.rates === null || typeof item.rates !== "object") {
      throw new TypeError("each item must be { grams, rates }");
    }
    const { grams, rates } = item;
    assertNonNegativeInteger(grams, "grams");
    assertNonNegativeInteger(rates.pointsPerKg, "pointsPerKg");
    assertNonNegativeFinite(rates.carbonKgPerKg, "carbonKgPerKg");
    const product = grams * rates.pointsPerKg;
    if (!Number.isSafeInteger(product)) {
      throw new RangeError("estimate is too large");
    }
    pointsNumerator += product;
    if (!Number.isSafeInteger(pointsNumerator)) {
      throw new RangeError("estimate is too large");
    }
    carbonMilliKg += grams * rates.carbonKgPerKg;
  }
  // Integer division on a safe integer (no float division, no BigInt: tsconfig target is ES2017).
  const points = (pointsNumerator - (pointsNumerator % GRAMS_PER_KG)) / GRAMS_PER_KG;
  if (!Number.isFinite(carbonMilliKg)) {
    throw new RangeError("estimate is too large");
  }
  // toPrecision(12) strips binary drift (e.g. 1.4999999999999998) before rounding half up.
  const carbonKg = Math.round(Number(carbonMilliKg.toPrecision(12))) / GRAMS_PER_KG;
  return { points, carbonKg };
}
