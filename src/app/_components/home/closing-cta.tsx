import { ButtonLink } from "@/components/ui";
import { HOME_CONTAINER } from "./section-heading";

const LEAF = "pointer-events-none absolute rounded-[0_60%_0_60%] bg-accent";

/** The last page: an empty notebook page waiting for the visitor, on a green-to-sun wash with two faint leaves. */
export function ClosingCta() {
  return (
    <section
      aria-labelledby="home-cta"
      className="relative overflow-hidden bg-[linear-gradient(135deg,color-mix(in_oklab,var(--accent)_26%,var(--paper))_0%,var(--accent-soft)_45%,color-mix(in_oklab,var(--sun)_18%,var(--paper))_100%)]"
    >
      <span data-deco aria-hidden="true" className={`${LEAF} -top-10 -right-10 size-55 -rotate-[18deg] opacity-10`} />
      <span data-deco aria-hidden="true" className={`${LEAF} right-36 -bottom-8 size-28 rotate-30 opacity-[0.08]`} />
      <div className={`${HOME_CONTAINER} relative grid items-end gap-8 py-20 lg:grid-cols-[1.4fr_1fr]`}>
        <h2
          id="home-cta"
          className="max-w-[16ch] font-display text-[clamp(2rem,4.4vw,3.5rem)] leading-[1.18] font-bold tracking-[-0.02em] text-ink"
        >
          หน้าแรกในสมุดของคุณ ยังว่างอยู่
        </h2>
        <div className="flex flex-wrap gap-3 lg:justify-end">
          <ButtonLink href="/register" variant="primary" size="lg">
            สมัครสมาชิก
          </ButtonLink>
          <ButtonLink href="/login" variant="card" size="lg">
            เข้าสู่ระบบ
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
