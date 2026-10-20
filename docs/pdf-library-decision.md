# PDF library decision (Task 14, R84–R86)

**Choice: `pdfmake` 0.3.12** (pdfkit 0.20.2, fontkit 2.0.4), with Thai line breaking done by our own
`src/lib/pdf/thai-wrap.ts`. Task 17's report PDF uses the same library and the same helpers:
`src/lib/pdf/fonts.ts` and `src/lib/pdf/thai-wrap.ts`.

## Requirements (spec §2, §10.2, §10.3)

- Sarabun is embedded.
- Output is vector, from a plain Node function on Vercel, with no headless browser.
- The receipt and the report use the same library.
- Thai renders correctly:
  - no tofu boxes
  - upper vowels and tone marks stack on the right consonant
  - sara am (ำ) is correct
  - lines break between words

## Method

- **Test strings.**
  - Short: "ที่ น้ำ ผู้ ก็ เก็บขยะ ปลูกต้นไม้ ญี่ปุ่น ฤๅษี ปั้น กุ้ง", regular and bold, at 22 pt.
  - Long: a 160-character sentence with no spaces, in a 300 pt box at 14 pt.
- **Generation.** [`docs/pdf-spike/spike.mjs`](pdf-spike/spike.mjs) makes one PDF per library.
- **Rendering.** Poppler is not installed (R84), so [`docs/pdf-spike/pdf-to-png.mjs`](pdf-spike/pdf-to-png.mjs) does it instead: Playwright's Chromium draws page 1 with pdfjs-dist 6.4.299 onto a canvas and takes a screenshot.
- **Inspection.** I checked the PNGs by eye and then at 5× zoom.
- **Diagnosis.** pdfjs's operator list showed where each glyph is drawn, and fontkit's shaping output was dumped for the failing clusters.

| Library | Version | PNG |
|---|---|---|
| @react-pdf/renderer | 4.9.0 (React 19 peer OK) | [`pdf-spike/react-pdf.png`](pdf-spike/react-pdf.png) |
| pdfmake | 0.3.12 | [`pdf-spike/pdfmake.png`](pdf-spike/pdfmake.png) |
| (result) receipt | pdfmake 0.3.12 | [`pdf-spike/receipt-sample.png`](pdf-spike/receipt-sample.png) |

## What each PNG shows

### @react-pdf/renderer 4.9.0: fails (tone marks)

- **Shaping.**
  - No tofu.
  - ที่ น้ำ ผู้ ก็ ปั้น กุ้ง and the bold line look right.
  - ฤๅ comes out as the font's ligature.
- **Tone-mark failure.** The mai ek of **ญี่ปุ่น is missing**: it reads "ญี่ปุน". The same happens with ปู่ and ปุ่น on their own.
  - Cause: textkit already gives glyph positions in points. `@react-pdf/render` (`renderGlyphs`) then multiplies the GPOS `xOffset`/`yOffset` by `fontSize/1000` again.
  - So every mark-positioning offset shrinks to almost zero. Sarabun moves the mai ek on ปุ่ 139 units to the left, clear of ป's tall stem. Without that shift it is drawn on top of the stem tip and disappears.
  - The same applies to any GPOS mark offset, so it is a correctness bug for Thai.
  - It cannot be fixed without patching node_modules.
- **Line breaking.**
  - (A) Raw text does not wrap at all: the line overflows the box.
  - (B) With `Intl.Segmenter` + ZWSP it wraps between words, but adds a visible "-" at every break (hyphenation). A `Font.registerHyphenationCallback` would remove that, but the tone-mark bug stays.

### pdfmake 0.3.12: passes, with our line breaking

- **Shaping is correct.** pdfkit applies the GPOS offsets properly.
  - ญี่ปุ่น keeps its mai ek, to the left of ป's stem.
  - น้ำ: the nikhahit sits under the mai tho, then sara aa.
  - ปั้น and กุ้ง stack correctly. ก็ is right. ฤๅ is the font's ligature.
  - No tofu in the shaped text.
- **(A) Raw text: wrong.** pdfmake's breaker (the `linebreak` package, UAX #14) treats a Thai run as one word. It then cuts it at any character ("…และ" → "แล|ะ", "บรรย|ากาศ").
- **(B) ZWSP: tofu.** Sarabun has no glyph for U+200B (or U+200C/D, U+2060, U+FEFF), so each ZWSP is drawn as a .notdef box.
- **(C) `wrapThai`: correct.**
  - `Intl.Segmenter('th', {granularity: 'word'})` finds the word boundaries.
  - Each candidate line is measured with fontkit, with the same font, size and shaping that pdfkit uses.
  - Explicit `\n` breaks are inserted. pdfmake keeps them.
  - A word wider than the line is cut between grapheme clusters, so a mark never leaves its consonant.
  - The result wraps at word boundaries with no tofu and no hyphens.

## Decision and why

- **pdfmake is chosen.** It is the only candidate that positions Thai marks correctly. Positioning is the hard part, and we cannot fix it from outside the library. Line breaking we can control, and `wrapThai` solves it in about 50 lines (unit tested: `thai-wrap.test.ts`).
- **No third candidate.** Both libraries are pdfkit/fontkit based, but only pdfmake's rendering path is correct. pdfmake also passes every criterion once the documented line-breaking step is added.
- **Dependencies.**
  - @react-pdf/renderer was uninstalled after the spike.
  - `fontkit` is now a direct dependency (it measures text for `wrapThai`). It is the same 2.0.4 that pdfkit uses, deduped.
  - `pdfjs-dist` is a devDependency, used for tests and the spike renderer only.
- **Costs of this choice.** Layout code must pass a width to `thai()` / `wrapThai` for every Thai text block: the page content width, or a table column's fixed width. The receipt uses fixed table widths for this reason.

## Known limitation: copying sara am (ำ)

- **The defect.** pdfkit writes one ToUnicode entry per glyph. Sarabun shapes ำ as nikhahit (fused with any tone mark) + sara aa, and the sara aa glyph maps back to "า". So text copied from the PDF reads "น้ำา" for "น้ำ".
- **What is not affected.** Search for "น้ำ" still matches, and what you see on the page is correct.
- **Why the obvious fix fails.** Disabling `ccmp` keeps ำ as one glyph, but then the nikhahit collides with a tone mark.
- **How the tests handle it.** The vitest folds "ำา" back to "ำ" before comparing extracted text (`receipt.test.ts`).

## Fonts (R86)

- **Files.** `src/lib/pdf/fonts/Sarabun-Regular.ttf`, `src/lib/pdf/fonts/Sarabun-Bold.ttf`, and `src/lib/pdf/fonts/OFL.txt` (SIL Open Font License 1.1).
- **Source.**
  - Downloaded from https://github.com/google/fonts/tree/main/ofl/sarabun as raw files, at commit `88058c714073e72bb1b32baffc2d4ce9bc73944c` (2026-03-12).
  - Font version "Version 1.000; ttfautohint (v1.6)". Copyright 2018 The Sarabun Project Authors.
  - The git blob SHAs match the repository listing: Regular `161c9ac9…`, Bold `7e5d7680…`, OFL `a7d3a126…`.
- **Why `src/lib/pdf/fonts` and not `public/fonts`.**
  - `public/` is served by the CDN, and nothing guarantees it is in the serverless function bundle.
  - `fonts.ts` reads the files from `process.cwd()/src/lib/pdf/fonts`, the project root both locally and in a Vercel function.
  - `next.config.ts` adds them with `outputFileTracingIncludes` (`/api/receipts/*`). Add Task 17's report route there too.
  - Checked: after `npm run build`, `.next/server/app/api/receipts/[orderId]/route.js.nft.json` lists both TTFs and the pdfkit AFM/ICC data files.
  - The production server (`npm start`) served the receipt route's e2e suite.
- **`serverExternalPackages: ["pdfmake"]`.** pdfkit reads its own data files from `__dirname` at runtime, so it is loaded with `require()` rather than bundled.
