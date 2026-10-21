import { expect, request as playwrightRequest, test } from "@playwright/test";
import { signIn } from "./helpers/auth";
import {
  createConfirmedUser,
  createJoinedCodeActivity,
  deleteActivitiesByTitle,
  deleteUsers,
  type TestUser,
} from "./helpers/supabase-admin";

// Plan Task 16 (R105-R107): /staff/reports preview, the two CSV downloads and the route's status codes.
// Far-future windows (2033 per project, 2040 empty) so leftovers from other runs never fall in range.

function uniqueSuffix(projectName: string): string {
  return `${projectName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const BOM = [0xef, 0xbb, 0xbf];
const ACTIVITY_HEADER = "กิจกรรม,วันที่จบ,ผู้เข้าร่วม,ผลที่อนุมัติ,พลาสติก (กก.),กระดาษ (กก.),โลหะ/แก้ว (กก.),ขยะทั่วไป/อื่นๆ (กก.),ต้นไม้ (ต้น),แต้ม,carbon (kgCO2e)";
const STUDENT_HEADER = "ชื่อ,แต้ม,carbon (kgCO2e),น้ำหนักรวม (กก.),ต้นไม้ (ต้น)";

test("reports: staff previews and downloads both CSVs; student 403, anonymous 401, bad params 400", async ({ page, browser, baseURL }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const title = `รายงานทดสอบ ${suffix}`;
  const year = testInfo.project.name === "chromium" ? 2033 : 2034;
  const from = `${year}-05-01`;
  const to = `${year}-05-31`;
  let teacher: TestUser | undefined;
  let student: TestUser | undefined;

  try {
    teacher = await createConfirmedUser("teacher", `teacher-rp-${suffix}`);
    student = await createConfirmedUser("student", `student-rp-${suffix}`);
    await createJoinedCodeActivity(title, student.id, {
      type: "fixed",
      status: "closed",
      requires_code: false,
      starts_at: `${year}-05-01T00:00:00Z`,
      ends_at: `${year}-05-10T05:00:00Z`,
    });

    await signIn(page, teacher, "/staff/reports");
    await page.goto(`/staff/reports?from=${from}&to=${to}`);
    const table = page.getByTestId("report-activities");
    await expect(table).toContainText(title);
    await expect(page.getByText("นับเฉพาะผลที่อนุมัติ")).toBeVisible();

    // activities CSV through the download button
    const link = page.getByRole("link", { name: "ดาวน์โหลด CSV รายกิจกรรม" });
    await expect(link).toHaveAttribute("href", `/api/reports/csv?kind=activities&from=${from}&to=${to}`);
    const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
    expect(download.suggestedFilename()).toBe(`report-activities-${from}-${to}.csv`);

    const res = await page.request.get(`/api/reports/csv?kind=activities&from=${from}&to=${to}`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("text/csv; charset=utf-8");
    expect(res.headers()["cache-control"]).toBe("private, no-store");
    expect(res.headers()["content-disposition"]).toBe(`attachment; filename="report-activities-${from}-${to}.csv"`);
    const bytes = await res.body();
    expect([...bytes.subarray(0, 3)]).toEqual(BOM);
    const text = bytes.toString("utf8").slice(1);
    expect(text.split("\r\n")[0]).toBe(ACTIVITY_HEADER);
    expect(text).toContain(`${title},${year}-05-10,1,0,0.000,0.000,0.000,0.000,0,0,0.000\r\n`);

    // students CSV: header only (no approved results), BOM first
    const sres = await page.request.get(`/api/reports/csv?kind=students&from=${from}&to=${to}`);
    expect(sres.status()).toBe(200);
    const sbytes = await sres.body();
    expect([...sbytes.subarray(0, 3)]).toEqual(BOM);
    expect(sbytes.toString("utf8").slice(1)).toBe(`${STUDENT_HEADER}\r\n`);
    await expect(page.getByRole("link", { name: "ดาวน์โหลด CSV รายนักเรียน" })).toBeVisible();

    // an empty range: empty state in the page, header-only CSV
    await page.goto("/staff/reports?from=2040-01-01&to=2040-01-31");
    await expect(page.getByText("ไม่มีกิจกรรมที่จบในช่วงนี้")).toBeVisible();
    const empty = await page.request.get("/api/reports/csv?kind=activities&from=2040-01-01&to=2040-01-31");
    expect(empty.status()).toBe(200);
    const ebytes = await empty.body();
    expect([...ebytes.subarray(0, 3)]).toEqual(BOM);
    expect(ebytes.toString("utf8").slice(1)).toBe(`${ACTIVITY_HEADER}\r\n`);

    // bad parameters: 400 with a Thai body
    for (const q of [
      "kind=nope&from=2040-01-01&to=2040-01-31",
      "kind=students&from=2040-02-30&to=2040-03-01",
      "kind=students&from=2040-02-01&to=2040-01-01",
      "kind=students&from=2040-01-01",
      "kind=students&from=2030-01-01&to=2040-01-01",
    ]) {
      const bad = await page.request.get(`/api/reports/csv?${q}`);
      expect(bad.status(), q).toBe(400);
      expect(bad.headers()["cache-control"]).toBe("private, no-store");
      expect(await bad.text()).toMatch(/[ก-๙]/);
    }

    // a student: 403
    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();
    await signIn(studentPage, student, "/dashboard");
    expect((await studentPage.request.get(`/api/reports/csv?kind=students&from=${from}&to=${to}`)).status()).toBe(403);
    await studentContext.close();

    // anonymous: 401
    const anon = await playwrightRequest.newContext({ baseURL });
    expect((await anon.get(`/api/reports/csv?kind=students&from=${from}&to=${to}`)).status()).toBe(401);
    await anon.dispose();
  } finally {
    await deleteActivitiesByTitle(title);
    await deleteUsers([student, teacher]);
  }
});
