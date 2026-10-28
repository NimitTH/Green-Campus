import Link from "next/link";
import { Card, Mono } from "@/components/ui";
import type { PublicArticleSummary } from "@/lib/articles/public";
import { formatBangkok } from "@/lib/datetime";
import { HOME_CONTAINER, HOME_SECTION, SectionHeading } from "./section-heading";

/** 07: the four newest articles pinned on dotted paper. Hidden entirely when empty or not loaded. */
export function ArticlesSection({ articles }: { articles: PublicArticleSummary[] | null }) {
  if (!articles || articles.length === 0) return null;
  return (
    <section aria-labelledby="home-articles" className={`paper-dots paper-torn [--torn-bg:var(--paper)] ${HOME_SECTION}`}>
      <div className={HOME_CONTAINER}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading id="articles" num="07" kicker="บทความ" title="บทความล่าสุด" />
          <Link
            href="/articles"
            className="inline-flex min-h-11 items-center font-semibold text-accent underline-offset-4 hover:underline"
          >
            ดูบทความทั้งหมด →
          </Link>
        </div>
        <ul className="mt-8 grid gap-6 min-[400px]:grid-cols-2 lg:grid-cols-4">
          {articles.slice(0, 4).map((a) => (
            <Card as="li" flush deco="pin" tilt key={a.id} className="min-w-0">
              <Link
                href={`/articles/${a.slug}`}
                className="block h-full rounded-card p-2.5 pb-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {a.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- public Supabase Storage URL, already resized in the browser
                  <img src={a.coverUrl} alt="" loading="lazy" className="aspect-[4/3] w-full rounded-input object-cover" />
                ) : (
                  <div aria-hidden="true" className="grid aspect-[4/3] place-items-center rounded-input bg-accent-soft text-4xl">
                    🌱
                  </div>
                )}
                <h3 className="mx-1 mt-2.5 line-clamp-3 font-display text-[1.0625rem] leading-[1.4] font-semibold break-words text-ink">{a.title}</h3>
                <p className="mx-1 mt-0.5 text-[0.8125rem] text-muted">
                  <Mono text={formatBangkok(a.createdAt)} />
                </p>
              </Link>
            </Card>
          ))}
        </ul>
      </div>
    </section>
  );
}
