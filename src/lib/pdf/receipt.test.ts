import { describe, expect, it } from "vitest";
import pdfmake from "pdfmake";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { receiptPhase, renderReceipt, type ReceiptData } from "./receipt";

// R89: no poppler here, so pdfjs-dist reads the PDF back (text and embedded font names).

const LONG_NAME = "ชุดปลูกต้นไม้ในกระถางรีไซเคิลพร้อมเมล็ดพันธุ์ผักสวนครัวและคู่มือการดูแลสำหรับนักเรียน";
const order: ReceiptData = {
  orderNo: "A1B2C3D4",
  createdAt: new Date("2026-10-21T03:15:00Z"),
  studentName: "เด็กหญิงญี่ปุ่น ฤๅษี",
  status: "รอเตรียมของ",
  rawStatus: "pending_pickup",
  readyAt: null,
  expiresAt: new Date("2026-10-28T10:00:00Z"),
  items: [
    { name: "กระบอกน้ำ", qty: 2, unitCost: 1200 },
    { name: "ถุงผ้าปั้นกุ้ง", qty: 1, unitCost: 30 },
    { name: LONG_NAME, qty: 3, unitCost: 15 },
  ],
  totalPoints: 2475,
};
// Before the deadline (2026-10-28T10:00Z); OVERDUE is after it.
const NOW = new Date("2026-10-22T00:00:00Z");
const OVERDUE = new Date("2026-10-29T00:00:00Z");

// Whitespace and zero-width characters are layout, not content. pdfkit draws sara am (U+0E33) the
// way the font shapes it, nikhahit + sara aa, and its ToUnicode map gives the sara aa glyph back as an
// extra U+0E32, so "น้ำ" extracts as "น้ำา" (docs/pdf-library-decision.md). The page looks right.
const cp = (...codes: number[]) => String.fromCodePoint(...codes);
const ZERO_WIDTH = new RegExp(`[\\s${cp(0x200b, 0x200c, 0x200d, 0x2060, 0xfeff)}]`, "g");
const SARA_AM = cp(0x0e33);
const SARA_AA = cp(0x0e32);
const normalise = (s: string) => s.replace(ZERO_WIDTH, "").replaceAll(SARA_AM + SARA_AA, SARA_AM);

type FontInfo = { name: string; missingFile: boolean };

async function readBack(bytes: Uint8Array): Promise<{ text: string; fonts: string[]; fontInfo: FontInfo[] }> {
  const task = getDocument({ data: bytes.slice(), useSystemFonts: false, fontExtraProperties: true });
  const doc = await task.promise;
  let text = "";
  const fonts = new Set<string>();
  const fontInfo = new Map<string, FontInfo>();
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    text += content.items.map((i) => ("str" in i ? i.str : "")).join("");
    const ops = await page.getOperatorList();
    ops.fnArray.forEach((fn, i) => {
      if (fn !== OPS.setFont) return;
      // fontExtraProperties keeps missingFile: false only when the font program is in the PDF.
      const font = page.commonObjs.get(ops.argsArray[i][0]) as { name?: string; missingFile?: boolean };
      if (font?.name) {
        fonts.add(font.name);
        fontInfo.set(font.name, { name: font.name, missingFile: font.missingFile !== false });
      }
    });
  }
  await task.destroy();
  return { text: normalise(text), fonts: [...fonts], fontInfo: [...fontInfo.values()] };
}

describe("renderReceipt", () => {
  it("returns PDF bytes", async () => {
    const bytes = await renderReceipt(order, NOW);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("embeds a Sarabun font and contains the order number and every Thai item name", async () => {
    const { text, fonts, fontInfo } = await readBack(await renderReceipt(order, NOW));
    expect(fonts.some((f) => f.includes("Sarabun"))).toBe(true);
    // every font drawn is an embedded Sarabun subset, not a reference to a font the viewer may lack
    expect(fontInfo.length).toBeGreaterThan(0);
    for (const f of fontInfo) {
      expect(f.name).toContain("Sarabun");
      expect(f.missingFile).toBe(false);
    }
    expect(text).toContain("A1B2C3D4");
    for (const item of order.items) expect(text).toContain(normalise(item.name));
    expect(text).toContain("ใบเสร็จการแลกของรางวัล");
    expect(text).toContain("GreenCampus");
    expect(text).toContain(normalise(order.studentName));
    expect(text).toContain("2,475"); // th-TH number format
    expect(text).toContain("รับของที่แผนกก่อนวันที่");
    expect(text).toContain("แสดงใบนี้ที่แผนกเพื่อรับของ");
  });

  it("shows the final status instead of the pickup deadline once the order is done", async () => {
    const { text } = await readBack(await renderReceipt({ ...order, status: "รับแล้ว", rawStatus: "completed" }, NOW));
    expect(text).not.toContain("รับของที่แผนกก่อนวันที่");
    expect(text).not.toContain("แสดงใบนี้ที่แผนกเพื่อรับของ");
    expect(text).toContain("รับแล้ว");
  });

  it("says the order is overdue (no pickup line, no footer) once a pending order is past its deadline", async () => {
    const { text } = await readBack(await renderReceipt(order, OVERDUE));
    expect(text).toContain(normalise("เลยกำหนดรับแล้ว ระบบจะคืนแต้มให้อัตโนมัติ"));
    expect(text).not.toContain("รับของที่แผนกก่อนวันที่");
    expect(text).not.toContain("แสดงใบนี้ที่แผนกเพื่อรับของ");
  });

  it("decides the phase from the raw status, the deadline and now (not the Thai label)", () => {
    expect(receiptPhase(order, NOW)).toBe("pending");
    expect(receiptPhase({ ...order, status: "พร้อมรับ", readyAt: new Date("2026-10-21T04:00:00Z") }, NOW)).toBe("pending");
    expect(receiptPhase(order, OVERDUE)).toBe("overdue");
    expect(receiptPhase({ ...order, status: "รอเตรียมของ", rawStatus: "completed" }, NOW)).toBe("done");
    expect(receiptPhase({ ...order, rawStatus: "expired", status: "หมดอายุ" }, OVERDUE)).toBe("done");
  });
});

describe("readBack font check", () => {
  it("reports a non-embedded standard font as missing (so the embedded check above can fail)", async () => {
    pdfmake.setFonts({ Helvetica: { normal: "Helvetica", bold: "Helvetica-Bold", italics: "Helvetica", bolditalics: "Helvetica-Bold" } });
    pdfmake.setUrlAccessPolicy(() => false);
    pdfmake.setLocalAccessPolicy((file) => file.startsWith("Helvetica")); // standard 14 names, no files
    const buffer = await pdfmake.createPdf({ content: ["hello"], defaultStyle: { font: "Helvetica" } }).getBuffer();
    const { fontInfo } = await readBack(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength));
    expect(fontInfo.length).toBeGreaterThan(0);
    expect(fontInfo.every((f) => f.missingFile)).toBe(true);
  });
});
