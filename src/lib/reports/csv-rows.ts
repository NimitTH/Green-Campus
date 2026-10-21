import type { ActivityReportRow, StudentReportRow } from "./data";

// Report rows for toCsv (Task 16, R105). Decimal columns are written as 3-decimal strings (so "2.800"
// is kept, and Excel still reads them as numbers); grams become kg.

const kg = (grams: number) => (grams / 1000).toFixed(3);

export function activityCsvRows(rows: ActivityReportRow[]): (string | number)[][] {
  return [
    ["กิจกรรม", "วันที่จบ", "ผู้เข้าร่วม", "ผลที่อนุมัติ", "พลาสติก (กก.)", "กระดาษ (กก.)", "โลหะ/แก้ว (กก.)", "ขยะทั่วไป/อื่นๆ (กก.)", "ต้นไม้ (ต้น)", "แต้ม", "carbon (kgCO2e)"],
    ...rows.map((r) => [
      r.title,
      r.endsOn,
      r.participants,
      r.approvedSubmissions,
      kg(r.gramsPlastic),
      kg(r.gramsPaper),
      kg(r.gramsMetalGlass),
      kg(r.gramsOther),
      r.trees,
      r.points,
      r.carbonKg.toFixed(3),
    ]),
  ];
}

export function studentCsvRows(rows: StudentReportRow[]): (string | number)[][] {
  return [
    ["ชื่อ", "แต้ม", "carbon (kgCO2e)", "น้ำหนักรวม (กก.)", "ต้นไม้ (ต้น)"],
    ...rows.map((r) => [r.fullName, r.points, r.carbonKg.toFixed(3), kg(r.gramsTotal), r.trees]),
  ];
}
