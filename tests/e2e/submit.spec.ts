import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signIn } from "./helpers/auth";
import { PNG_1X1 } from "./helpers/images";
import {
  createConfirmedUser,
  createJoinedCodeActivity,
  deleteActivitiesByTitle,
  deleteUsers,
  listSubmissions,
  listWeighCodes,
  removeEvidence,
  signedInClient,
  type TestUser,
} from "./helpers/supabase-admin";

// Plan Task 8.

function uniqueSuffix(projectName: string): string {
  return `${projectName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

test("student submits with a weigh code (wrong, then right) and sees it pending", async ({ page, browser }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const title = `กิจกรรมส่งผล ${suffix}`;
  let teacher: TestUser | undefined;
  let student: TestUser | undefined;

  try {
    teacher = await createConfirmedUser("teacher", `teacher-sub-${suffix}`);
    student = await createConfirmedUser("student", `student-sub-${suffix}`);
    const activityId = await createJoinedCodeActivity(title, student.id);

    // teacher issues a code at the weigh station (separate browser context)
    const staffContext = await browser.newContext();
    const staffPage = await staffContext.newPage();
    await signIn(staffPage, teacher, "/staff/weigh-station");
    await staffPage.getByLabel("กิจกรรม", { exact: true }).selectOption({ label: title });
    await staffPage.getByRole("button", { name: /^ออกรหัสให้ / }).click();
    const codeLocator = staffPage.getByTestId("weigh-code");
    await expect(codeLocator).toHaveText(/^\d{6}$/);
    const code = (await codeLocator.textContent())!.trim();
    await staffContext.close();
    const wrong = code === "000000" ? "111111" : "000000";

    // student: activity page -> ส่งผล -> form
    await signIn(page, student, `/activities/${activityId}`);
    await page.getByRole("link", { name: "ส่งผล", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === `/activities/${activityId}/submit`);
    await expect(page.getByText("แต้มจริงจะได้เมื่อครูตรวจผ่าน")).toBeVisible();
    await page.getByLabel("รูปหลักฐาน").setInputFiles({ name: "evidence.png", mimeType: "image/png", buffer: PNG_1X1 });

    await page.getByLabel("รหัสจากจุดชั่ง (6 หลัก)").fill(wrong);
    const submit = page.getByRole("button", { name: "ส่งผล" });
    await submit.click();
    await expect(page.getByRole("alert").filter({ hasText: "รหัสไม่ถูกต้อง" })).toBeVisible();
    // a lost response looks like code_invalid on retry: the message links to ผลที่ส่ง
    await expect(page.getByRole("link", { name: "ดูผลที่ส่ง" })).toBeVisible();
    await expect(submit).toBeEnabled();
    // the wrong attempt was committed (returned, not raised: spec 7.1 item 4)
    expect((await listWeighCodes(student.id, activityId)).map((c) => c.attempts)).toEqual([1]);

    await page.getByLabel("รหัสจากจุดชั่ง (6 หลัก)").fill(code);
    await submit.click();
    await expect(page).toHaveURL((url) => url.pathname === "/my-submissions");
    const row = page.getByTestId("submission").filter({ hasText: title });
    await expect(row).toContainText("รอตรวจ");

    const rows = await listSubmissions(student.id, activityId);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("pending");
    expect((await listWeighCodes(student.id, activityId))[0].used_at).not.toBeNull();
    expect(rows[0].evidence_path).toMatch(new RegExp(`^${student.id}/[0-9a-f-]{36}/evidence\\.jpg$`));
  } finally {
    await deleteActivitiesByTitle(title);
    await deleteUsers([teacher, student]);
  }
});

// Review Focus 1 (R28): two sessions submit with the same code at the same time -> one submission.
// The loser now gets already_submitted: fixed is once per student and the participation lock serialises the pair.
test("two concurrent submits with one code create exactly one submission", async ({}, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const title = `กิจกรรมส่งพร้อมกัน ${suffix}`;
  let teacher: TestUser | undefined;
  let student: TestUser | undefined;
  const uploaded: string[] = [];

  try {
    teacher = await createConfirmedUser("teacher", `teacher-race-${suffix}`);
    student = await createConfirmedUser("student", `student-race-${suffix}`);
    const activityId = await createJoinedCodeActivity(title, student.id);

    const staff = await signedInClient(teacher);
    const { data: issued, error: issueError } = await staff.rpc("issue_weigh_code", {
      p_activity_id: activityId,
      p_student_id: student.id,
    });
    expect(issueError).toBeNull();
    const code = (Array.isArray(issued) ? issued[0] : issued).code as string;

    const [a, b] = await Promise.all([signedInClient(student), signedInClient(student)]);
    // Each session uploads its own photo (two devices), so the only shared thing is the code:
    // a photo already used by a submission returns bad_evidence_path before the code is checked.
    const paths: string[] = [];
    for (const client of [a, b]) {
      const path = `${student.id}/${randomUUID()}/evidence.png`;
      const { error: uploadError } = await client.storage.from("evidence").upload(path, PNG_1X1, { contentType: "image/png" });
      expect(uploadError).toBeNull();
      uploaded.push(path);
      paths.push(path);
    }

    const args = (path: string) => ({ p_activity_id: activityId, p_code: code, p_items: [], p_evidence_path: path });
    const results = await Promise.all([a.rpc("submit_result", args(paths[0])), b.rpc("submit_result", args(paths[1]))]);
    for (const r of results) expect(r.error).toBeNull();
    const data = results.map((r) => r.data as { ok: boolean; error_code: string | null; submission_id: string | null });

    expect(data.filter((d) => d.ok)).toHaveLength(1);
    const loser = data.find((d) => !d.ok);
    expect(loser).toEqual({ ok: false, error_code: "already_submitted", submission_id: null });

    const rows = await listSubmissions(student.id, activityId);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(data.find((d) => d.ok)!.submission_id);
  } finally {
    await deleteActivitiesByTitle(title);
    await removeEvidence(uploaded);
    await deleteUsers([teacher, student]);
  }
});

test("student submits waste weights (kg + ขีด) without a code", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const title = `กิจกรรมขยะ ${suffix}`;
  let student: TestUser | undefined;

  try {
    student = await createConfirmedUser("student", `student-waste-${suffix}`);
    const activityId = await createJoinedCodeActivity(title, student.id, {
      type: "waste",
      unit_points: 0,
      requires_code: false,
      max_per_submission: 10_000,
    });

    await signIn(page, student, `/activities/${activityId}/submit`);
    await expect(page.getByLabel("รหัสจากจุดชั่ง (6 หลัก)")).toHaveCount(0);
    await page.getByLabel("พลาสติก กิโลกรัม").fill("1");
    await page.getByLabel("พลาสติก ขีด").fill("5");
    await page.getByLabel("กระดาษ กิโลกรัม").fill("0.2");
    // 1500 g plastic x 10 + 200 g paper x 5 = 16 points (default rates, 0003)
    await expect(page.getByText(/16 แต้ม/)).toBeVisible();

    const submit = page.getByRole("button", { name: "ส่งผล" });
    await submit.click();
    await expect(page.getByRole("alert").filter({ hasText: "ไม่พบรูปหลักฐาน" })).toBeVisible();

    await page.getByLabel("รูปหลักฐาน").setInputFiles({ name: "evidence.png", mimeType: "image/png", buffer: PNG_1X1 });
    await submit.click();
    await expect(page).toHaveURL((url) => url.pathname === "/my-submissions");
    await expect(page.getByTestId("submission").filter({ hasText: title })).toContainText("รอตรวจ");
    expect(await listSubmissions(student.id, activityId)).toHaveLength(1);
  } finally {
    await deleteActivitiesByTitle(title);
    await deleteUsers([student]);
  }
});

// Owner decision 2026-10-20: a fixed activity takes one pending/approved submission per student.
test("student submits a fixed activity once, then sees ส่งผลแล้ว instead of the form", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const title = `กิจกรรมครั้งเดียว ${suffix}`;
  let student: TestUser | undefined;

  try {
    student = await createConfirmedUser("student", `student-once-${suffix}`);
    const activityId = await createJoinedCodeActivity(title, student.id, { requires_code: false });

    await signIn(page, student, `/activities/${activityId}/submit`);
    await page.getByLabel("รูปหลักฐาน").setInputFiles({ name: "evidence.png", mimeType: "image/png", buffer: PNG_1X1 });
    await page.getByRole("button", { name: "ส่งผล" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/my-submissions");

    await page.goto(`/activities/${activityId}`);
    await expect(page.getByText("ส่งผลแล้ว")).toBeVisible();
    await expect(page.getByRole("link", { name: "ส่งผล", exact: true })).toHaveCount(0);

    await page.goto(`/activities/${activityId}/submit`);
    await expect(page.getByText("ส่งผลแล้ว")).toBeVisible();
    await expect(page.getByLabel("รูปหลักฐาน")).toHaveCount(0);
    await page.getByRole("link", { name: "ดูผลที่ส่ง" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/my-submissions");
    expect(await listSubmissions(student.id, activityId)).toHaveLength(1);
  } finally {
    await deleteActivitiesByTitle(title);
    await deleteUsers([student]);
  }
});
