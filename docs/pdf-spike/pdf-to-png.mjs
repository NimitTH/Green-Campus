// Render page 1 of a PDF to a PNG with pdfjs-dist on a canvas in Playwright's Chromium (R84/R85:
// no poppler on this machine). Usage: node docs/pdf-spike/pdf-to-png.mjs <in.pdf> <out.png> [scale]
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";

const [input, output, scaleArg] = process.argv.slice(2);
if (!input || !output) {
  console.error("usage: node docs/pdf-spike/pdf-to-png.mjs <in.pdf> <out.png> [scale]");
  process.exit(1);
}
const require = createRequire(import.meta.url);
const build = (f) => readFileSync(require.resolve(`pdfjs-dist/build/${f}`));
const ORIGIN = "http://pdf.local";

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1700 } });
  await page.route(`${ORIGIN}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/") return route.fulfill({ contentType: "text/html", body: "<!doctype html><body style='margin:0;background:#fff'><canvas id='c'></canvas></body>" });
    if (path === "/doc.pdf") return route.fulfill({ contentType: "application/pdf", body: readFileSync(input) });
    if (path === "/pdf.mjs" || path === "/pdf.worker.mjs") return route.fulfill({ contentType: "text/javascript", body: build(path.slice(1)) });
    return route.fulfill({ status: 404 });
  });
  await page.goto(`${ORIGIN}/`);
  await page.evaluate(async (scale) => {
    const pdfjs = await import("/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";
    const doc = await pdfjs.getDocument({ url: "/doc.pdf", disableFontFace: false }).promise;
    const p = await doc.getPage(1);
    const viewport = p.getViewport({ scale });
    const canvas = document.getElementById("c");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await p.render({ canvas, canvasContext: canvas.getContext("2d"), viewport }).promise;
  }, Number(scaleArg ?? 2));
  await page.locator("#c").screenshot({ path: output });
  console.log(`wrote ${output}`);
} finally {
  await browser.close();
}
