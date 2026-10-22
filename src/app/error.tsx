"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import { ErrorView } from "./_components/error-view";

// Root segment boundary (R143). Next 16.3+: `retry` re-fetches and re-renders the segment (preferred over
// `reset`, see node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md).
// The root layout stays, so globals.css and the Sarabun font still apply.
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return <ErrorView onRetry={retry} digest={error.digest} />;
}
