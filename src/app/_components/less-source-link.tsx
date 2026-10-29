// TGO LESS-WM-01 v06, the source of every carbon figure on the public pages (DESIGN-3 3.4).
export const LESS_URL = "https://ghgreduction.tgo.or.th/th/calculation/less-calculate-document/less-waste/item/548-less-wm-01.html";

/** External link to the LESS-WM-01 document: link icon + underlined text, opens in a new tab. */
export function LessSourceLink({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <a
      href={LESS_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-baseline gap-1 underline underline-offset-2 hover:text-accent ${className}`}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5 shrink-0 self-center" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
      <span>{children}</span>
    </a>
  );
}
