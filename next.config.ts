import type { NextConfig } from "next";

// The Sarabun files every PDF route reads at runtime (src/lib/pdf/fonts.ts).
const PDF_FONT_FILES = ["./src/lib/pdf/fonts/*.ttf"];

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  // PDF routes (Task 14): pdfmake/pdfkit and fontkit read their own data files from node_modules at
  // runtime, so they are loaded with require() instead of being bundled, and the Sarabun files that
  // src/lib/pdf/fonts.ts reads from disk are added to the function trace (public/ is not in it).
  // Every route that renders a PDF must match a key below: the receipt today, the reports (phase 3)
  // under /api/reports/. Add a key here for any other PDF route.
  serverExternalPackages: ["pdfmake", "fontkit"],
  outputFileTracingIncludes: {
    "/api/receipts/*": PDF_FONT_FILES,
    "/api/reports/**": PDF_FONT_FILES,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
