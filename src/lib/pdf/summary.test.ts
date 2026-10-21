import { describe, expect, it } from "vitest";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { ActivityReportRow } from "@/lib/reports/data";
import { axisScale, renderSummary, type SummaryData } from "./summary";
import { CATEGORY_LABELS, summaryFromReport } from "./summary-data";

// Task 17 (R109, R112): the summary PDF, read back with pdfjs-dist (no poppler here), as in receipt.test.ts.

const cp = (...codes: number[]) => String.fromCodePoint(...codes);
const ZERO_WIDTH = new RegExp(`[\\s${cp(0x200b, 0x200c, 0x200d, 0x2060, 0xfeff)}]`, "g");
const SARA_AM = cp(0x0e33);
const SARA_AA = cp(0x0e32);
// pdfkit's ToUnicode gives ำ back as ำ + า (docs/pdf-library-decision.md): fold it.
const normalise = (s: string) => s.replace(ZERO_WIDTH, "").replaceAll(SARA_AM + SARA_AA, SARA_AM);

type FontInfo = { name: string; missingFile: boolean };

async function readBack(bytes: Uint8Array): Promise<{ text: string; pages: number; fontInfo: FontInfo[] }> {
  const task = getDocument({ data: bytes.slice(), useSystemFonts: false, fontExtraProperties: true });
  const doc = await task.promise;
  let text = "";
  const fontInfo = new Map<string, FontInfo>();
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    text += content.items.map((i) => ("str" in i ? i.str : "")).join("");
    const ops = await page.getOperatorList();
    ops.fnArray.forEach((fn, i) => {
      if (fn !== OPS.setFont) return;
      const font = page.commonObjs.get(ops.argsArray[i][0]) as { name?: string; missingFile?: boolean };
      if (font?.name) fontInfo.set(font.name, { name: font.name, missingFile: font.missingFile !== false });
    });
  }
  const pages = doc.numPages;
  await task.destroy();
  return { text: normalise(text), pages, fontInfo: [...fontInfo.values()] };
}

const NOW = new Date("2036-06-01T03:00:00Z");
const FROM = new Date("2036-05-01T00:00:00+07:00");
const TO = new Date("2036-05-31T00:00:00+07:00");
const CHART_TITLES = ["carbon ที่ลดได้ รายกิจกรรม (kgCO2e)", "น้ำหนักขยะที่เก็บ แยก 4 กลุ่ม (กก.)", "จำนวนต้นไม้ที่ปลูก รายกิจกรรม (ต้น)"];
const EMPTY_TEXT = "ไม่มีข้อมูลในช่วงที่เลือก";

const ACTIVITIES = [
  { title: "เก็บขยะริมน้ำหน้าโรงเรียน", carbonKg: 812.25, wasteGrams: 350_000, trees: 0 },
  { title: "ปลูกต้นไม้ที่สวนผู้สูงอายุ", carbonKg: 300.1, wasteGrams: 0, trees: 25 },
  { title: "แยกขยะแบบญี่ปุ่น", carbonKg: 95.0128, wasteGrams: 120_500, trees: 3 },
  { title: "ปั้นกระถางจากกระดาษ", carbonKg: 20, wasteGrams: 8_000, trees: 12 },
  { title: "รีไซเคิลขวดพลาสติก", carbonKg: 7.2, wasteGrams: 45_250, trees: 0 },
  { title: "ค่ายอนุรักษ์ป่าชายเลน", carbonKg: 0, wasteGrams: 0, trees: 40 },
];
const sample: SummaryData = {
  from: FROM,
  to: TO,
  totals: { carbonKg: 1234.5628, wasteGrams: 523_750, trees: 80, points: 12_345, activities: 6 },
  byActivity: ACTIVITIES,
  byCategory: [
    { name: "พลาสติก", grams: 200_000 },
    { name: "กระดาษ", grams: 150_250 },
    { name: "โลหะ/แก้ว", grams: 73_500 },
    { name: "ขยะทั่วไป/อื่นๆ", grams: 100_000 },
  ],
};
const empty: SummaryData = {
  from: FROM,
  to: TO,
  totals: { carbonKg: 0, wasteGrams: 0, trees: 0, points: 0, activities: 0 },
  byActivity: [],
  byCategory: CATEGORY_LABELS.map((name) => ({ name, grams: 0 })),
};

describe("renderSummary", () => {
  it("embeds Sarabun and contains the titles, the th-TH totals and the three chart titles", async () => {
    const bytes = await renderSummary(sample, NOW);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const { text, pages, fontInfo } = await readBack(bytes);
    expect(pages).toBe(1);
    expect(fontInfo.length).toBeGreaterThan(0);
    for (const f of fontInfo) {
      expect(f.name).toContain("Sarabun");
      expect(f.missingFile).toBe(false);
    }
    expect(text).toContain("GreenCampus");
    expect(text).toContain("รายงานสรุปผลกิจกรรม");
    for (const a of ACTIVITIES) expect(text).toContain(normalise(a.title));
    for (const t of CHART_TITLES) expect(text).toContain(normalise(t));
    expect(text).toContain("1,234.563"); // carbon, at most 3 decimals
    expect(text).toContain("523.75"); // waste kg
    expect(text).toContain("12,345"); // points
    expect(text).toContain(normalise("นับเฉพาะผลที่อนุมัติของกิจกรรมที่จบแล้ว ตามวันที่กิจกรรมจบ"));
    expect(text).not.toContain(EMPTY_TEXT);
    expect(text).not.toContain("NaN");
  });

  it("gives one page with the empty message and zero charts for an empty range, without throwing", async () => {
    const { text, pages } = await readBack(await renderSummary(empty, NOW));
    expect(pages).toBe(1);
    expect(text).toContain(EMPTY_TEXT);
    for (const t of CHART_TITLES) expect(text).toContain(normalise(t));
    for (const c of CATEGORY_LABELS) expect(text).toContain(normalise(c));
    expect(text).not.toContain("NaN");
    expect(text).not.toContain("Infinity");
  });

  it("keeps 30 activities to at most 10 bars plus one aggregated bar, on a bounded page count", async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ title: `กิจกรรมที่ ${i + 1}`, carbonKg: i + 1, wasteGrams: 1000 * i, trees: i % 4 }));
    const { text, pages } = await readBack(
      await renderSummary({ ...sample, byActivity: many, totals: { ...sample.totals, activities: 30 } }, NOW),
    );
    expect(pages).toBeLessThanOrEqual(2);
    expect(text).toContain(normalise("อื่นๆ (20 กิจกรรม)"));
    expect(text).toContain(normalise("กิจกรรมที่ 30")); // the largest carbon is shown
  });

  it("cuts a very long Thai title with an ellipsis instead of overflowing into the bars", async () => {
    const long = "โครงการรณรงค์ลดขยะพลาสติกและส่งเสริมการคัดแยกขยะที่ต้นทางร่วมกับชุมชนผู้ปกครองและนักเรียนทุกระดับชั้นตลอดภาคเรียนที่สอง";
    const { text } = await readBack(
      await renderSummary({ ...sample, byActivity: [{ title: long, carbonKg: 5, wasteGrams: 1000, trees: 1 }] }, NOW),
    );
    expect(text).toContain("…");
    expect(text).toContain(normalise("โครงการรณรงค์"));
    expect(text).not.toContain(normalise(long));
  });
});

describe("axisScale", () => {
  it("is zero-safe: a max of 0 gives a zero axis and zero-length bars", () => {
    const s = axisScale(0);
    expect(s.max).toBe(0);
    expect(s.length(0, 200)).toBe(0);
    expect(Number.isNaN(s.length(5, 200))).toBe(false);
  });
  it("rounds the max up to a nice step and scales bars to the plot width", () => {
    const s = axisScale(812.25);
    expect(s.max).toBeGreaterThanOrEqual(812.25);
    expect(s.ticks[0]).toBe(0);
    expect(s.ticks.at(-1)).toBe(s.max);
    expect(s.length(s.max, 200)).toBe(200);
    expect(s.length(s.max / 2, 200)).toBe(100);
    // integer charts (trees) never get fractional ticks
    expect(axisScale(3, true).ticks.every(Number.isInteger)).toBe(true);
  });
});

describe("summaryFromReport", () => {
  const row = (over: Partial<ActivityReportRow>): ActivityReportRow => ({
    title: "ก",
    endsOn: "2036-05-10",
    participants: 1,
    approvedSubmissions: 1,
    gramsPlastic: 0,
    gramsPaper: 0,
    gramsMetalGlass: 0,
    gramsOther: 0,
    trees: 0,
    points: 0,
    carbonKg: 0,
    ...over,
  });

  it("sums the rows into the totals, four fixed categories and per-activity waste", () => {
    const data = summaryFromReport(
      [
        row({ title: "ก", gramsPlastic: 1000, gramsPaper: 2, gramsMetalGlass: 30, gramsOther: 400, trees: 3, points: 10, carbonKg: 1.5 }),
        row({ title: "ข", gramsPlastic: 5, gramsOther: 1, trees: 1, points: 7, carbonKg: 0.25 }),
      ],
      "2036-05-01",
      "2036-05-31",
    );
    expect(data.from.toISOString()).toBe("2036-04-30T17:00:00.000Z");
    expect(data.to.toISOString()).toBe("2036-05-30T17:00:00.000Z");
    expect(data.totals).toEqual({ carbonKg: 1.75, wasteGrams: 1438, trees: 4, points: 17, activities: 2 });
    expect(data.byCategory).toEqual([
      { name: "พลาสติก", grams: 1005 },
      { name: "กระดาษ", grams: 2 },
      { name: "โลหะ/แก้ว", grams: 30 },
      { name: "ขยะทั่วไป/อื่นๆ", grams: 401 },
    ]);
    expect(data.byActivity).toEqual([
      { title: "ก", carbonKg: 1.5, wasteGrams: 1432, trees: 3 },
      { title: "ข", carbonKg: 0.25, wasteGrams: 6, trees: 1 },
    ]);
  });

  it("has four zero categories and zero totals with no rows", () => {
    const data = summaryFromReport([], "2036-05-01", "2036-05-31");
    expect(data.totals).toEqual({ carbonKg: 0, wasteGrams: 0, trees: 0, points: 0, activities: 0 });
    expect(data.byCategory.map((c) => c.name)).toEqual(["พลาสติก", "กระดาษ", "โลหะ/แก้ว", "ขยะทั่วไป/อื่นๆ"]);
    expect(data.byCategory.every((c) => c.grams === 0)).toBe(true);
    expect(data.byActivity).toEqual([]);
  });
});
