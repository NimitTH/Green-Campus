// R85 spike: render the Thai test strings with each candidate library, then turn page 1 into a PNG
// with pdf-to-png.mjs. Usage (from the project root):
//   node docs/pdf-spike/spike.mjs <out-dir>
//   node docs/pdf-spike/pdf-to-png.mjs <out-dir>/pdfmake.pdf docs/pdf-spike/pdfmake.png
// @react-pdf/renderer was removed after the spike (docs/pdf-library-decision.md); its part runs only
// when it is installed again (npm install --no-save @react-pdf/renderer@4.9.0).
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const out = process.argv[2];
if (!out) {
  console.error("usage: node docs/pdf-spike/spike.mjs <out-dir>");
  process.exit(1);
}
const FONTS = path.resolve("src/lib/pdf/fonts");
const reg = path.join(FONTS, "Sarabun-Regular.ttf");
const bold = path.join(FONTS, "Sarabun-Bold.ttf");

const TEST = "ที่ น้ำ ผู้ ก็ เก็บขยะ ปลูกต้นไม้ ญี่ปุ่น ฤๅษี ปั้น กุ้ง";
const LONG =
  "โรงเรียนของเราร่วมกันเก็บขยะรอบสนามฟุตบอลและปลูกต้นไม้ริมรั้วเพื่อลดคาร์บอนไดออกไซด์ในบรรยากาศ" +
  "นักเรียนที่เข้าร่วมกิจกรรมจะได้รับแต้มสะสมไปแลกของรางวัลที่แผนกกิจการนักเรียน";
const seg = new Intl.Segmenter("th", { granularity: "word" });
const ZWSP = String.fromCodePoint(0x200b);
const withZwsp = (s) => Array.from(seg.segment(s), (x) => x.segment).join(ZWSP);

// @react-pdf/renderer --------------------------------------------------------------------------
let reactPdf = null;
try {
  reactPdf = await import(pathToFileURL(require.resolve("@react-pdf/renderer")).href);
} catch {
  console.log("@react-pdf/renderer not installed: skipped");
}
if (reactPdf) {
  const React = require("react");
  const { Document, Page, Text, View, Font, renderToBuffer } = reactPdf;
  Font.register({ family: "Sarabun", fonts: [{ src: reg }, { src: bold, fontWeight: 700 }] });
  const h = React.createElement;
  const box = { width: 300, borderWidth: 1, borderColor: "#999", padding: 4, marginBottom: 8 };
  const doc = h(
    Document,
    null,
    h(
      Page,
      { size: "A5", style: { fontFamily: "Sarabun", fontSize: 14, padding: 24 } },
      h(Text, { style: { fontWeight: 700, fontSize: 18 } }, "@react-pdf/renderer"),
      h(Text, { style: { fontSize: 22 } }, TEST),
      h(Text, { style: { fontWeight: 700, fontSize: 22 } }, TEST),
      h(Text, null, "A) raw long sentence (no ZWSP):"),
      h(View, { style: box }, h(Text, null, LONG)),
      h(Text, null, "B) Intl.Segmenter + ZWSP:"),
      h(View, { style: box }, h(Text, null, withZwsp(LONG))),
    ),
  );
  writeFileSync(path.join(out, "react-pdf.pdf"), await renderToBuffer(doc));
}

// pdfmake ---------------------------------------------------------------------------------------
{
  const pdfmake = require("pdfmake");
  const fontkit = require("fontkit");
  const { wrapThai } = await import(pathToFileURL(path.resolve("src/lib/pdf/thai-wrap.ts")).href);
  const regular = fontkit.openSync(reg);
  const measure = (size) => (t) => (regular.layout(t).advanceWidth * size) / regular.unitsPerEm;
  pdfmake.setUrlAccessPolicy(() => false);
  pdfmake.setLocalAccessPolicy((p) => p.startsWith(FONTS));
  pdfmake.setFonts({ Sarabun: { normal: reg, bold, italics: reg, bolditalics: bold } });
  const cell = (text) => ({ table: { widths: [292], body: [[text]] }, margin: [0, 0, 0, 8] });
  const doc = {
    pageSize: "A5",
    pageMargins: 24,
    defaultStyle: { font: "Sarabun", fontSize: 14 },
    content: [
      { text: "pdfmake", bold: true, fontSize: 18 },
      { text: TEST, fontSize: 22 },
      { text: TEST, fontSize: 22, bold: true },
      "A) raw long sentence (no ZWSP):",
      cell(LONG),
      "B) Intl.Segmenter + ZWSP:",
      cell(withZwsp(LONG)),
      "C) wrapThai (Intl.Segmenter + measured line breaks):",
      cell(wrapThai(LONG, 291, measure(14))),
    ],
  };
  writeFileSync(path.join(out, "pdfmake.pdf"), await pdfmake.createPdf(doc).getBuffer());
}
console.log(`wrote PDFs to ${out}`);
