// Round 6 (old-site features 1): the per-group waste rates shown on a waste activity's page.

export type WasteRate = { code: string; name: string; pointsPerKg: number; carbonKgPerKg: number };

const CODE_ORDER = ["plastic", "paper", "metal_glass", "other"];

/** Known codes in the fixed order used by the staff charts, then any other code by name. */
export function sortWasteRates(rows: WasteRate[]): WasteRate[] {
  const rank = (code: string) => {
    const i = CODE_ORDER.indexOf(code);
    return i === -1 ? CODE_ORDER.length : i;
  };
  return [...rows].sort((a, b) => rank(a.code) - rank(b.code) || a.name.localeCompare(b.name, "th"));
}
