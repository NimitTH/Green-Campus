import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui";
import { HeroArt } from "./hero-art";

/** Binder holes down the left edge of the hero page. */
function BinderHoles() {
  return (
    <div data-deco aria-hidden="true" className="pointer-events-none absolute top-14 left-2.5 grid gap-24 md:left-3.5">
      {[0, 1, 2].map((i) => (
        <span key={i} className="block size-4 rounded-full bg-paper-2 shadow-[inset_1px_2px_3px_color-mix(in_oklab,var(--shadow-color)_22%,transparent)]" />
      ))}
    </div>
  );
}

/**
 * The opening notebook page: kicker, h1 with the marker stroke, lede, the two actions and the school totals
 * (`stats`, streamed by page.tsx inside its own Suspense). The picture sits on the right from lg, on top below.
 */
export function Hero({ stats }: { stats: ReactNode }) {
  return (
    <section aria-labelledby="home-hero" className="paper-ruled relative overflow-x-clip">
      <BinderHoles />
      <div className="mx-auto grid w-full max-w-[70rem] items-center gap-10 pt-9 pr-4 pb-14 pl-14 sm:pt-12 md:pr-6 md:pl-16 lg:grid-cols-[1.15fr_0.85fr] lg:gap-6 lg:py-16">
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold text-accent">ระบบจัดการขยะในวิทยาลัย</p>
          <h1
            id="home-hero"
            className="mt-3 font-display text-[clamp(2.5rem,5.6vw,4.75rem)] leading-[1.14] font-bold tracking-[-0.025em] text-ink"
          >
            แยกขยะวันนี้ <span className="ink-highlight whitespace-nowrap">นับเป็นผล</span> ได้จริง
          </h1>
          <p className="mt-4.5 mb-6 max-w-[44ch] text-lg text-muted md:text-[1.1875rem]">
            ทุกกิโลกรัมที่นักศึกษาแยกแล้วนำมาชั่ง ถูกบันทึกเป็นแต้ม และคำนวณเป็นก๊าซเรือนกระจกที่ลดได้ ตามค่ามาตรฐานของ อบก.
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/activities" variant="primary" size="lg">
              ดูกิจกรรมที่เปิดรับ →
            </ButtonLink>
            <ButtonLink href="/articles" variant="card" size="lg">
              บทความ
            </ButtonLink>
          </div>
          <div className="mt-10">{stats}</div>
          <p className="mt-2.5 inline-flex items-center gap-2 text-xs text-accent">
            <span data-deco aria-hidden="true" className="live-dot pointer-events-none size-[7px] rounded-full bg-accent" />
            อัปเดตทุก 1 นาที
          </p>
        </div>
        <HeroArt className="order-first w-[min(300px,88%)] justify-self-center lg:order-none lg:w-[min(380px,100%)]" />
      </div>
    </section>
  );
}
