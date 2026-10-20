import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  // PDF routes (Task 14): pdfmake/pdfkit read their own data files from node_modules at runtime, so
  // they are loaded with require() instead of being bundled, and the Sarabun files that
  // src/lib/pdf/fonts.ts reads from disk are added to the function trace (public/ is not in it).
  serverExternalPackages: ["pdfmake"],
  outputFileTracingIncludes: {
    "/api/receipts/*": ["./src/lib/pdf/fonts/*.ttf"],
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
