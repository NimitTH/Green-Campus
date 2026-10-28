import { HOME_CONTAINER, HOME_SECTION, SectionHeading } from "./section-heading";

// Rounded from docs/carbon-sources.md (TGO LESS-WM-01 v06, recycled instead of virgin material, net):
// paper 3.5460, plastic 1.0310, glass 0.2760. Display constants for the home page only, not the rates the
// system calculates with (those live in waste_categories and an admin can change them).
const FACTS = [
  { value: "3.5", label: "กระดาษ 1 กก. ที่รีไซเคิล" },
  { value: "1.0", label: "พลาสติก 1 กก. ที่รีไซเคิล" },
  { value: "0.3", label: "แก้ว 1 กก. ที่รีไซเคิล" },
];

/** 04: three figures in one ruled box, with the source under it. */
export function FactsSection() {
  return (
    <section aria-labelledby="home-facts" className={HOME_SECTION}>
      <div className={HOME_CONTAINER}>
        <SectionHeading id="facts" num="04" kicker="รู้ไว้" title="ขยะแต่ละชนิดลดโลกร้อนได้ไม่เท่ากัน" />
        <dl className="mt-7 grid overflow-hidden rounded-card border border-rule bg-surface shadow-sheet md:grid-cols-3">
          {FACTS.map((f) => (
            <div key={f.value} className="flex flex-col border-rule p-5.5 max-md:not-last:border-b md:not-last:border-r">
              <dt className="order-last mt-1.5 text-[0.9375rem] text-muted">{f.label}</dt>
              <dd className="font-mono text-[2.125rem] leading-tight font-semibold text-ink">
                {f.value}
                <span className="ml-1 font-sans text-sm font-normal text-muted">กก. CO2e</span>
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-muted">ค่าการลดก๊าซเรือนกระจกสุทธิเมื่อรีไซเคิลทดแทนวัตถุดิบใหม่ · อบก. LESS-WM-01 v06</p>
      </div>
    </section>
  );
}
