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

    await signIn(page, student, "/dashboard");
    const bars = page.getByTestId("waste-chart").locator("path.recharts-rectangle");
    await expect(bars).toHaveCount(2);

    const fills = async () => bars.evaluateAll((els) => els.map((el) => getComputedStyle(el).fill));
    const tickFill = () =>
      page
        .getByTestId("waste-chart")
        .locator("svg text", { hasText: "พลาสติก" })
        .first()
        .evaluate((el) => getComputedStyle(el).fill);
    const setTheme = (t: "light" | "dark") =>
      page.evaluate((v) => document.documentElement.setAttribute("data-theme", v), t);

    await setTheme("light");
    const light = await fills();
    const lightTick = await tickFill();
    for (const f of light) expect(f).not.toBe("rgb(22, 163, 74)");
    expect(light[0]).not.toBe(light[1]);

    await setTheme("dark");
    const dark = await fills();
    const darkTick = await tickFill();
    expect(dark[0]).not.toBe(light[0]);
    expect(darkTick).not.toBe(lightTick);

    const dir = "test-results/screens/chart";
    for (const theme of ["light", "dark"] as const) {
      for (const width of [360, 1280]) {
        await setTheme(theme);
        await page.setViewportSize({ width, height: 900 });
        await page.waitForTimeout(200);
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
