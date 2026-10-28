import { HOME_CONTAINER, HOME_SECTION, SectionHeading } from "./section-heading";

const STEPS = [
  { title: "เข้าร่วมกิจกรรม", body: "เลือกกิจกรรมเก็บขยะที่เปิดอยู่ในวิทยาลัย" },
  { title: "นำขยะมาชั่ง", body: "แยกเป็นพลาสติก กระดาษ โลหะ/แก้ว แล้วชั่งที่จุดชั่ง" },
  { title: "ได้แต้มและ carbon", body: "เจ้าหน้าที่ตรวจผล ระบบคิดแต้มและ carbon ที่ลดได้ให้" },
  { title: "แลกรางวัล", body: "ใช้แต้มแลกของรางวัล และดูอันดับเพื่อนๆ" },
];

/** Hand-drawn arrow between two steps (desktop only). */
function StepArrow() {
  return (
    <svg
      data-deco
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 28 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="pointer-events-none absolute top-5 -right-3.5 z-10 hidden w-7 text-accent lg:block"
    >
      <path d="M2 10 C 10 2, 18 2, 25 8" />
      <path d="M20 4 l5 4 -6 2" />
    </svg>
  );
}

/** 02: the four steps in one ruled row (2 x 2 below lg). */
export function ProcessSection() {
  return (
    <section aria-labelledby="home-process" className={HOME_SECTION}>
      <div className={HOME_CONTAINER}>
        <SectionHeading id="process" num="02" kicker="ทำอะไร" title="แยก. ชั่ง. สะสม. แลก." />
        <ol className="mt-8 grid grid-cols-2 gap-y-7 border-t-2 border-ink lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              className="relative min-w-0 border-dashed border-rule pt-4.5 pr-4 max-lg:even:border-l max-lg:even:pl-4 lg:not-first:border-l lg:not-first:pl-4.5"
            >
              <span
                data-deco
                aria-hidden="true"
                className="pointer-events-none block bg-[linear-gradient(160deg,var(--accent),color-mix(in_oklab,var(--accent)_30%,var(--paper)))] bg-clip-text font-mono text-[2.625rem] leading-none font-semibold text-transparent"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-2.5 mb-1 font-display text-xl font-semibold text-ink">{s.title}</h3>
              <p className="text-[0.9375rem] text-muted">{s.body}</p>
              {i < STEPS.length - 1 ? <StepArrow /> : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
