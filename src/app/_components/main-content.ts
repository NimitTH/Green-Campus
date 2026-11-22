// The skip link's target (a11y follow-ups O1): spread onto each layout's content wrapper. Server-safe (no "use client"),
// so the layouts can import it as a plain object.
export const MAIN_CONTENT_ATTR = "data-main-content";

export const mainContentProps = { [MAIN_CONTENT_ATTR]: "", tabIndex: -1 } as const;
