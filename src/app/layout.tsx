import type { Metadata, Viewport } from "next";
import { Geist_Mono, IBM_Plex_Sans_Thai, Sarabun } from "next/font/google";
import { THEME_INIT_SCRIPT } from "@/components/ui/theme";
import "./globals.css";

const sarabun = Sarabun({
  variable: "--font-sarabun",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const plexThai = IBM_Plex_Sans_Thai({
  variable: "--font-plex-thai",
  subsets: ["thai", "latin"],
  weight: ["600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "600"],
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
      suppressHydrationWarning
      className={`${sarabun.variable} ${plexThai.variable} ${geistMono.variable} font-sans h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
