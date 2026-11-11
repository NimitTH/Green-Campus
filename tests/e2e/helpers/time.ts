import type { Locator } from "@playwright/test";
import { formatThaiDate } from "../../../src/lib/thai-date";
import { utcToBangkokLocal } from "../../../src/lib/datetime";

/** datetime-local value (Bangkok wall time) `minutes` from now. */
export function bangkokInputValue(minutesFromNow: number): string {
  return utcToBangkokLocal(new Date(Date.now() + minutesFromNow * 60_000).toISOString());
}

/** Fill a DateTimeInput (dd/mm/BE text + HH:mm) whose date field is `dateInput`, from a "YYYY-MM-DDTHH:mm" value. */
export async function fillDateTime(dateInput: Locator, local: string): Promise<void> {
  const [date, time] = local.split("T");
  await dateInput.fill(formatThaiDate(date));
  const id = await dateInput.getAttribute("id");
  await dateInput.page().locator(`[id="${id}-time"]`).fill(time);
}
