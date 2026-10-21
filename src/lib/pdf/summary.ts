import pdfmake from "pdfmake";
import type { CanvasElement, Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { BANGKOK_TIME_ZONE, formatBangkok } from "@/lib/datetime";
import { FONT_DIR, measureSarabun, PDF_FONTS } from "./fonts";
import { wrapThai } from "./thai-wrap";

// The summary report PDF (Task 17, R109; spec 10.2): A4 portrait, Sarabun embedded, the totals of the
// selected range and three bar charts drawn as vectors by pdfmake itself (canvas rects and lines, text
// labels on top), so it runs in a plain Node function with no headless browser. Same library and
// Thai helpers as the receipt (docs/pdf-library-decision.md). Data: summaryFromReport (summary-data.ts).

export type SummaryData = {
  /** Bangkok midnight of the first and last ends_at day of the range. */
  from: Date;
  to: Date;
  totals: { carbonKg: number; wasteGrams: number; trees: number; points: number; activities: number };
  byActivity: { title: string; carbonKg: number; wasteGrams: number; trees: number }[];
  byCategory: { name: string; grams: number }[];
};

const integer = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 3 });
const rangeDate = new Intl.DateTimeFormat("th-TH", { timeZone: BANGKOK_TIME_ZONE, day: "numeric", month: "long", year: "numeric" });

const GREEN = "#15803d";
const BAR = "#16a34a";
const INK = "#111827";
const GRAY = "#4b5563";
const GRID = "#e5e7eb";
const AXIS = "#9ca3af";

// A4 is 595.28 x 841.89 pt.
const MARGIN = 36;
const CONTENT_WIDTH = 595.28 - 2 * MARGIN;
const BODY = 10;
const SLACK = 1; // measured widths vs pdfmake's own layout: a small rounding margin

// Chart geometry (points). The label column is fixed: a label never reaches the plot.
const LABEL_SIZE = 9;
const LABEL_WIDTH = 150;
const LABEL_GAP = 6;
const VALUE_WIDTH = 64;
const PLOT_X = LABEL_WIDTH + LABEL_GAP;
const PLOT_WIDTH = CONTENT_WIDTH - PLOT_X - 4 - VALUE_WIDTH;
const ROW_HEIGHT = 16;
const BAR_HEIGHT = 10;
const TICK_BAND = 14;
const TICK_WIDTH = 48;
const LINE_HEIGHT = 1.3; // Sarabun (ascent 1068 - descent -232) / 1000 units per em
const MAX_BARS = 10;

export const CHART_TITLES = {
  carbon: "carbon ที่ลดได้ รายกิจกรรม (kgCO2e)",
  waste: "น้ำหนักขยะที่เก็บ แยก 4 กลุ่ม (กก.)",
  trees: "จำนวนต้นไม้ที่ปลูก รายกิจกรรม (ต้น)",
} as const;
export const EMPTY_TEXT = "ไม่มีข้อมูลในช่วงที่เลือก";
export const COUNTING_NOTE = "นับเฉพาะผลที่อนุมัติของกิจกรรมที่จบแล้ว ตามวันที่กิจกรรมจบ (เวลาประเทศไทย)";

/** Thai text pre-wrapped for `width` (pdfmake cannot break Thai between words by itself). */
function thai(text: string, width: number, size: number, bold = false): string {
  return wrapThai(text, width - SLACK, (t) => measureSarabun(t, size, bold ? "bold" : "normal"));
}

const graphemes = new Intl.Segmenter("th", { granularity: "grapheme" });
const fitted = new Map<string, string>();

/**
 * `text` on one line no wider than `width`, cut between grapheme clusters with "…" when it is longer.
 * Memoized, and a binary search over the cut point: O(log n) measurements per new label.
 */
export function fitLabel(text: string, width: number, size: number): string {
  const key = `${size}|${width}|${text}`;
  const hit = fitted.get(key);
  if (hit !== undefined) return hit;
  const clean = text.replace(/\s+/g, " ").trim();
  const max = width - SLACK;
  const fits = (t: string) => measureSarabun(t, size) <= max;
  let result = clean;
  if (!fits(clean)) {
    const parts = Array.from(graphemes.segment(clean), (s) => s.segment);
    const cut = (k: number) => parts.slice(0, k).join("").trimEnd() + "…";
    let lo = 0; // cut(lo) always fits (at worst the bare ellipsis)
    let hi = parts.length - 1;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (fits(cut(mid))) lo = mid;
      else hi = mid - 1;
    }
    result = cut(lo);
  }
  if (fitted.size > 5000) fitted.clear();
  fitted.set(key, result);
  return result;
}

export type AxisScale = { max: number; ticks: number[]; length: (value: number, width: number) => number };

/**
 * A value axis from 0 to a "nice" max (at most 5 equal steps of 1, 2, 2.5 or 5 x 10^n). Zero-safe: with no
 * positive value the axis is a single 0 tick and every bar has length 0 (no division by zero, no NaN).
 */
export function axisScale(maxValue: number, integerSteps = false): AxisScale {
  if (!Number.isFinite(maxValue) || maxValue <= 0) return { max: 0, ticks: [0], length: () => 0 };
  const raw = maxValue / 5;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / magnitude;
  let step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * magnitude;
  if (integerSteps) step = Math.max(1, Math.ceil(step));
  const clean = (n: number) => Math.round(n * 1e9) / 1e9;
  const count = Math.max(1, Math.ceil(clean(maxValue / step)));
  const ticks = Array.from({ length: count + 1 }, (_, i) => clean(step * i));
  const max = ticks[count];
  return {
    max,
    ticks,
    length: (value, width) => (Number.isFinite(value) ? (Math.min(Math.max(value, 0), max) / max) * width : 0),
  };
}

type Bar = { label: string; value: number };

/** The `MAX_BARS` largest activities by `value`, the rest folded into one "อื่นๆ (N กิจกรรม)" bar. */
function topBars<T extends { title: string }>(items: T[], value: (item: T) => number): Bar[] {
  const sorted = [...items].sort((a, b) => value(b) - value(a));
  const bars = sorted.slice(0, MAX_BARS).map((item) => ({ label: item.title, value: value(item) }));
  const rest = sorted.slice(MAX_BARS);
  if (rest.length > 0) bars.push({ label: `อื่นๆ (${integer.format(rest.length)} กิจกรรม)`, value: rest.reduce((sum, item) => sum + value(item), 0) });
  return bars;
}

/** A detached single-line text box of `width` at (x, y) from the current position. */
function placed(text: string, x: number, y: number, width: number, alignment: "left" | "right" | "center", color = INK): Content {
  return {
    relativePosition: { x, y },
    columns: [{ width, text, alignment, color, fontSize: LABEL_SIZE, lineHeight: 1 }],
  };
}

/**
 * A horizontal bar chart: the canvas (grid, bars, axis) first, then its labels placed back over it
 * with negative relative offsets, all in one unbreakable block so a page break never splits them.
 */
function barChart(title: string, bars: Bar[], format: (n: number) => string, integerSteps = false): Content {
  const rows: Bar[] = bars.length > 0 ? bars : [{ label: "(ไม่มีกิจกรรม)", value: 0 }];
  const scale = axisScale(Math.max(0, ...rows.map((r) => r.value)), integerSteps);
  const plotHeight = rows.length * ROW_HEIGHT;
  const height = plotHeight + TICK_BAND;
  const textHeight = LABEL_SIZE * LINE_HEIGHT;
  const textOffset = (ROW_HEIGHT - textHeight) / 2;
  const tickX = (t: number) => PLOT_X + scale.length(t, PLOT_WIDTH);

  // A white background the full chart size first: pdfmake measures a canvas by its elements, and the
  // labels below are placed from the canvas bottom, so its height must be exactly `height`.
  const canvas: CanvasElement[] = [{ type: "rect", x: 0, y: 0, w: CONTENT_WIDTH, h: height, color: "#ffffff" }];
  for (const t of scale.ticks) {
    canvas.push({ type: "line", x1: tickX(t), y1: 0, x2: tickX(t), y2: plotHeight, lineWidth: 0.5, lineColor: GRID });
    canvas.push({ type: "line", x1: tickX(t), y1: plotHeight, x2: tickX(t), y2: plotHeight + 3, lineWidth: 0.5, lineColor: AXIS });
  }
  rows.forEach((r, i) => {
    const w = scale.length(r.value, PLOT_WIDTH);
    if (w > 0) canvas.push({ type: "rect", x: PLOT_X, y: i * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2, w, h: BAR_HEIGHT, color: BAR });
  });
  canvas.push({ type: "line", x1: PLOT_X, y1: 0, x2: PLOT_X, y2: plotHeight, lineWidth: 0.75, lineColor: AXIS });
  canvas.push({ type: "line", x1: PLOT_X, y1: plotHeight, x2: PLOT_X + PLOT_WIDTH, y2: plotHeight, lineWidth: 0.75, lineColor: AXIS });

  const labels: Content[] = [];
  rows.forEach((r, i) => {
    const y = -height + i * ROW_HEIGHT + textOffset;
    labels.push(placed(fitLabel(r.label, LABEL_WIDTH, LABEL_SIZE), 0, y, LABEL_WIDTH, "right", bars.length > 0 ? INK : GRAY));
    labels.push(placed(format(r.value), PLOT_X + scale.length(r.value, PLOT_WIDTH) + 4, y, VALUE_WIDTH, "left", GRAY));
  });
  for (const t of scale.ticks) labels.push(placed(format(t), tickX(t) - TICK_WIDTH / 2, -TICK_BAND + 4, TICK_WIDTH, "center", GRAY));

  return {
    unbreakable: true,
    margin: [0, 0, 0, 14],
    stack: [{ text: thai(title, CONTENT_WIDTH, 11, true), bold: true, fontSize: 11, margin: [0, 0, 0, 4] }, { canvas }, ...labels],
  };
}

/** The largest font size (down to 7 pt) at which `text` fits `width` on one line. */
function fitSize(text: string, width: number, size: number): number {
  let s = size;
  while (s > 7 && measureSarabun(text, s, "bold") > width - SLACK) s -= 0.5;
  return s;
}

function totalsRow(totals: SummaryData["totals"]): Content {
  const cells = [
    ["carbon ที่ลดได้", decimal.format(totals.carbonKg), "kgCO2e"],
    ["น้ำหนักขยะ", decimal.format(totals.wasteGrams / 1000), "กก."],
    ["ต้นไม้", integer.format(totals.trees), "ต้น"],
    ["แต้มที่ให้", integer.format(totals.points), "แต้ม"],
    ["จำนวนกิจกรรม", integer.format(totals.activities), "กิจกรรม"],
  ];
  const padding = 6;
  const width = (CONTENT_WIDTH - cells.length * 2 * padding - (cells.length + 1)) / cells.length;
  return {
    margin: [0, 0, 0, 8],
    table: {
      widths: cells.map(() => width),
      body: [
        cells.map(([label, value, unit]) => ({
          stack: [
            { text: thai(label, width, 9), fontSize: 9, color: GRAY },
            // one line, at a size that fits the fixed column: a number never wraps
            { text: value, bold: true, fontSize: fitSize(value, width, 15), color: INK },
            { text: unit, fontSize: 8.5, color: GRAY },
          ],
          fillColor: "#f0fdf4",
        })),
      ],
    },
    layout: {
      hLineWidth: () => 1,
      vLineWidth: () => 1,
      hLineColor: () => "#bbf7d0",
      vLineColor: () => "#bbf7d0",
      paddingLeft: () => padding,
      paddingRight: () => padding,
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
  };
}

function definition(data: SummaryData, now: Date): TDocumentDefinitions {
  const empty = data.byActivity.length === 0;
  const range = `ช่วงวันที่จบกิจกรรม ${rangeDate.format(data.from)} ถึง ${rangeDate.format(data.to)}`;
  const kg = (grams: number) => grams / 1000;
  return {
    pageSize: "A4",
    pageOrientation: "portrait",
    pageMargins: MARGIN,
    info: { title: "รายงานสรุปผลกิจกรรม", author: "Green Campus" },
    defaultStyle: { font: "Sarabun", fontSize: BODY, lineHeight: 1.1, color: INK },
    content: [
      { text: "Green Campus", bold: true, fontSize: 13, color: GREEN },
      { text: "รายงานสรุปผลกิจกรรม", bold: true, fontSize: 18 },
      { text: thai(range, CONTENT_WIDTH, BODY), margin: [0, 2, 0, 0] },
      { text: thai(`สร้างเมื่อ ${formatBangkok(now.toISOString())}`, CONTENT_WIDTH, 9), fontSize: 9, color: GRAY, margin: [0, 0, 0, 8] },
      totalsRow(data.totals),
      ...(empty
        ? [
            {
              text: EMPTY_TEXT,
              bold: true,
              alignment: "center" as const,
              color: GRAY,
              margin: [0, 4, 0, 8] as [number, number, number, number],
            },
          ]
        : []),
      { text: thai(COUNTING_NOTE, CONTENT_WIDTH, 8.5), fontSize: 8.5, color: GRAY, margin: [0, 0, 0, 10] },
      barChart(CHART_TITLES.carbon, topBars(data.byActivity, (a) => a.carbonKg), (n) => decimal.format(n)),
      barChart(
        CHART_TITLES.waste,
        data.byCategory.map((c) => ({ label: c.name, value: kg(c.grams) })),
        (n) => decimal.format(n),
      ),
      barChart(CHART_TITLES.trees, topBars(data.byActivity, (a) => a.trees), (n) => integer.format(n), true),
    ],
  };
}

/** The summary report as PDF bytes. `now` is the printed generated-at time (tests pass a fixed one). */
export async function renderSummary(data: SummaryData, now: Date = new Date()): Promise<Uint8Array> {
  pdfmake.setFonts(PDF_FONTS);
  pdfmake.setUrlAccessPolicy(() => false);
  pdfmake.setLocalAccessPolicy((file) => file.startsWith(FONT_DIR));
  const buffer = await pdfmake.createPdf(definition(data, now)).getBuffer();
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}
