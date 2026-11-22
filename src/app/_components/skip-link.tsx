"use client";

import type { MouseEvent } from "react";
import { MAIN_CONTENT_ATTR } from "./main-content";

// a11y follow-ups O1: the first tab stop of the staff and student shells, hidden until it has keyboard focus.
// It focuses the layout's content wrapper. Moving between the staff and student layouts keeps the other layout
// mounted but hidden (<Activity>), so the target is a data attribute (never a duplicate id) and the link picks
// the copy that is visible. preventDefault: no "#" entry in the history.
function focusVisibleContent(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
  const targets = Array.from(document.querySelectorAll<HTMLElement>(`[${MAIN_CONTENT_ATTR}]`));
  targets.find((el) => el.checkVisibility())?.focus();
}

export function SkipLink() {
  return (
    <a
      href="#"
      onClick={focusVisibleContent}
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-md focus:bg-surface focus:px-4 focus:font-medium focus:text-accent focus:shadow-lg"
    >
      ข้ามไปเนื้อหา
    </a>
  );
}
