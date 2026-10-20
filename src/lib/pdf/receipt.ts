import pdfmake from "pdfmake";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { formatBangkok } from "@/lib/datetime";
import { isOrderOverdue, OVERDUE_NOTICE_TH } from "@/lib/orders/format";
import { FONT_DIR, measureSarabun, PDF_FONTS } from "./fonts";
import { wrapThai } from "./thai-wrap";

// The order receipt (Task 14, R87): A5 portrait, Sarabun, vector text drawn by pdfmake (pdfkit),
// so it runs in a plain Node function with no headless browser. Library choice and the Thai line
// breaking workaround: docs/pdf-library-decision.md.

export type ReceiptData = {
  orderNo: string;
  createdAt: Date;
  studentName: string;
  /** The Thai status label (printed). */
  status: string;
  /** orders.status as stored (pending_pickup, completed, ...). */
  rawStatus: string;
  /** orders.ready_at (staff prepared the reward), or null. */
  readyAt: Date | null;
  expiresAt: Date;
  items: { name: string; qty: number; unitCost: number }[];
  totalPoints: number;
};

export type ReceiptPhase = "pending" | "overdue" | "done";

/**
 * pending: waits for pickup before the deadline; overdue: still pending_pickup but past expires_at
 * (expire_orders will refund it); done: completed / cancelled / expired. From the raw status.
 */
export function receiptPhase(order: ReceiptData, now: Date = new Date()): ReceiptPhase {
  if (order.rawStatus !== "pending_pickup") return "done";
  return isOrderOverdue(order.rawStatus, order.expiresAt.toISOString(), now.getTime()) ? "overdue" : "pending";
}

const number = new Intl.NumberFormat("th-TH");
const GREEN = "#15803d";
const GRAY = "#4b5563";

// A5 is 419.53 x 595.28 pt.
const MARGIN = 32;
const CONTENT_WIDTH = 419.53 - 2 * MARGIN;
const CELL_PADDING = 4; // pdfmake's default left/right cell padding
// Item table content widths: ชื่อ takes what the three number columns leave.
const NUMBER_COLUMNS = [40, 56, 60];
const NAME_WIDTH = CONTENT_WIDTH - NUMBER_COLUMNS.reduce((a, b) => a + b, 0) - 2 * CELL_PADDING * (NUMBER_COLUMNS.length + 1);
const BODY = 11;
// Measured widths and pdfmake's own layout can differ by rounding: keep a small margin.
const SLACK = 1;

/** Thai text pre-wrapped for `width` (pdfmake cannot break Thai between words by itself). */
function thai(text: string, width: number, size: number, bold = false): string {
  return wrapThai(text, width - SLACK, (t) => measureSarabun(t, size, bold ? "bold" : "normal"));
}

function line(label: string, value: string): Content {
  const labelWidth = 80;
  return {
    columns: [
      { width: labelWidth, text: label, color: GRAY },
      { width: "*", text: thai(value, CONTENT_WIDTH - labelWidth, BODY) },
    ],
    margin: [0, 0, 0, 2],
  };
}

function definition(order: ReceiptData, now: Date): TDocumentDefinitions {
  const phase = receiptPhase(order, now);
  const head = (text: string, alignment: "left" | "right" = "left") => ({ text, bold: true, fillColor: "#dcfce7", alignment });
  return {
    pageSize: "A5",
    pageOrientation: "portrait",
    pageMargins: MARGIN,
    info: { title: `ใบเสร็จ ${order.orderNo}`, author: "Green Campus" },
    defaultStyle: { font: "Sarabun", fontSize: BODY, lineHeight: 1.15 },
    content: [
      { text: "Green Campus", bold: true, fontSize: 13, color: GREEN },
      { text: "ใบเสร็จการแลกของรางวัล", bold: true, fontSize: 16, margin: [0, 0, 0, 10] },
      { text: "เลขที่ออเดอร์", color: GRAY, alignment: "center" },
      { text: order.orderNo, bold: true, fontSize: 30, alignment: "center", characterSpacing: 2, margin: [0, 0, 0, 10] },
      line("วันที่สั่ง", formatBangkok(order.createdAt.toISOString())),
      line("ชื่อนักเรียน", order.studentName),
      line("สถานะ", order.status),
      {
        margin: [0, 10, 0, 6],
        table: {
          headerRows: 1,
          widths: [NAME_WIDTH, ...NUMBER_COLUMNS],
          body: [
            [head("ชื่อ"), head("จำนวน", "right"), head("แต้ม/ชิ้น", "right"), head("รวม", "right")],
            ...order.items.map((item) => [
              { text: thai(item.name, NAME_WIDTH, BODY) },
              { text: number.format(item.qty), alignment: "right" as const },
              { text: number.format(item.unitCost), alignment: "right" as const },
              { text: number.format(item.qty * item.unitCost), alignment: "right" as const },
            ]),
          ],
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0,
          hLineColor: () => "#9ca3af",
        },
      },
      {
        columns: [
          { width: "*", text: "รวมทั้งหมด", bold: true },
          { width: "auto", text: `${number.format(order.totalPoints)} แต้ม`, bold: true, fontSize: 14 },
        ],
        margin: [CELL_PADDING, 0, CELL_PADDING, 12],
      },
      phase === "pending"
        ? { text: thai(`รับของที่แผนกก่อนวันที่ ${formatBangkok(order.expiresAt.toISOString())}`, CONTENT_WIDTH, BODY, true), bold: true }
        : phase === "overdue"
          ? { text: thai(OVERDUE_NOTICE_TH, CONTENT_WIDTH, BODY, true), bold: true }
          : { text: thai(`สถานะสุดท้าย: ${order.status}`, CONTENT_WIDTH, BODY, true), bold: true },
      // only an order that can still be picked up gets the "show this at the counter" footer
      ...(phase === "pending"
        ? [{ text: "แสดงใบนี้ที่แผนกเพื่อรับของ", color: GRAY, alignment: "center" as const, margin: [0, 18, 0, 0] as [number, number, number, number] }]
        : []),
    ],
  };
}

/** The receipt as PDF bytes. `now` decides pending vs overdue (tests pass a fixed time). */
export async function renderReceipt(order: ReceiptData, now: Date = new Date()): Promise<Uint8Array> {
  pdfmake.setFonts(PDF_FONTS);
  pdfmake.setUrlAccessPolicy(() => false);
  pdfmake.setLocalAccessPolicy((file) => file.startsWith(FONT_DIR));
  const buffer = await pdfmake.createPdf(definition(order, now)).getBuffer();
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}
