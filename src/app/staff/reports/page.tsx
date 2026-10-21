import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/app/_components/page-skeleton";
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

const inputClass =
  "rounded-lg border border-gray-300 bg-white px-3 py-2 text-base outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/30 dark:border-gray-700 dark:bg-gray-900";
const buttonClass = "inline-block rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800";
const th = "whitespace-nowrap px-3 py-2 text-left font-semibold";
const td = "whitespace-nowrap px-3 py-2";

// cacheComponents: searchParams and the session are request-time data, read them inside <Suspense>.
export default function StaffReportsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">รายงาน</h1>
        <Link href="/staff" className="text-sm text-green-700 underline">
          กลับ
        </Link>
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <Reports searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Reports({ searchParams }: { searchParams: SearchParams }) {
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
        <div className="flex flex-col gap-1">
          <label htmlFor="from" className="text-sm">
            ตั้งแต่วันที่จบ
          </label>
          <input id="from" name="from" type="date" required defaultValue={range.from} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="to" className="text-sm">
            ถึงวันที่จบ
          </label>
          <input id="to" name="to" type="date" required defaultValue={range.to} className={inputClass} />
        </div>
        <button type="submit" className={buttonClass}>
          ดูรายงาน
        </button>
      </form>

      {parsed.ok ? null : (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {parsed.message} (แสดงเดือนปัจจุบันแทน)
        </p>
      )}

      <section aria-label="หมายเหตุเกณฑ์การนับ" className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-gray-800 dark:border-green-900 dark:bg-green-950 dark:text-gray-200">
        <p className="font-semibold">เกณฑ์การนับรายงาน</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>นับเฉพาะผลที่อนุมัติแล้ว ของกิจกรรมที่จบแล้ว (ปิดกิจกรรมหรือเลยเวลาสิ้นสุด) ไม่นับกิจกรรมฉบับร่าง</li>
          <li>เลือกช่วงตามวันที่กิจกรรมจบ (เวลาประเทศไทย) ผลที่อนุมัติหลังกิจกรรมจบแล้วจึงยังนับในช่วงของกิจกรรมนั้น</li>
          <li>แต้มและ carbon นับจากรายการที่ระบบบันทึกตอนอนุมัติ ไม่รวมการปรับแต้ม การแลกของรางวัล และการคืนแต้ม</li>
          <li data-testid="dashboard-note">
            แดชบอร์ดและอันดับนับทันทีที่ผลได้รับอนุมัติ แม้กิจกรรมยังไม่จบ และรวมการปรับแต้มด้วย ตัวเลขจึงอาจสูงกว่ารายงานชั่วคราว
            ส่วนแต้มคงเหลือหักการแลกของแล้ว จึงอาจต่ำกว่าแต้มในรายงาน
          </li>
        </ul>
      </section>

      <div className="mb-6 flex flex-wrap gap-3">
        <a href={`/api/reports/csv?kind=activities&${query}`} className={buttonClass}>
          ดาวน์โหลด CSV รายกิจกรรม
        </a>
        <a href={`/api/reports/csv?kind=students&${query}`} className={buttonClass}>
          ดาวน์โหลด CSV รายนักเรียน
        </a>
        {/* Task 17 adds the PDF download button here. */}
      </div>

      <section aria-labelledby="by-activity" className="mb-8">
        <h2 id="by-activity" className="mb-2 text-lg font-semibold">
          รายกิจกรรม
        </h2>
        {activities.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-gray-600 dark:border-gray-700 dark:text-gray-400">
            ไม่มีกิจกรรมที่จบในช่วงนี้
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
            <table data-testid="report-activities" className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className={th}>กิจกรรม</th>
                  <th className={th}>วันที่จบ</th>
                  <th className={th}>ผู้เข้าร่วม</th>
                  <th className={th}>ผลที่อนุมัติ</th>
                  <th className={th}>พลาสติก (กก.)</th>
                  <th className={th}>กระดาษ (กก.)</th>
                  <th className={th}>โลหะ/แก้ว (กก.)</th>
                  <th className={th}>ขยะทั่วไป/อื่นๆ (กก.)</th>
                  <th className={th}>ต้นไม้ (ต้น)</th>
                  <th className={th}>แต้ม</th>
                  <th className={th}>carbon (kgCO2e)</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((r, i) => (
                  <tr key={i} className="border-t border-gray-200 dark:border-gray-800">
                    <td className={`${td} whitespace-normal`}>{r.title}</td>
                    <td className={td}>{day(r.endsOn)}</td>
                    <td className={td}>{number.format(r.participants)}</td>
                    <td className={td}>{number.format(r.approvedSubmissions)}</td>
                    <td className={td}>{kg(r.gramsPlastic)}</td>
                    <td className={td}>{kg(r.gramsPaper)}</td>
                    <td className={td}>{kg(r.gramsMetalGlass)}</td>
                    <td className={td}>{kg(r.gramsOther)}</td>
                    <td className={td}>{number.format(r.trees)}</td>
                    <td className={td}>{number.format(r.points)}</td>
                    <td className={td}>{decimal.format(r.carbonKg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="by-student">
        <h2 id="by-student" className="mb-2 text-lg font-semibold">
          รายนักเรียน
        </h2>
        {students.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-gray-600 dark:border-gray-700 dark:text-gray-400">
            ไม่มีนักเรียนที่มีผลอนุมัติในช่วงนี้
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
            <table data-testid="report-students" className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className={th}>ชื่อ</th>
                  <th className={th}>แต้ม</th>
                  <th className={th}>carbon (kgCO2e)</th>
                  <th className={th}>น้ำหนักรวม (กก.)</th>
                  <th className={th}>ต้นไม้ (ต้น)</th>
                </tr>
              </thead>
              <tbody>
                {students.map((r, i) => (
                  <tr key={i} className="border-t border-gray-200 dark:border-gray-800">
                    <td className={`${td} whitespace-normal`}>{r.fullName}</td>
                    <td className={td}>{number.format(r.points)}</td>
                    <td className={td}>{decimal.format(r.carbonKg)}</td>
                    <td className={td}>{kg(r.gramsTotal)}</td>
                    <td className={td}>{number.format(r.trees)}</td>
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
