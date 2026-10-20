import { describe, expect, it } from "vitest";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { isPendingLabel, renderReceipt, type ReceiptData } from "./receipt";

// R89: no poppler here, so pdfjs-dist reads the PDF back (text and embedded font names).

const LONG_NAME = "ชุดปลูกต้นไม้ในกระถางรีไซเคิลพร้อมเมล็ดพันธุ์ผักสวนครัวและคู่มือการดูแลสำหรับนักเรียน";
const order: ReceiptData = {
  orderNo: "A1B2C3D4",
  createdAt: new Date("2026-10-21T03:15:00Z"),
  studentName: "เด็กหญิงญี่ปุ่น ฤๅษี",
  status: "รอเตรียมของ",
  expiresAt: new Date("2026-10-28T10:00:00Z"),
  items: [
    { name: "กระบอกน้ำ", qty: 2, unitCost: 1200 },
    { name: "ถุงผ้าปั้นกุ้ง", qty: 1, unitCost: 30 },
    { name: LONG_NAME, qty: 3, unitCost: 15 },
  ],
  totalPoints: 2475,
};

// Whitespace and zero-width characters are layout, not content. pdfkit draws sara am (U+0E33) the
// way the font shapes it, nikhahit + sara aa, and its ToUnicode map gives the sara aa glyph back as an
// extra U+0E32, so "น้ำ" extracts as "น้ำา" (docs/pdf-library-decision.md). The page looks right.
const cp = (...codes: number[]) => String.fromCodePoint(...codes);
const ZERO_WIDTH = new RegExp(`[\\s${cp(0x200b, 0x200c, 0x200d, 0x2060, 0xfeff)}]`, "g");
const SARA_AM = cp(0x0e33);
const SARA_AA = cp(0x0e32);
const normalise = (s: string) => s.replace(ZERO_WIDTH, "").replaceAll(SARA_AM + SARA_AA, SARA_AM);

async function readBack(bytes: Uint8Array): Promise<{ text: string; fonts: string[] }> {
  const task = getDocument({ data: bytes.slice(), useSystemFonts: false, fontExtraProperties: true });
  const doc = await task.promise;
  let text = "";
  const fonts = new Set<string>();
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    text += content.items.map((i) => ("str" in i ? i.str : "")).join("");
    const ops = await page.getOperatorList();
    ops.fnArray.forEach((fn, i) => {
      if (fn !== OPS.setFont) return;
      const font = page.commonObjs.get(ops.argsArray[i][0]) as { name?: string };
      if (font?.name) fonts.add(font.name);
    });
  }
  await task.destroy();
  return { text: normalise(text), fonts: [...fonts] };
}

describe("renderReceipt", () => {
  it("returns PDF bytes", async () => {
    const bytes = await renderReceipt(order);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("embeds a Sarabun font and contains the order number and every Thai item name", async () => {
    const { text, fonts } = await readBack(await renderReceipt(order));
    expect(fonts.some((f) => f.includes("Sarabun"))).toBe(true);
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
    const { text } = await readBack(await renderReceipt({ ...order, status: "รับแล้ว" }));
    expect(text).not.toContain("รับของที่แผนกก่อนวันที่");
    expect(text).toContain("รับแล้ว");
  });

  it("treats only the pending labels as pending", () => {
    expect(isPendingLabel("รอเตรียมของ")).toBe(true);
    expect(isPendingLabel("พร้อมรับ")).toBe(true);
    expect(isPendingLabel("รับแล้ว")).toBe(false);
    expect(isPendingLabel("หมดอายุ")).toBe(false);
  });
});
