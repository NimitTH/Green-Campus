import { readFileSync } from "node:fs";
import path from "node:path";
import * as fontkit from "fontkit";

// Sarabun (SIL OFL 1.1, google/fonts ofl/sarabun; OFL.txt next to the files) for every PDF.
// The files live next to this module under src/lib/pdf/fonts, not in public/: public/ is served by
// the CDN and is not part of a Vercel function. They are read from process.cwd() (the project root,
// locally and inside the function) and next.config.ts outputFileTracingIncludes adds them to the
// trace of every route that renders a PDF.

export const FONT_DIR = path.join(process.cwd(), "src", "lib", "pdf", "fonts");
const FILE_NAMES = { normal: "Sarabun-Regular.ttf", bold: "Sarabun-Bold.ttf" } as const;
export const SARABUN_FILES = {
  normal: path.join(FONT_DIR, FILE_NAMES.normal),
  bold: path.join(FONT_DIR, FILE_NAMES.bold),
} as const;

/** pdfmake font dictionary: family "Sarabun" (no italic files, italics fall back to upright). */
export const PDF_FONTS = {
  Sarabun: {
    normal: SARABUN_FILES.normal,
    bold: SARABUN_FILES.bold,
    italics: SARABUN_FILES.normal,
    bolditalics: SARABUN_FILES.bold,
  },
};

type Weight = "normal" | "bold";
const loaded: Partial<Record<Weight, fontkit.Font>> = {};

function font(weight: Weight): fontkit.Font {
  const cached = loaded[weight];
  if (cached) return cached;
  // Spelled out from process.cwd() so the build traces only this folder (not the whole project).
  const opened = fontkit.create(readFileSync(path.join(process.cwd(), "src", "lib", "pdf", "fonts", FILE_NAMES[weight]))) as fontkit.Font;
  loaded[weight] = opened;
  return opened;
}

/** Width in points of `text` set in Sarabun at `size` pt, shaped the way the PDF will draw it. */
export function measureSarabun(text: string, size: number, weight: Weight = "normal"): number {
  const f = font(weight);
  return (f.layout(text).advanceWidth * size) / f.unitsPerEm;
}
