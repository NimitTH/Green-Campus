import { utcToBangkokLocal } from "../../../src/lib/datetime";

/** datetime-local value (Bangkok wall time) `minutes` from now. */
export function bangkokInputValue(minutesFromNow: number): string {
  return utcToBangkokLocal(new Date(Date.now() + minutesFromNow * 60_000).toISOString());
}
