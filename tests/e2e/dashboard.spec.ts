import { expect, test } from "@playwright/test";
import { estimateWaste } from "../../src/lib/units";
import { signIn } from "./helpers/auth";
import { PNG_1X1 } from "./helpers/images";
import {
  createConfirmedUser,
  createJoinedCodeActivity,
  deleteActivitiesByTitle,
  deleteUsers,
  seedSubmission,
  signedInClient,
  wasteCategoryId,
  wasteRates,
  type TestUser,
} from "./helpers/supabase-admin";

// Plan Task 11 (R53-R57): student dashboard and history.

function uniqueSuffix(projectName: string): string {
  return `${projectName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

test("student with one approved waste result sees points, carbon, chart fallback and history", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const title = `กิจกรรมแดชบอร์ด ${suffix}`;
  let teacher: TestUser | undefined;
  let student: TestUser | undefined;

  try {
    teacher = await createConfirmedUser("teacher", `teacher-dash-${suffix}`);
    student = await createConfirmedUser("student", `student-dash-${suffix}`);
    const activityId = await createJoinedCodeActivity(title, student.id, {
      type: "waste",
      unit_points: 0,
      requires_code: false,
    });
    const plastic = await wasteCategoryId("พลาสติก");
    const grams = 1550;
    const submissionId = await seedSubmission(student, activityId, PNG_1X1, [
      { waste_category_id: plastic, quantity: grams },
    ]);
    const teacherClient = await signedInClient(teacher);
    const { error } = await teacherClient.rpc("approve_submission", { p_submission_id: submissionId });
    expect(error).toBeNull();

    const expected = estimateWaste([{ grams, rates: await wasteRates("พลาสติก") }]);

    const problems: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" || m.type() === "warning") problems.push(m.text());
    });
    page.on("pageerror", (e) => problems.push(e.message));
    await signIn(page, student, "/dashboard");
    await expect(page.getByTestId("points")).toHaveText(String(expected.points));
    await expect(page.getByTestId("carbon")).toContainText(String(expected.carbonKg));
    await expect(page.getByTestId("waste-chart")).toBeVisible();
    await expect(page.getByTestId("waste-table")).toContainText("1.55 กก.");
    expect(problems.filter((p) => /hydrat|did not match|server rendered/i.test(p))).toEqual([]);
    await expect(page.getByText("ยังไม่มีผลกิจกรรม")).toHaveCount(0);
    await expect(page.getByTestId("recent-submission").filter({ hasText: title })).toContainText("อนุมัติแล้ว");

    await page.getByRole("link", { name: "ดูทั้งหมด" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/my-submissions");
    const row = page.getByTestId("submission").filter({ hasText: title });
    await expect(row).toContainText("พลาสติก 1.55 กก.");
    await expect(row).toContainText(`${expected.points} แต้ม`);
    await expect(row).toContainText(`${expected.carbonKg} กก. CO2e`);
  } finally {
    await deleteActivitiesByTitle(title);
    await deleteUsers([teacher, student]);
  }
});

test("waste chart bars use theme chart tokens and follow the theme", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const title = `กิจกรรมกราฟ ${suffix}`;
  let teacher: TestUser | undefined;
  let student: TestUser | undefined;

  try {
    teacher = await createConfirmedUser("teacher", `teacher-chart-${suffix}`);
    student = await createConfirmedUser("student", `student-chart-${suffix}`);
    const activityId = await createJoinedCodeActivity(title, student.id, {
      type: "waste",
      unit_points: 0,
      requires_code: false,
    });
    const submissionId = await seedSubmission(student, activityId, PNG_1X1, [
      { waste_category_id: await wasteCategoryId("พลาสติก"), quantity: 1200 },
      { waste_category_id: await wasteCategoryId("กระดาษ"), quantity: 800 },
    ]);
    const teacherClient = await signedInClient(teacher);
    const { error } = await teacherClient.rpc("approve_submission", { p_submission_id: submissionId });
    expect(error).toBeNull();

    // Review M5 (flake): the system scheme and the explicit theme agree from the start, and the page is hydrated
    // (ThemeToggle re-applies the stored choice on mount, which used to undo a theme set too early).
    await page.emulateMedia({ colorScheme: "light" });
    await signIn(page, student, "/dashboard");
    const bars = page.getByTestId("waste-chart").locator("path.recharts-rectangle");
    await expect(bars).toHaveCount(2);
    await expect(page.locator('[data-realtime="subscribed"]').first()).toBeAttached(); // a client-only marker

    const html = page.locator("html");
    const fills = async () => bars.evaluateAll((els) => els.map((el) => getComputedStyle(el).fill));
    const tickFill = () =>
      page
        .getByTestId("waste-chart")
        .locator("svg text", { hasText: "พลาสติก" })
        .first()
        .evaluate((el) => getComputedStyle(el).fill);
    // stored as well, like the toggle does, so a re-apply from storage keeps it
    const setTheme = async (t: "light" | "dark") => {
      await page.evaluate((v) => {
        try {
          localStorage.setItem("theme", v);
        } catch {
          // storage blocked: the attribute alone still applies
        }
        document.documentElement.setAttribute("data-theme", v);
      }, t);
      await expect(html).toHaveAttribute("data-theme", t);
    };

    await setTheme("light");
    const light = await fills();
    const lightTick = await tickFill();
    for (const f of light) expect(f).not.toBe("rgb(22, 163, 74)");
    expect(light[0]).not.toBe(light[1]);

    await setTheme("dark");
    await expect.poll(fills).not.toEqual(light);
    await expect.poll(tickFill).not.toBe(lightTick);
    const dark = await fills();
    expect(dark[0]).not.toBe(light[0]);

    const dir = "test-results/screens/chart";
    for (const theme of ["light", "dark"] as const) {
      for (const width of [360, 1280]) {
        await setTheme(theme);
        await page.setViewportSize({ width, height: 900 });
        await expect(html).toHaveAttribute("data-theme", theme);
        await page.screenshot({ path: `${dir}/dashboard-${width}-${theme}-${testInfo.project.name}.png`, fullPage: true });
      }
    }
  } finally {
    await deleteActivitiesByTitle(title);
    await deleteUsers([teacher, student]);
  }
});

test("a new student sees the empty state and no chart", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  let student: TestUser | undefined;
  try {
    student = await createConfirmedUser("student", `student-dash-empty-${suffix}`);
    await signIn(page, student, "/dashboard");
    await expect(page.getByText("ยังไม่มีผลกิจกรรม")).toBeVisible();
    await expect(page.getByTestId("waste-chart")).toHaveCount(0);
    await expect(page.getByTestId("points")).toHaveText("0");
    await expect(page.getByTestId("carbon")).toContainText("0");
    await expect(page.getByRole("link", { name: "ดูกิจกรรม", exact: true })).toBeVisible();
  } finally {
    await deleteUsers([student]);
  }
});

test("staff on /dashboard get a link to /staff instead of student stats", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  let teacher: TestUser | undefined;
  try {
    teacher = await createConfirmedUser("teacher", `teacher-dash-staff-${suffix}`);
    await signIn(page, teacher, "/dashboard");
    await expect(page.getByRole("link", { name: /ไปหน้าครูและผู้ดูแล/ })).toBeVisible();
    await expect(page.getByTestId("points")).toHaveCount(0);
    await expect(page.getByTestId("waste-chart")).toHaveCount(0);
  } finally {
    await deleteUsers([teacher]);
  }
});

// Redesign 3 Task 6. The dashboard is rendered on the server (requireUser reads cookies, then new Date()),
// so page.clock only moves the browser clock and cannot select a greeting here. The four time bands are
// covered by src/lib/greeting.test.ts; this test asserts one of the four greetings followed by the name.
test("dashboard greets by time of day with the name, full name and email", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  let student: TestUser | undefined;
  try {
    student = await createConfirmedUser("student", `student-greet-${suffix}`);
    await signIn(page, student, "/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^สวัสดีตอน(เช้า|เที่ยง|บ่าย|เย็น|ดึก) ทดสอบ student$/);
    const main = page.getByRole("main");
    await expect(main.getByText("ทดสอบ student", { exact: true })).toBeVisible();
    await expect(main.getByText(student.email, { exact: true })).toBeVisible();
  } finally {
    await deleteUsers([student]);
  }
});
