// Thai line breaking for pdfmake (see docs/pdf-library-decision.md). Thai has no spaces between
// words, and pdfmake's breaker (UAX #14) treats a run of Thai as one word: it then cuts the run at
// an arbitrary character. Sarabun has no zero-width space glyph, so ZWSP hints render as tofu.
// Instead we wrap ourselves: Intl.Segmenter finds the word boundaries, a width measure decides where
// each line ends, and the result carries explicit "\n" line breaks that pdfmake keeps as they are.

/** Width of `text` in the units of `maxWidth` (points, for the PDF). */
export type Measure = (text: string) => number;

const words = new Intl.Segmenter("th", { granularity: "word" });
const graphemes = new Intl.Segmenter("th", { granularity: "grapheme" });

function segments(text: string, segmenter: Intl.Segmenter): string[] {
  return Array.from(segmenter.segment(text), (s) => s.segment);
}

/** Lines of one paragraph (no "\n" inside). */
function wrapParagraph(text: string, maxWidth: number, measure: Measure): string[] {
  const lines: string[] = [];
  let line = "";
  const push = () => {
    const done = line.trimEnd();
    if (done) lines.push(done);
    line = "";
  };
  const add = (piece: string) => {
    const candidate = line + piece;
    if (measure(candidate.trimEnd()) <= maxWidth) {
      line = candidate;
      return;
    }
    push();
    if (!piece.trim()) return; // a space at a line break is dropped
    if (measure(piece) <= maxWidth) {
      line = piece;
      return;
    }
    // A single word wider than the line: cut it between grapheme clusters, so a tone mark or
    // vowel never leaves its consonant.
    for (const g of segments(piece, graphemes)) {
      if (line && measure(line + g) > maxWidth) push();
      line += g;
    }
  };
  for (const piece of segments(text, words)) add(piece);
  push();
  return lines.length > 0 ? lines : [""];
}

/** `text` with "\n" inserted at Thai word boundaries so no line is wider than `maxWidth`. */
export function wrapThai(text: string, maxWidth: number, measure: Measure): string {
  return text
    .split(/\r?\n/)
    .flatMap((p) => wrapParagraph(p, maxWidth, measure))
    .join("\n");
}
