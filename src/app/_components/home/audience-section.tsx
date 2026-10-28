import { Card } from "@/components/ui";
import { HOME_CONTAINER, HOME_SECTION, SectionHeading } from "./section-heading";

const STUDENT_POINTS = [
  "เห็นผลของตัวเองเป็นตัวเลข: แต้ม น้ำหนัก carbon",
  "แลกรางวัลได้จริง และมีอันดับให้แข่งกัน",
  "ส่งผลกิจกรรมจากมือถือได้ในไม่กี่ขั้นตอน",
];

/** 03: a clipped student notebook page beside two sticky notes, on graph paper. */
export function AudienceSection() {
  return (
    <section aria-labelledby="home-audience" className={`paper-grid paper-torn [--torn-bg:var(--paper-3)] ${HOME_SECTION}`}>
      <div className={HOME_CONTAINER}>
        <SectionHeading id="audience" num="03" kicker="ทำเพื่อใคร" title="สร้างมาเพื่อนักศึกษา และทุกคนในวิทยาลัย" />
        <div className="mt-8 grid items-start gap-7 lg:grid-cols-[1.3fr_1fr]">
          <Card flush deco="clip" className="paper-ruled pt-[1.9rem] pr-6 pb-6 pl-15">
            <h3 className="font-display text-[1.625rem] leading-[1.9rem] font-semibold text-ink">นักศึกษา</h3>
            <ul className="list-disc pl-4.5 leading-[1.9rem] text-muted marker:text-accent">
              {STUDENT_POINTS.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </Card>
          <div className="grid gap-6 px-1">
            <Card tone="accent" tilt>
              <h3 className="font-display text-lg font-semibold text-ink">ครูและเจ้าหน้าที่</h3>
              <p className="mt-1 text-[0.9375rem] text-ink">ตรวจผล ชั่งขยะ จัดกิจกรรม และออกรายงานได้ในที่เดียว</p>
            </Card>
            <Card tilt>
              <h3 className="font-display text-lg font-semibold text-ink">วิทยาลัย</h3>
              <p className="mt-1 text-[0.9375rem] text-muted">มีข้อมูลขยะและ carbon จริง ใช้วางแผนด้านสิ่งแวดล้อมได้</p>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
