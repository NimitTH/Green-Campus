import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "ไม่พบบทความ | Green Campus" };

// Target of the Proxy rewrite for a missing / unpublished / malformed /articles/<slug> (see src/proxy.ts).
// It reaches notFound() while prerendering, so it stays static and is served with a real 404 status
// (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md). /articles/[slug] itself
// cannot: it is partially prerendered, its static shell starts streaming first and fixes the status at 200.
export default function ArticleNotFoundPage(): never {
  notFound();
}
