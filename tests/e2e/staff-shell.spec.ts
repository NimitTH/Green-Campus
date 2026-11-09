import { expect, test } from "@playwright/test";
import { greetingFor } from "../../src/lib/greeting";
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
  type TestUser,
} from "./helpers/supabase-admin";

// Redesign 4 Task 8 (DESIGN-4 4.2, 4.3): the collapsible staff sidebar and the /staff home header and charts.

function uniqueSuffix(projectName: string): string {
  return `${projectName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

test("the staff sidebar collapses to icons, remembers it across a reload, and expands again", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "desktop sidebar only (phones keep the drawer)");
  const suffix = uniqueSuffix(testInfo.project.name);
  let admin: TestUser | undefined;
  try {
    admin = await createConfirmedUser("admin", `admin-shell-${suffix}`);
    await page.setViewportSize({ width: 1280, height: 800 });
    await signIn(page, admin, "/staff");
    const side = page.getByRole("navigation", { name: "เมนูผู้ดูแล" });
    await expect(side).toBeVisible();
    const aside = page.locator("aside").filter({ has: side });
    const reviews = side.locator('a[href="/staff/reviews"]');
    // expanded: labels shown, no aria-label, an icon per link
    await expect(reviews).toHaveText("ตรวจผล");
    await expect(reviews).not.toHaveAttribute("aria-label", /./);
    await expect(reviews.locator("svg[aria-hidden=true]")).toHaveCount(1);
    await expect(side.getByText("ผู้ดูแลระบบ", { exact: true })).toBeVisible();

    const collapse = page.getByRole("button", { name: "ยุบเมนู", exact: true });
    await expect(collapse).toHaveAttribute("aria-expanded", "true");
    await expect(collapse).toHaveAttribute("aria-controls", (await aside.getAttribute("id"))!);
    // a click before hydration does nothing: retry until the state flips
    const expand = page.getByRole("button", { name: "กางเมนู", exact: true });
    await expect(async () => {
      if (await collapse.isVisible()) await collapse.click();
      await expect(expand).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await expect(expand).toHaveAttribute("aria-expanded", "false");
    const assertCollapsed = async () => {
      expect((await aside.boundingBox())!.width).toBeLessThanOrEqual(64);
      await expect(reviews).toHaveAttribute("aria-label", "ตรวจผล");
      await expect(side.getByRole("link", { name: "ตรวจผล", exact: true })).toBeVisible();
      await expect(side.getByRole("link", { name: "ผู้ใช้", exact: true })).toHaveAttribute("aria-label", "ผู้ใช้");
      // the group heading gives way to the rule (kept for screen readers only)
      await expect(side.getByText("ผู้ดูแลระบบ", { exact: true })).toHaveClass(/sr-only/);
      await expect(side.getByRole("button", { name: "ออกจากระบบ" })).toBeVisible();
    };
    await assertCollapsed();
    const cookie = (await context.cookies()).find((c) => c.name === "staff-sidebar");
    expect(cookie?.value).toBe("collapsed");
    expect(cookie?.path).toBe("/staff");
    expect(cookie?.sameSite).toBe("Lax");

    // a tooltip on hover (CSS, aria-hidden)
    const tip = reviews.locator("span[aria-hidden=true]");
    await expect(tip).toBeHidden();
    await reviews.hover();
    await expect(tip).toBeVisible();
    await expect(tip).toHaveText("ตรวจผล");

    // reload: the server reads the cookie, the sidebar stays collapsed
    await page.reload();
    await expect(expand).toHaveAttribute("aria-expanded", "false");
    await assertCollapsed();
    // client navigation keeps it collapsed
    await side.getByRole("link", { name: "ออเดอร์", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/staff/orders");
    await expect(expand).toHaveAttribute("aria-expanded", "false");

    await expect(async () => {
      if (await expand.isVisible()) await expand.click();
      await expect(collapse).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await expect(collapse).toHaveAttribute("aria-expanded", "true");
    await expect(reviews).not.toHaveAttribute("aria-label", /./);
    await expect(reviews).toHaveText("ตรวจผล");
    expect((await aside.boundingBox())!.width).toBeGreaterThan(150);
    expect((await context.cookies()).find((c) => c.name === "staff-sidebar")).toBeUndefined();
    await page.reload();
    await expect(collapse).toHaveAttribute("aria-expanded", "true");
  } finally {
    await deleteUsers([admin]);
  }
});

test("/staff greets the teacher with a role badge before the name, and shows the two charts", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const title = `กิจกรรมกราฟครู ${suffix}`;
  let teacher: TestUser | undefined;
  let student: TestUser | undefined;
  try {
    teacher = await createConfirmedUser("teacher", `teacher-home-${suffix}`);
    student = await createConfirmedUser("student", `student-home-${suffix}`);
    // one approved waste result: school-wide waste grams and this month's carbon are above zero
    const activityId = await createJoinedCodeActivity(title, student.id, { type: "waste", unit_points: 0, requires_code: false });
    const submissionId = await seedSubmission(student, activityId, PNG_1X1, [
      { waste_category_id: await wasteCategoryId("พลาสติก"), quantity: 1200 },
    ]);
    const { error } = await (await signedInClient(teacher)).rpc("approve_submission", { p_submission_id: submissionId });
    expect(error).toBeNull();

    const problems: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" || m.type() === "warning") problems.push(m.text());
    });
    page.on("pageerror", (e) => problems.push(e.message));
    const before = greetingFor(new Date());
    await signIn(page, teacher, "/staff");
    const after = greetingFor(new Date());
    // the greeting is rendered on the server (page.clock cannot move it); the hour boundaries are unit tested
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText(new RegExp(`^(${before}|${after}) ทดสอบ teacher$`));

    const badge = page.getByTestId("staff-role");
    await expect(badge).toHaveText("ครู");
    await expect(page.getByTestId("staff-name")).toHaveText("ทดสอบ teacher");
    const badgeFirst = await badge.evaluate((b) => {
      const name = document.querySelector('[data-testid="staff-name"]')!;
      return Boolean(b.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(badgeFirst).toBe(true);
    await expect(page.getByText(teacher.email, { exact: true })).toBeVisible();

    await expect(page.getByTestId("stat-pending-reviews")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "carbon ที่ลดได้รายเดือน (กก. CO₂e)" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "ขยะแยกตามกลุ่ม (กก.)" })).toBeVisible();
    await expect(page.getByTestId("carbon-chart")).toBeVisible();
    await expect(page.getByTestId("waste-chart")).toBeVisible();
    // six months, the current Bangkok month last, in the screen-reader table
    const rows = page.getByTestId("carbon-table").locator("tbody tr");
    await expect(rows).toHaveCount(6);
    const thisMonth = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date());
    await expect(rows.last().locator("th")).toHaveText(thisMonth);
    await expect(page.getByTestId("waste-table")).toContainText("พลาสติก");
    await expect(page.getByTestId("carbon-chart").locator("path.recharts-rectangle").first()).toBeVisible();

    // the old menu cards are gone
    await expect(page.getByText("อนุมัติหรือปฏิเสธผลที่นักเรียนส่ง")).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "เมนูครู" })).toHaveCount(0);
    expect(problems.filter((p) => /hydrat|did not match|server rendered/i.test(p))).toEqual([]);
  } finally {
    await deleteActivitiesByTitle(title);
    await deleteUsers([teacher, student]);
  }
});

test("admins get the ผู้ดูแลระบบ badge on /staff", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  let admin: TestUser | undefined;
  try {
    admin = await createConfirmedUser("admin", `admin-home-${suffix}`);
    await signIn(page, admin, "/staff");
    await expect(page.getByTestId("staff-role")).toHaveText("ผู้ดูแลระบบ");
    await expect(page.getByTestId("staff-name")).toHaveText("ทดสอบ admin");
  } finally {
    await deleteUsers([admin]);
  }
});
