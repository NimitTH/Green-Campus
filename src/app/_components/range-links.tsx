import Link from "next/link";

export type RangeLink = { href: string; label: string; current: boolean };

/** Round 6 (old-site features 2): a row of range choices as links (kept in the URL); the current one is marked. */
export function RangeLinks({ label, items, className = "" }: { label: string; items: RangeLink[]; className?: string }) {
  return (
    <nav aria-label={label} className={className}>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.current ? "page" : undefined}
              className={`inline-flex items-center rounded-full border px-3 py-1 text-sm max-md:min-h-11 ${
                item.current ? "border-accent bg-accent-soft font-semibold text-accent" : "border-rule text-ink hover:border-accent hover:text-accent"
              }`}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
