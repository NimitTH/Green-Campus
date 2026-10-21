import { describe, expect, it } from "vitest";
import { activityCsvRows, studentCsvRows } from "./csv-rows";

describe("report csv rows", () => {
  it("has the Thai header even without data", () => {
    expect(activityCsvRows([])).toEqual([
      ["กิจกรรม", "วันที่จบ", "ผู้เข้าร่วม", "ผลที่อนุมัติ", "พลาสติก (กก.)", "กระดาษ (กก.)", "โลหะ/แก้ว (กก.)", "ขยะทั่วไป/อื่นๆ (กก.)", "ต้นไม้ (ต้น)", "แต้ม", "carbon (kgCO2e)"],
    ]);
    expect(studentCsvRows([])).toEqual([["ชื่อ", "แต้ม", "carbon (kgCO2e)", "น้ำหนักรวม (กก.)", "ต้นไม้ (ต้น)"]]);
  });
  it("converts grams to kg with 3 decimals and writes ISO dates", () => {
    const rows = activityCsvRows([
      { title: "ก", endsOn: "2033-05-10", participants: 2, approvedSubmissions: 1, gramsPlastic: 1500, gramsPaper: 5, gramsMetalGlass: 0, gramsOther: 123456, trees: 3, points: 25, carbonKg: 2.8 },
    ]);
    expect(rows[1]).toEqual(["ก", "2033-05-10", 2, 1, "1.500", "0.005", "0.000", "123.456", 3, 25, "2.800"]);
    expect(studentCsvRows([{ fullName: "ข", points: 1, carbonKg: 0.5, gramsTotal: 2000, trees: 0 }])[1]).toEqual(["ข", 1, "0.500", "2.000", 0]);
  });
});
