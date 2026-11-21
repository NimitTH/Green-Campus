// a11y follow-ups O1: the first tab stop of the staff and student shells. Hidden until it has keyboard focus;
// it moves focus to the layout's content wrapper (each page renders its own <main>, so the wrapper is the target).
export const MAIN_CONTENT_ID = "main-content";

export function SkipLink() {
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-md focus:bg-surface focus:px-4 focus:font-medium focus:text-accent focus:shadow-lg"
    >
      ข้ามไปเนื้อหา
    </a>
  );
}
