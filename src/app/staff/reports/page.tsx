import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { ButtonLink, Card, EmptyState, Field, PageHeader, buttonClass, inputClass, Mono } from "@/components/ui";
import { requireStaff } from "@/lib/auth/dal";
import { getActivityReport, getStudentReport } from "@/lib/reports/data";
import { bangkokMonthRange, parseDateRange } from "@/lib/reports/range";

export const metadata: Metadata = { title: "รายงาน | Green Campus" };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const number = new Intl.NumberFormat("th-TH");
const decimal = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const dateFormat = new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });

const kg = (grams: number) => decimal.format(grams / 1000);
const day = (isoDate: string) => dateFormat.format(new Date(`${isoDate}T00:00:00Z`));
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);

const th = "whitespace-nowrap px-3 py-2 text-left text-sm font-medium text-muted";
const thNum = "whitespace-nowrap px-3 py-2 text-right text-sm font-medium text-muted";
const td = "whitespace-nowrap px-3 py-2";
const tdNum = "whitespace-nowrap px-3 py-2 text-right font-mono";
const tdName = "px-3 py-2"; // wraps: a long title or name must not stretch the table
const tableWrap = "overflow-x-auto rounded-card border border-rule bg-surface shadow-sheet";

// cacheComponents: searchParams and the session are request-time data, read them inside <Suspense>.
export default function StaffReportsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
      <div className="mb-6">
        <PageHeader
          title="รายงาน"
          actions={
            <ButtonLink href="/staff" variant="quiet">
              กลับ
            </ButtonLink>
          }
        />
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <Reports searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Reports({ searchParams }: { searchParams: SearchParams }) {
  const uid = "reports"; // route-prefixed (useId repeats across server renders)
  const activityHeadingId = `${uid}-by-activity`;
  const studentHeadingId = `${uid}-by-student`;
  await requireStaff("/staff/reports");
  const params = await searchParams;
  // The default range is the current Bangkok calendar month (the clock is read after the session: request-time).
  const fallback = bangkokMonthRange(new Date());
  const parsed = parseDateRange(one(params.from) ?? fallback.from, one(params.to) ?? fallback.to);
  const range = parsed.ok ? parsed : fallback;
  const [activities, students] = await Promise.all([getActivityReport(range.from, range.to), getStudentReport(range.from, range.to)]);
  const query = `from=${range.from}&to=${range.to}`;

  return (
    <>
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <Field id={`${uid}-from`} label="ตั้งแต่วันที่จบ" className="min-w-40 flex-1">
          <input id={`${uid}-from`} name="from" type="date" required defaultValue={range.from} className={inputClass} />
        </Field>
        <Field id={`${uid}-to`} label="ถึงวันที่จบ" className="min-w-40 flex-1">
          <input id={`${uid}-to`} name="to" type="date" required defaultValue={range.to} className={inputClass} />
        </Field>
        <button type="submit" className={buttonClass({ variant: "primary" })}>
          ดูรายงาน
        </button>
      </form>

      {parsed.ok ? null : (
        <p role="alert" className="mb-4 rounded-input border border-danger bg-surface p-3 text-sm text-danger">
          {parsed.message} (แสดงเดือนปัจจุบันแทน)
        </p>
      )}

      <Card as="section" tone="accent" aria-label="หมายเหตุเกณฑ์การนับ" className="mb-6 text-sm">
        <p className="font-semibold">เกณฑ์การนับรายงาน</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>นับเฉพาะผลที่อนุมัติแล้ว ของกิจกรรมที่จบแล้ว (ปิดกิจกรรมหรือเลยเวลาสิ้นสุด) ไม่นับกิจกรรมฉบับร่าง</li>
          <li>เลือกช่วงตามวันที่กิจกรรมจบ (เวลาประเทศไทย) ผลที่อนุมัติหลังกิจกรรมจบแล้วจึงยังนับในช่วงของกิจกรรมนั้น</li>
          <li data-testid="csv-date-note">วันที่ในไฟล์ CSV เป็นรูปแบบ ISO ปี ค.ศ. (เช่น 2026-10-22) เพื่อให้ Excel / Google Sheets เรียงและกรองได้ถูก</li>
          <li>แต้มและ carbon นับจากรายการที่ระบบบันทึกตอนอนุมัติ ไม่รวมการปรับแต้ม การแลกของรางวัล และการคืนแต้ม</li>
          <li data-testid="dashboard-note">
            แดชบอร์ดและอันดับนับทันทีที่ผลได้รับอนุมัติ แม้กิจกรรมยังไม่จบ และรวมการปรับแต้มด้วย ตัวเลขจึงอาจสูงกว่ารายงานชั่วคราว
            ส่วนแต้มคงเหลือหักการแลกของแล้ว จึงอาจต่ำกว่าแต้มในรายงาน
          </li>
        </ul>
      </Card>

      <div className="mb-6 flex flex-wrap gap-3">
        <a href={`/api/reports/csv?kind=activities&${query}`} className={buttonClass({ variant: "card" })}>
          ดาวน์โหลด CSV รายกิจกรรม
        </a>
        <a href={`/api/reports/csv?kind=students&${query}`} className={buttonClass({ variant: "card" })}>
          ดาวน์โหลด CSV รายนักเรียน
        </a>
        <a href={`/api/reports/pdf?${query}`} className={buttonClass({ variant: "card" })}>
          ดาวน์โหลด PDF สรุป
        </a>
      </div>

      <section aria-labelledby={activityHeadingId} className="mb-8">
        <h2 id={activityHeadingId} className="mb-2 font-display text-lg font-semibold">
          รายกิจกรรม
        </h2>
        {activities.length === 0 ? (
          <EmptyState>ไม่มีกิจกรรมที่จบในช่วงนี้</EmptyState>
        ) : (
          <div className={tableWrap}>
            <table data-testid="report-activities" className="w-full text-sm">
              <thead>
                <tr>
                  <th className={th}>กิจกรรม</th>
                  <th className={th}>วันที่จบ</th>
                  <th className={thNum}>ผู้เข้าร่วม</th>
                  <th className={thNum}>ผลที่อนุมัติ</th>
                  <th className={thNum}>พลาสติก (กก.)</th>
                  <th className={thNum}>กระดาษ (กก.)</th>
                  <th className={thNum}>โลหะ/แก้ว (กก.)</th>
                  <th className={thNum}>ขยะทั่วไป/อื่นๆ (กก.)</th>
                  <th className={thNum}>ต้นไม้ (ต้น)</th>
                  <th className={thNum}>แต้ม</th>
                  <th className={thNum}>carbon (kgCO2e)</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((r, i) => (
                  <tr key={i} className="border-t border-rule">
                    <td className={`${tdName} min-w-48`}>{r.title}</td>
                    <td className={td}>
                      <Mono text={day(r.endsOn)} />
                    </td>
                    <td className={tdNum}>{number.format(r.participants)}</td>
                    <td className={tdNum}>{number.format(r.approvedSubmissions)}</td>
                    <td className={tdNum}>{kg(r.gramsPlastic)}</td>
                    <td className={tdNum}>{kg(r.gramsPaper)}</td>
                    <td className={tdNum}>{kg(r.gramsMetalGlass)}</td>
                    <td className={tdNum}>{kg(r.gramsOther)}</td>
                    <td className={tdNum}>{number.format(r.trees)}</td>
                    <td className={tdNum}>{number.format(r.points)}</td>
                    <td className={tdNum}>{decimal.format(r.carbonKg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby={studentHeadingId}>
        <h2 id={studentHeadingId} className="mb-2 font-display text-lg font-semibold">
          รายนักเรียน
        </h2>
        {students.length === 0 ? (
          <EmptyState>ไม่มีนักเรียนที่มีผลอนุมัติในช่วงนี้</EmptyState>
        ) : (
          <div className={tableWrap}>
            <table data-testid="report-students" className="w-full text-sm">
              <thead>
                <tr>
                  <th className={th}>ชื่อ</th>
                  <th className={thNum}>แต้ม</th>
                  <th className={thNum}>carbon (kgCO2e)</th>
                  <th className={thNum}>น้ำหนักรวม (กก.)</th>
                  <th className={thNum}>ต้นไม้ (ต้น)</th>
                </tr>
              </thead>
              <tbody>
                {students.map((r, i) => (
                  <tr key={i} className="border-t border-rule">
                    <td className={`${tdName} min-w-48`}>{r.fullName}</td>
                    <td className={tdNum}>{number.format(r.points)}</td>
                    <td className={tdNum}>{decimal.format(r.carbonKg)}</td>
                    <td className={tdNum}>{kg(r.gramsTotal)}</td>
                    <td className={tdNum}>{number.format(r.trees)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
