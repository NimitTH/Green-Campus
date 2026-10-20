import type { ActivityType } from "./abnormal";

// Thai display of submitted amounts on the staff review pages. Weights are integer grams.

const kgFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 });

/** 1550 -> "1 กก. 5 ขีด 50 กรัม" (1 ขีด = 100 g); zero parts are left out. */
export function formatGramsTh(grams: number): string {
  const kg = Math.floor(grams / 1000);
  const khit = Math.floor((grams % 1000) / 100);
  const rest = grams % 100;
  const parts: string[] = [];
  if (kg > 0) parts.push(`${kg.toLocaleString("en-US")} กก.`);
  if (khit > 0) parts.push(`${khit} ขีด`);
  if (rest > 0) parts.push(`${rest} กรัม`);
  return parts.length > 0 ? parts.join(" ") : "0 กรัม";
}

/** 1500 -> "1.5 กก." */
export function formatKgTh(grams: number): string {
  return `${kgFormat.format(grams / 1000)} กก.`;
}

/** Queue summary: total kg for waste, tree count, or "เข้าร่วม" for fixed. */
export function summaryTh(type: ActivityType, quantities: number[]): string {
  const total = quantities.reduce((sum, q) => sum + q, 0);
  if (type === "waste") return `รวม ${formatKgTh(total)}`;
  if (type === "trees") return `${total.toLocaleString("en-US")} ต้น`;
  return "เข้าร่วม";
}

/** Review page line about the student's other submissions in the same activity; null when none. */
export function studentHistoryTh(pending: number, approved: number): string | null {
  if (pending === 0 && approved === 0) return null;
  return `นักเรียนคนนี้มีผลในกิจกรรมนี้: รอตรวจ ${pending} ครั้ง, อนุมัติแล้ว ${approved} ครั้ง`;
}
