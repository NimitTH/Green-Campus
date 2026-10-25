import { test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { signIn } from "../e2e/helpers/auth";
import { createConfirmedUser, deleteUsers, type TestUser } from "../e2e/helpers/supabase-admin";

// Screenshots of every route x width x theme for visual review. Tags: @shell @public @student @staff.
const WIDTHS = [360, 1280] as const;
const THEMES = ["light", "dark"] as const;
const OUT = path.join(process.cwd(), "test-results", "screens");

const GROUPS: Record<"public" | "student" | "staff" | "shell", { tag: string; role: "none" | "student" | "admin"; routes: string[] }> = {
  public: { tag: "@public", role: "none", routes: ["/", "/articles", "/login", "/register", "/forgot-password"] },
  student: {
    tag: "@student",
    role: "student",
    routes: ["/dashboard", "/activities", "/my-submissions", "/leaderboard", "/rewards", "/cart", "/orders", "/notifications", "/profile"],
  },
  staff: {
    tag: "@staff",
    role: "admin",
    routes: [
      "/staff", "/staff/reviews", "/staff/activities", "/staff/activities/new", "/staff/weigh-station", "/staff/orders",
      "/staff/rewards", "/staff/rewards/new", "/staff/articles", "/staff/articles/new", "/staff/reports", "/staff/users",
      "/staff/rates", "/staff/profile", "/staff/notifications",
    ],
  },
  // layout skeleton: one public, one student, one staff page. Signed in as the matching user.
  shell: { tag: "@shell", role: "none", routes: [] },
};

const SHELL_ROUTES: { route: string; role: "none" | "student" | "admin" }[] = [
  { route: "/articles", role: "none" },
  { route: "/dashboard", role: "student" },
  { route: "/staff", role: "admin" },
];

function slug(route: string): string {
  return route === "/" ? "home" : route.replace(/^\//, "").replace(/\//g, "-");
}

async function shoot(page: Page, group: string, route: string): Promise<void> {
  for (const width of WIDTHS) {
    for (const theme of THEMES) {
      await page.setViewportSize({ width, height: 800 });
      await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      const dir = path.join(OUT, group);
      mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: path.join(dir, `${slug(route)}-${width}-${theme}.png`), fullPage: true });
    }
  }
}

test.describe.configure({ mode: "serial" });

let student: TestUser | undefined;
let teacher: TestUser | undefined;
let admin: TestUser | undefined;

test.beforeAll(async () => {
  const s = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  student = await createConfirmedUser("student", `shots-student-${s}`);
  teacher = await createConfirmedUser("teacher", `shots-teacher-${s}`);
  admin = await createConfirmedUser("admin", `shots-admin-${s}`);
});

test.afterAll(async () => {
  await deleteUsers([student, teacher, admin]);
});

function userFor(role: "none" | "student" | "admin"): TestUser | undefined {
  return role === "student" ? student : role === "admin" ? admin : undefined;
}

for (const key of ["public", "student", "staff"] as const) {
  const g = GROUPS[key];
  test(`screens ${g.tag}`, async ({ page }) => {
    const user = userFor(g.role);
    if (user) await signIn(page, user, g.routes[0]);
    for (const route of g.routes) await shoot(page, key, route);
  });
}

// one test per page so each gets a fresh browser context (a student session would redirect the admin login)
for (const { route, role } of SHELL_ROUTES) {
  test(`screens ${GROUPS.shell.tag} ${route}`, async ({ page }) => {
    const user = userFor(role);
    if (user) await signIn(page, user, route);
    await shoot(page, "shell", route);
  });
}
