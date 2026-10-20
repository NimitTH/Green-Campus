import { expect, test } from "@playwright/test";
import { signIn } from "./helpers/auth";
import { PNG_1X1 } from "./helpers/images";
import {
  createConfirmedUser,
  createJoinedCodeActivity,
  deleteActivitiesByTitle,
  deleteUsers,
  seedSubmission,
  signedInClient,
  type TestUser,
} from "./helpers/supabase-admin";

// Plan Task 10 (R44-R48): live bell via Realtime, history page, mark read, no cross-user leakage.

function uniqueSuffix(projectName: string): string {
  return `${projectName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const NONE = "แจ้งเตือน ไม่มีรายการใหม่";
// Opening the activity already notified every student ("activity_opened"), so each starts with 1 unread.
const unread = (n: number) => `แจ้งเตือน ยังไม่อ่าน ${n} รายการ`;

test("approval raises the student's bell live; reading lowers it; other students are unaffected", async ({ page, browser }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const title = `กิจกรรมแจ้งเตือน ${suffix}`;
  let teacher: TestUser | undefined;
  let student: TestUser | undefined;
  let other: TestUser | undefined;
  const studentContext = await browser.newContext();
  const otherContext = await browser.newContext();

  try {
    teacher = await createConfirmedUser("teacher", `teacher-nt-${suffix}`);
    student = await createConfirmedUser("student", `student-nt-${suffix}`);
    other = await createConfirmedUser("student", `other-nt-${suffix}`);
    const activityId = await createJoinedCodeActivity(title, student.id, { requires_code: false });
    await seedSubmission(student, activityId, PNG_1X1);

    const studentPage = await studentContext.newPage();
    const otherPage = await otherContext.newPage();
    await signIn(studentPage, student, "/dashboard");
    await signIn(otherPage, other, "/dashboard");
    const bell = studentPage.getByRole("link", { name: /^แจ้งเตือน/ });
    const otherBell = otherPage.getByRole("link", { name: /^แจ้งเตือน/ });
    await expect(bell).toHaveAccessibleName(unread(1));
    await expect(otherBell).toHaveAccessibleName(unread(1));
    await expect(bell).toHaveAttribute("data-realtime", "subscribed");
    await expect(otherBell).toHaveAttribute("data-realtime", "subscribed");

    // teacher approves (the review UI itself is covered by review.spec.ts)
    await signIn(page, teacher, "/staff/reviews");
    await page.getByTestId("review-row").filter({ hasText: title }).getByRole("link").click();
    await page.getByRole("button", { name: "อนุมัติ", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/staff/reviews");

    // within 3 s, no reload
    await expect(bell).toHaveAccessibleName(unread(2), { timeout: 3000 });
    await expect(bell).toContainText("2");
    await expect(otherBell).toHaveAccessibleName(unread(1));

    // history page: item visible; click marks read and goes to /my-submissions
    await bell.click();
    await expect(studentPage).toHaveURL((url) => url.pathname === "/notifications");
    const item = studentPage.getByTestId("notification").filter({ hasText: "ผลของคุณได้รับการอนุมัติ" });
    await expect(item).toBeVisible();
    await expect(item.getByText("ใหม่", { exact: true })).toBeVisible();
    await item.getByRole("button").click();
    await expect(studentPage).toHaveURL((url) => url.pathname === "/my-submissions");
    await expect(studentPage.getByRole("link", { name: /^แจ้งเตือน/ })).toHaveAccessibleName(unread(1));

    // two more approvals, then "อ่านทั้งหมด"
    const c = await signedInClient(teacher);
    const second = await seedSubmission(student, activityId, PNG_1X1);
    const third = await seedSubmission(student, activityId, PNG_1X1);
    for (const id of [second, third]) {
      const { error } = await c.rpc("approve_submission", { p_submission_id: id });
      expect(error).toBeNull();
    }
    await expect(studentPage.getByRole("link", { name: /^แจ้งเตือน/ })).toHaveAccessibleName(
      unread(3),
      { timeout: 5000 },
    );
    await studentPage.goto("/notifications");
    await expect(studentPage.getByTestId("notification").filter({ hasText: title })).toHaveCount(4);
    await studentPage.getByRole("button", { name: "อ่านทั้งหมด" }).click();
    await expect(studentPage.getByRole("link", { name: /^แจ้งเตือน/ })).toHaveAccessibleName(NONE);
    await expect(otherBell).toHaveAccessibleName(unread(1));
  } finally {
    await studentContext.close();
    await otherContext.close();
    await deleteActivitiesByTitle(title);
    await deleteUsers([teacher, student, other]);
  }
});

// A bell unmounts and another mounts for the same user (different layout): live updates must survive.
test("bell still receives live updates after client navigation /dashboard -> /activities", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const title = `กิจกรรมเปลี่ยนหน้า ${suffix}`;
  let teacher: TestUser | undefined;
  let student: TestUser | undefined;
  try {
    teacher = await createConfirmedUser("teacher", `teacher-nt-nav-${suffix}`);
    student = await createConfirmedUser("student", `student-nt-nav-${suffix}`);
    const activityId = await createJoinedCodeActivity(title, student.id, { requires_code: false });
    const submissionId = await seedSubmission(student, activityId, PNG_1X1);

    await signIn(page, student, "/dashboard");
    await page.getByRole("link", { name: /^กิจกรรม/ }).first().click();
    await expect(page).toHaveURL((url) => url.pathname === "/activities");
    const bell = page.getByRole("link", { name: /^แจ้งเตือน/ });
    await expect(bell).toHaveAttribute("data-realtime", "subscribed");
    await expect(bell).toHaveAccessibleName(unread(1));

    const c = await signedInClient(teacher);
    const { error } = await c.rpc("approve_submission", { p_submission_id: submissionId });
    expect(error).toBeNull();
    await expect(bell).toHaveAccessibleName(unread(2), { timeout: 3000 });
  } finally {
    await deleteActivitiesByTitle(title);
    await deleteUsers([teacher, student]);
  }
});

test("empty state for a student with no notifications", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  let student: TestUser | undefined;
  try {
    student = await createConfirmedUser("student", `student-nt-empty-${suffix}`);
    await signIn(page, student, "/notifications");
    await expect(page.getByText("ยังไม่มีการแจ้งเตือน")).toBeVisible();
  } finally {
    await deleteUsers([student]);
  }
});

test("staff can open /notifications and see the bell in the staff header", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  let teacher: TestUser | undefined;
  try {
    teacher = await createConfirmedUser("teacher", `teacher-nt-page-${suffix}`);
    await signIn(page, teacher, "/notifications");
    await expect(page.getByRole("heading", { name: "แจ้งเตือน" })).toBeVisible();
    await page.goto("/staff");
    await expect(page.getByRole("link", { name: /^แจ้งเตือน/ })).toBeVisible();
  } finally {
    await deleteUsers([teacher]);
  }
});
