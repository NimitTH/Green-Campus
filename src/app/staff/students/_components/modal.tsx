"use client";

import { useEffect, useRef } from "react";

// A confirm dialog for the account commands (DESIGN-4 6.2), built on the native <dialog> with showModal(): the page
// behind is inert, focus moves into the dialog and Escape closes it (the "close" event calls onClose). No dependency.
// While `busy` (a command is in flight) Escape is ignored, so a late result never lands in a closed dialog (review M1).
export function Modal({
  open,
  onClose,
  labelledBy,
  busy = false,
  children,
}: {
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  labelledBy: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onClose={onClose}
      onCancel={(e) => {
        if (busy) e.preventDefault();
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-card border border-rule bg-surface p-5 text-ink shadow-cast backdrop:bg-black/50"
    >
      {open ? children : null}
    </dialog>
  );
}
