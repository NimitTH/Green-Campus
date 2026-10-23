import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ErrorPage from "../error";
import GlobalError from "../global-error";
import StaffError from "../staff/error";
import { ErrorView } from "./error-view";

// R143: the Thai error boundaries. A unit render instead of an e2e trigger: the Next docs offer no test-only
// way to make a real route throw, and a throwing route or query flag would ship to production.

const TITLE = "โหลดข้อมูลไม่สำเร็จ";
const HINT = "ลองใหม่อีกครั้ง หรือกลับหน้าแรก";
// the heading and the hint say different things (no repeated "โหลดข้อมูลไม่สำเร็จ")
const saysOnce = (html: string) => {
  expect(html).toContain(`>${TITLE}</h1>`);
  expect(html).toContain(`>${HINT}</p>`);
  expect(html.split(TITLE).length - 1).toBe(html.includes("<title>") ? 2 : 1);
};
const error = Object.assign(new Error("boom"), { digest: "abc123" });

function findButton(node: ReactNode): ReactElement<{ onClick: () => void }> | null {
  if (!isValidElement(node)) return null;
  const el = node as ReactElement<{ children?: ReactNode; onClick?: () => void }>;
  if (el.type === "button") return el as ReactElement<{ onClick: () => void }>;
  const kids = el.props.children;
  for (const k of Array.isArray(kids) ? kids : [kids]) {
    const hit = findButton(k);
    if (hit) return hit;
  }
  return null;
}

describe("error boundaries (Thai, retry + home link)", () => {
  it("app/error.tsx renders the Thai message, a retry button and a home link", () => {
    const html = renderToStaticMarkup(createElement(ErrorPage, { error, retry: () => {} }));
    saysOnce(html);
    expect(html).toMatch(/<button[^>]*>ลองใหม่อีกครั้ง<\/button>/);
    expect(html).toMatch(/<a href="\/"[^>]*>กลับหน้าแรก<\/a>/);
    expect(html).toContain('role="alert"');
    expect(html).toContain("abc123");
    expect(html).not.toContain("boom"); // never the raw error message
  });

  it("staff/error.tsx links back to /staff", () => {
    const html = renderToStaticMarkup(createElement(StaffError, { error, retry: () => {} }));
    saysOnce(html);
    expect(html).toMatch(/<a href="\/staff"[^>]*>กลับหน้าครูและผู้ดูแล<\/a>/);
  });

  it("global-error.tsx renders its own html/body in Thai", () => {
    const html = renderToStaticMarkup(createElement(GlobalError, { error, retry: () => {} }));
    expect(html).toMatch(/^<html lang="th">/);
    expect(html).toContain("<body");
    saysOnce(html);
    expect(html).toContain("ลองใหม่อีกครั้ง");
  });

  it("the retry button calls retry()", () => {
    const retry = vi.fn();
    const button = findButton(ErrorView({ onRetry: retry }));
    expect(button).not.toBeNull();
    button!.props.onClick();
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
