import { Card } from "@/components/ui";
import { LessSourceLink } from "../less-source-link";
import { HOME_CONTAINER, HOME_SECTION, SectionHeading } from "./section-heading";

/** 01: why sorting matters, with one taped figure card (and a coffee ring, because it is a notebook). */
export function ProblemSection() {
  return (
    <section aria-labelledby="home-problem" className={`paper-dots paper-torn [--torn-bg:var(--paper)] ${HOME_SECTION}`}>
      <div className={`${HOME_CONTAINER} grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10`}>
        <div>
          <SectionHeading id="problem" num="01" kicker="ปัญหา" title="ขยะที่ไม่ได้แยก กลายเป็นก๊าซที่ทำให้โลกร้อน" />
          <p className="mt-4 max-w-[58ch] text-[1.0625rem] text-muted">
            ขยะที่ปนกันไปฝังกลบ ปล่อยก๊าซเรือนกระจกออกมาเรื่อยๆ ขณะที่ขยะที่แยกแล้วนำไปรีไซเคิล ช่วยทดแทนการผลิตวัตถุดิบใหม่ จึงลดการปล่อยก๊าซได้ การแยกตั้งแต่ต้นทางในวิทยาลัยจึงเป็นจุดเริ่มที่ทุกคนทำได้
          </p>
        </div>
        <Card deco="tape" tilt className="mx-1 max-w-md lg:justify-self-end">
          <span
            data-deco
            aria-hidden="true"
            className="pointer-events-none absolute -right-4 -bottom-6 size-22 rounded-full border-[6px] border-[color-mix(in_oklab,var(--kraft)_80%,transparent)] opacity-60 blur-[0.4px]"
          />
          {/* docs/carbon-sources.md: paper recycled instead of virgin material (net) 3.5460 */}
          <p className="relative font-mono text-[3.25rem] leading-[1.1] font-semibold text-accent">
            3.5 <span className="font-sans text-lg font-normal text-muted">กก. CO2e</span>
          </p>
          <p className="relative mt-1.5 text-ink">ลดได้เมื่อรีไซเคิลกระดาษ 1 กก. แทนการผลิตใหม่</p>
          <p className="relative mt-2.5 border-t border-dashed border-rule pt-2 text-xs text-muted">
            <LessSourceLink>ที่มา: อบก. โครงการ LESS, LESS-WM-01 v06 (ค่า 3.5460)</LessSourceLink>
          </p>
        </Card>
      </div>
    </section>
  );
}
