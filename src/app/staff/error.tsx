"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import { ErrorView } from "../_components/error-view";

// Staff segment boundary (R143): it wraps the staff pages only, so the staff layout (header, bell, sidebar /
// drawer) stays around the message. Errors in the staff layout itself go to app/error.tsx.
export default function StaffError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return <ErrorView onRetry={retry} homeHref="/staff" homeLabel="กลับหน้าครูและผู้ดูแล" digest={error.digest} />;
}
