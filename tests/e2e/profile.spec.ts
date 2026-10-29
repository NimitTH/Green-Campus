import { expect, test } from "@playwright/test";
import { openAccountMenu } from "./helpers/account-menu";
import { signIn } from "./helpers/auth";
import { PNG_1X1 } from "./helpers/images";
import { openStaffMenu } from "./helpers/staff-menu";
import { createConfirmedUser, deleteUsers, profileNames, type TestUser } from "./helpers/supabase-admin";

// Plan Task 18 Part B (R123, R124): /profile edits full_name and display_name.

function uniqueSuffix(projectName: string): string {
  return `${projectName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

test("a student changes the display name on /profile and sees it on the leaderboard", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const nick = `ฮีโร่ ${Math.random().toString(36).slice(2, 8)}`;
  let student: TestUser | undefined;
  try {
    student = await createConfirmedUser("student", `student-prof-${suffix}`);
    await signIn(page, student, "/dashboard");
    await page.getByRole("navigation", { name: "เมนูนักเรียน" }).getByRole("link", { name: /โปรไฟล์/ }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/profile");
    await page.goto("/activities");
    await openAccountMenu(page);
    await page.getByRole("banner").getByRole("link", { name: "โปรไฟล์", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/profile");
    await expect(page.getByTestId("profile-role")).toHaveText("นักเรียน");
    await expect(page.getByTestId("profile-email")).toHaveText(student.email);
    await expect(page.getByLabel("ชื่อ-นามสกุลจริง")).toHaveValue("ทดสอบ student");

    // the preview follows the profile_display_name rule
    const display = page.getByLabel(/^ชื่อที่แสดง/);
    await display.fill("   ");
    await expect(page.getByTestId("profile-preview")).toHaveText("ทดสอบ student");
    await display.fill(`  ${nick} `);
    await expect(page.getByTestId("profile-preview")).toHaveText(nick);
    await page.getByRole("button", { name: "บันทึกโปรไฟล์" }).click();
    await expect(page.getByRole("status")).toHaveText("บันทึกแล้ว");
    await expect.poll(async () => (await profileNames(student!.id)).display_name).toBe(nick);

    await page.goto("/leaderboard");
    await expect(page.getByTestId("lb-me")).toContainText(nick);

    // a blank display name falls back to the full name (stored as null)
    await page.goto("/profile");
    await page.getByLabel(/^ชื่อที่แสดง/).fill("");
    await page.getByRole("button", { name: "บันทึกโปรไฟล์" }).click();
    await expect(page.getByRole("status")).toHaveText("บันทึกแล้ว");
    await expect.poll(async () => (await profileNames(student!.id)).display_name).toBeNull();
    await page.goto("/leaderboard");
    await expect(page.getByTestId("lb-me")).toContainText("ทดสอบ student");
  } finally {
    await deleteUsers([student]);
  }
});

test("too-long names show Thai errors and nothing is saved", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  let student: TestUser | undefined;
  try {
    student = await createConfirmedUser("student", `student-prof-long-${suffix}`);
    await signIn(page, student, "/profile");
    await page.getByLabel("ชื่อ-นามสกุลจริง").fill("ก".repeat(101));
    await page.getByLabel(/^ชื่อที่แสดง/).fill("ข".repeat(51));
    await page.getByRole("button", { name: "บันทึกโปรไฟล์" }).click();
    await expect(page.getByText("ชื่อ-นามสกุลยาวได้ไม่เกิน 100 ตัวอักษร")).toBeVisible();
    await expect(page.getByText("ชื่อที่แสดงยาวได้ไม่เกิน 50 ตัวอักษร")).toBeVisible();
    await expect(page.getByLabel("ชื่อ-นามสกุลจริง")).toHaveAttribute("aria-invalid", "true");

    await page.getByLabel("ชื่อ-นามสกุลจริง").fill(" \t ");
    await page.getByLabel(/^ชื่อที่แสดง/).fill("");
    await page.getByRole("button", { name: "บันทึกโปรไฟล์" }).click();
    await expect(page.getByText("กรอกชื่อ-นามสกุลจริง")).toBeVisible();

    expect(await profileNames(student.id)).toEqual({ full_name: "ทดสอบ student", display_name: "ทดสอบ student" });
  } finally {
    await deleteUsers([student]);
  }
});

test("staff opening /profile get the staff profile in the staff chrome, which fits 360 px and leads back to /staff", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  let teacher: TestUser | undefined;
  try {
    teacher = await createConfirmedUser("teacher", `teacher-prof-${suffix}`);
    await signIn(page, teacher, "/staff");
    // R142 / M7: /profile sends staff to /staff/profile (staff shell, no student nav)
    await page.goto("/profile");
    await expect(page).toHaveURL((url) => url.pathname === "/staff/profile");
    await expect(page.getByTestId("profile-role")).toHaveText("ครู");
    await page.setViewportSize({ width: 360, height: 800 });
    await expect(page.getByRole("navigation", { name: "เมนูหลัก" })).toHaveCount(0);
    await openStaffMenu(page);
    const nav = page.getByRole("navigation", { name: "เมนูผู้ดูแล" });
    await expect(nav.getByRole("link", { name: "โปรไฟล์", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "บทความ", exact: true })).toBeVisible();
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    await nav.getByRole("link", { name: "หน้าหลัก", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/staff");
  } finally {
    await deleteUsers([teacher]);
  }
});

test("anonymous visitors of /profile are sent to sign in", async ({ browser }) => {
  const anon = await browser.newContext();
  try {
    const page = await anon.newPage();
    await page.goto("/profile");
    await expect(page).toHaveURL((url) => url.pathname === "/login" && url.searchParams.get("next") === "/profile");
  } finally {
    await anon.close();
  }
});

test.describe("profile picture", () => {
  test("a student uploads, keeps it on a bad file, and removes it", async ({ page }, testInfo) => {
    const suffix = uniqueSuffix(testInfo.project.name);
    let student: TestUser | undefined;
    try {
      student = await createConfirmedUser("student", `student-avatar-${suffix}`);
      await signIn(page, student, "/profile");
      const section = page.locator("section[aria-labelledby='profile-avatar']");
      await expect(section.locator("img")).toHaveCount(0);
      await expect(section.getByRole("button", { name: "ลบรูป" })).toHaveCount(0);

      await section.locator("input[type=file]").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: PNG_1X1 });
      const img = section.locator("img");
      await expect(img).toHaveCount(1);
      await expect(img).toHaveAttribute("src", /\/avatars\//);
      const before = await img.getAttribute("src");

      // a non-image: Thai error, the picture stays
      await section.locator("input[type=file]").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
      await expect(section.getByRole("alert")).toContainText("ไฟล์นี้ไม่ใช่รูปภาพ");
      await expect(img).toHaveAttribute("src", before!);

      await section.getByRole("button", { name: "ลบรูป" }).click();
      await expect(section.locator("img")).toHaveCount(0);
      await expect(section.locator("span[aria-hidden='true']")).toHaveText("ท");
    } finally {
      await deleteUsers([student]);
    }
  });
});

test.describe("change email and password", () => {
  const MAILPIT = "http://127.0.0.1:54324";
  const WRONG = "รหัสผ่านปัจจุบันไม่ถูกต้อง";

  /** The GoTrue confirmation URL in the newest Mailpit message to `address`, polled for up to 10 s. */
  async function waitForLink(address: string): Promise<string> {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const search = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`);
      const messages = search.ok ? ((await search.json()) as { messages?: { ID: string }[] }).messages ?? [] : [];
      if (messages.length > 0) {
        const detail = await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`);
        const body = (await detail.json()) as { Text?: string; HTML?: string };
        const match = `${body.Text ?? ""} ${body.HTML ?? ""}`.match(/https?:\/\/[^\s"'<>)]*\/auth\/v1\/verify[^\s"'<>)]*/);
        if (match) return match[0].replace(/&amp;/g, "&");
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error("no confirmation message in Mailpit for the address");
  }

  test("the profile page has no theme section and the sections run in order", async ({ page }, testInfo) => {
    let student: TestUser | undefined;
    try {
      student = await createConfirmedUser("student", `student-order-${uniqueSuffix(testInfo.project.name)}`);
      await signIn(page, student, "/profile");
      await expect(page.getByRole("heading", { name: "รหัสผ่าน", exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "ธีม" })).toHaveCount(0);
      const headings = await page.locator("main h2").allTextContents();
      const order = ["รูปโปรไฟล์", "อีเมล", "รหัสผ่าน"].map((h) => headings.indexOf(h));
      expect(order.every((i) => i >= 0)).toBe(true);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
      await expect(page.getByText(`อีเมลปัจจุบัน: ${student.email}`)).toBeVisible();
    } finally {
      await deleteUsers([student]);
    }
  });

  test("a wrong current password is rejected and the session stays signed in", async ({ page, context }, testInfo) => {
    let student: TestUser | undefined;
    try {
      student = await createConfirmedUser("student", `student-wrongpw-${uniqueSuffix(testInfo.project.name)}`);
      await signIn(page, student, "/profile");
      const authCookies = async () =>
        (await context.cookies()).filter((c) => c.name.startsWith("sb-")).map((c) => `${c.name}=${c.value}`).sort();
      const before = await authCookies();
      expect(before.length).toBeGreaterThan(0);

      const pw = page.locator("section[aria-labelledby='profile-password']");
      await pw.getByLabel("รหัสผ่านปัจจุบัน").fill("definitely-not-it");
      await pw.getByLabel("รหัสผ่านใหม่").fill("Another-pass-123");
      await pw.getByRole("button", { name: "เปลี่ยนรหัสผ่าน" }).click();
      await expect(pw.getByText(WRONG)).toBeVisible();

      const mail = page.locator("section[aria-labelledby='profile-email']");
      await mail.getByLabel("อีเมลใหม่").fill(`other-${Date.now()}@example.test`);
      await mail.getByLabel("รหัสผ่านปัจจุบัน").fill("definitely-not-it");
      await mail.getByRole("button", { name: "เปลี่ยนอีเมล" }).click();
      await expect(mail.getByText(WRONG)).toBeVisible();
      await expect(mail.getByRole("status")).toHaveCount(0);

      expect(await authCookies()).toEqual(before);
      await page.goto("/dashboard");
      await expect(page).toHaveURL((url) => url.pathname === "/dashboard");
    } finally {
      await deleteUsers([student]);
    }
  });

  test("a correct current password changes the password; sign out and in with the new one", async ({ page }, testInfo) => {
    let student: TestUser | undefined;
    try {
      student = await createConfirmedUser("student", `student-newpw-${uniqueSuffix(testInfo.project.name)}`);
      await signIn(page, student, "/profile");
      const pw = page.locator("section[aria-labelledby='profile-password']");

      await pw.getByLabel("รหัสผ่านปัจจุบัน").fill(student.password);
      await pw.getByLabel("รหัสผ่านใหม่").fill("short");
      await pw.getByRole("button", { name: "เปลี่ยนรหัสผ่าน" }).click();
      await expect(pw.getByText("รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร")).toBeVisible();

      const next = `New-${Math.random().toString(36).slice(2, 10)}-pass`;
      await pw.getByLabel("รหัสผ่านใหม่").fill(next);
      await pw.getByRole("button", { name: "เปลี่ยนรหัสผ่าน" }).click();
      await expect(pw.getByRole("status")).toHaveText("เปลี่ยนรหัสผ่านแล้ว");
      await expect(pw.getByLabel("รหัสผ่านปัจจุบัน")).toHaveValue("");
      await expect(pw.getByLabel("รหัสผ่านใหม่")).toHaveValue("");

      await page.getByRole("button", { name: "ออกจากระบบ" }).click();
      await expect(page).toHaveURL((url) => url.pathname === "/login");
      student.password = next;
      await signIn(page, student, "/dashboard");
    } finally {
      await deleteUsers([student]);
    }
  });

  test("an email change needs both links: first shows pending, second changes the email", async ({ page }, testInfo) => {
    let student: TestUser | undefined;
    try {
      student = await createConfirmedUser("student", `student-newmail-${uniqueSuffix(testInfo.project.name)}`);
      const newEmail = `changed-${uniqueSuffix(testInfo.project.name)}@example.test`.toLowerCase();
      await signIn(page, student, "/profile");
      const mail = page.locator("section[aria-labelledby='profile-email']");

      await mail.getByLabel("อีเมลใหม่").fill(student.email.toUpperCase());
      await mail.getByLabel("รหัสผ่านปัจจุบัน").fill(student.password);
      await mail.getByRole("button", { name: "เปลี่ยนอีเมล" }).click();
      await expect(mail.getByText("อีเมลใหม่ต้องไม่ซ้ำกับอีเมลปัจจุบัน")).toBeVisible();

      await mail.getByLabel("อีเมลใหม่").fill(newEmail);
      await mail.getByRole("button", { name: "เปลี่ยนอีเมล" }).click();
      await expect(mail.getByRole("status")).toHaveText(
        "ส่งลิงก์ยืนยันแล้ว กรุณากดยืนยันในอีเมลทั้งเก่าและใหม่ อีเมลจะเปลี่ยนเมื่อยืนยันครบ",
      );
      await expect(mail.getByLabel("อีเมลใหม่")).toHaveValue("");

      // double_confirm_changes: one confirmation message to each address
      const oldLink = await waitForLink(student.email);
      const newLink = await waitForLink(newEmail);

      await page.goto(oldLink);
      // local GoTrue reports the first click in the URL fragment (#message=...), which the server cannot see
      await expect(page).toHaveURL((url) => url.pathname === "/profile" && url.hash.includes("message="));
      await expect(page.getByText("ยืนยันอีเมลหนึ่งฉบับแล้ว กรุณากดลิงก์ยืนยันในอีเมลอีกฉบับเพื่อเปลี่ยนอีเมลให้เสร็จ")).toBeVisible();
      await expect(page.getByText("ลิงก์ยืนยันใช้ไม่ได้หรือหมดอายุ")).toHaveCount(0);

      await page.goto(newLink);
      await expect(page).toHaveURL((url) => url.pathname === "/profile" && url.searchParams.get("email") === "changed");
      await expect(page.getByText("เปลี่ยนอีเมลแล้ว")).toBeVisible();

      // the sign-in email is now the new one
      await page.getByRole("button", { name: "ออกจากระบบ" }).click();
      await expect(page).toHaveURL((url) => url.pathname === "/login");
      await signIn(page, { ...student, email: newEmail }, "/dashboard");
    } finally {
      await deleteUsers([student]);
    }
  });

  test("the email-change callback notices show on /profile", async ({ page }, testInfo) => {
    let student: TestUser | undefined;
    try {
      student = await createConfirmedUser("student", `student-notice-${uniqueSuffix(testInfo.project.name)}`);
      await signIn(page, student, "/profile");
      await page.goto("/profile?email=changed");
      await expect(page.getByText("เปลี่ยนอีเมลแล้ว")).toBeVisible();
      await page.goto("/profile?email=link-error");
      await expect(page.getByText("ลิงก์ยืนยันใช้ไม่ได้หรือหมดอายุ ลองขอใหม่อีกครั้ง")).toBeVisible();
      await page.goto("/profile?email=pending");
      await expect(page.getByText("ยืนยันอีเมลหนึ่งฉบับแล้ว")).toBeVisible();
      await page.goto("/profile?email=link-error#error=access_denied&error_code=otp_expired");
      await expect(page.getByText("ลิงก์ยืนยันใช้ไม่ได้หรือหมดอายุ ลองขอใหม่อีกครั้ง")).toBeVisible();
      await page.goto("/profile?email=whatever");
      await expect(page.getByText("เปลี่ยนอีเมลแล้ว")).toHaveCount(0);
      // a bad link on the callback route lands on the failure notice
      await page.goto("/auth/callback/email?message=Confirmation+link+accepted");
      await expect(page).toHaveURL((url) => url.pathname === "/profile" && url.searchParams.get("email") === "pending");
      await page.goto("/auth/callback/email?code=bad");
      await expect(page).toHaveURL((url) => url.pathname === "/profile" && url.searchParams.get("email") === "link-error");
    } finally {
      await deleteUsers([student]);
    }
  });

  test("staff keep the email notice when /profile sends them to /staff/profile", async ({ page }, testInfo) => {
    let teacher: TestUser | undefined;
    try {
      teacher = await createConfirmedUser("teacher", `teacher-notice-${uniqueSuffix(testInfo.project.name)}`);
      await signIn(page, teacher, "/staff");
      await page.goto("/profile?email=changed");
      await expect(page).toHaveURL((url) => url.pathname === "/staff/profile" && url.searchParams.get("email") === "changed");
      await expect(page.getByText("เปลี่ยนอีเมลแล้ว")).toBeVisible();
    } finally {
      await deleteUsers([teacher]);
    }
  });

  test("the eye button toggles the password field between hidden and visible", async ({ page }, testInfo) => {
    let student: TestUser | undefined;
    try {
      student = await createConfirmedUser("student", `student-eye-${uniqueSuffix(testInfo.project.name)}`);
      await signIn(page, student, "/profile");
      const pw = page.locator("section[aria-labelledby='profile-password']");
      const input = pw.getByLabel("รหัสผ่านใหม่");
      await expect(input).toHaveAttribute("type", "password");
      const eye = pw.getByRole("button", { name: "แสดงรหัสผ่าน" }).last();
      const box = await eye.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
      await eye.click();
      await expect(input).toHaveAttribute("type", "text");
      await pw.getByRole("button", { name: "ซ่อนรหัสผ่าน" }).click();
      await expect(input).toHaveAttribute("type", "password");
    } finally {
      await deleteUsers([student]);
    }
  });
});
