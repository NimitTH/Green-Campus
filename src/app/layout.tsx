import type { Metadata, Viewport } from "next";
import { Sarabun } from "next/font/google";
import "./globals.css";

const sarabun = Sarabun({
  variable: "--font-sarabun",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Green Campus",
  description: "ระบบจัดการขยะในวิทยาลัย",
};

// viewport-fit=cover makes env(safe-area-inset-*) non-zero on notched phones, so the student bottom nav's
// safe-area padding takes effect (docs: 04-functions/generate-viewport.md). width / initial-scale are the
// defaults, kept explicit.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      className={`${sarabun.variable} font-sans h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
