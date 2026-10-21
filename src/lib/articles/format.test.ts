import { describe, expect, it } from "vitest";
import {
  ARTICLE_LIMITS,
  excerpt,
  generateSlug,
  isArticleInputShape,
  isValidSlug,
  SLUG_TAKEN_TH,
  splitParagraphs,
  validateArticle,
} from "./format";

describe("isValidSlug", () => {
  it.each(["a", "abc", "a-b", "waste-101", "a-0f2z9k1q", "x".repeat(80), "2026-recycling-tips"])("%s is valid", (s) =>
    expect(isValidSlug(s)).toBe(true),
  );
  it.each(["", "A", "Abc", "a b", "a--b", "-a", "a-", "a_b", "ภาษาไทย", "a/b", "a.b", "x".repeat(81), " a"])(
    "%j is invalid",
    (s) => expect(isValidSlug(s)).toBe(false),
  );
});

describe("generateSlug", () => {
  it("is a- plus 8 base36 characters and always valid", () => {
    for (let i = 0; i < 200; i++) {
      const slug = generateSlug();
      expect(slug).toMatch(/^a-[0-9a-z]{8}$/);
      expect(isValidSlug(slug)).toBe(true);
    }
  });
  it("uses the injected random source", () => {
    expect(generateSlug(() => 0)).toBe("a-00000000");
    expect(generateSlug(() => 35)).toBe("a-zzzzzzzz");
    let n = 0;
    expect(generateSlug(() => n++)).toBe("a-01234567");
  });
  it("differs between calls", () => {
    const seen = new Set(Array.from({ length: 50 }, () => generateSlug()));
    expect(seen.size).toBe(50);
  });
});

describe("splitParagraphs", () => {
  it("splits on blank lines and keeps single line breaks inside a paragraph", () => {
    expect(splitParagraphs("one\ntwo\n\nthree")).toEqual(["one\ntwo", "three"]);
  });
  it("treats CRLF and whitespace-only lines as blank lines and merges runs of them", () => {
    expect(splitParagraphs("a\r\n\r\nb\n \t \n\n\nc")).toEqual(["a", "b", "c"]);
  });
  it("trims each paragraph and drops empty ones", () => {
    expect(splitParagraphs("\n\n  first  \n\n\n")).toEqual(["first"]);
    expect(splitParagraphs("")).toEqual([]);
    expect(splitParagraphs(" \n\t\n ")).toEqual([]);
  });
  it("keeps markup as plain text (rendered as text, never as HTML)", () => {
    expect(splitParagraphs("<script>alert(1)</script>\n\n**bold**")).toEqual(["<script>alert(1)</script>", "**bold**"]);
  });
});

describe("excerpt", () => {
  it("collapses whitespace", () => {
    expect(excerpt("a\n\nb\tc   d")).toBe("a b c d");
  });
  it("cuts long text and adds an ellipsis", () => {
    const text = "ก".repeat(200);
    const out = excerpt(text, 10);
    expect(out).toBe(`${"ก".repeat(10)}…`);
  });
  it("leaves short text alone", () => {
    expect(excerpt("สั้น", 10)).toBe("สั้น");
    expect(excerpt("", 10)).toBe("");
  });
});

describe("validateArticle", () => {
  const ok = { title: "  ลดขยะ  พลาสติก ", slug: "", body: "ย่อหน้า\n\nสอง", published: false };

  it("accepts a valid article, collapses the title and leaves a blank slug to be generated", () => {
    const r = validateArticle(ok);
    expect(r).toEqual({ ok: true, value: { title: "ลดขยะ พลาสติก", slug: null, body: "ย่อหน้า\n\nสอง", published: false } });
  });
  it("trims and lowercases a typed slug", () => {
    const r = validateArticle({ ...ok, slug: "  Waste-Tips " });
    expect(r.ok && r.value.slug).toBe("waste-tips");
  });
  it("rejects a bad slug with a Thai message", () => {
    for (const slug of ["a b", "a--b", "ภาษา", "x".repeat(81)]) {
      const r = validateArticle({ ...ok, slug });
      expect(r.ok).toBe(false);
      expect(!r.ok && r.fieldErrors.slug).toMatch(/slug/);
    }
  });
  it("requires a title and limits its length", () => {
    expect(validateArticle({ ...ok, title: " \n\t " }).ok).toBe(false);
    const long = validateArticle({ ...ok, title: "ก".repeat(ARTICLE_LIMITS.titleMax + 1) });
    expect(!long.ok && long.fieldErrors.title).toContain(String(ARTICLE_LIMITS.titleMax));
    expect(validateArticle({ ...ok, title: "ก".repeat(ARTICLE_LIMITS.titleMax) }).ok).toBe(true);
  });
  it("requires a body and limits its length", () => {
    expect(validateArticle({ ...ok, body: "\n \n" }).ok).toBe(false);
    expect(validateArticle({ ...ok, body: "ข".repeat(ARTICLE_LIMITS.bodyMax + 1) }).ok).toBe(false);
  });
  it("normalises CRLF and trims the body", () => {
    const r = validateArticle({ ...ok, body: "\r\n a\r\n\r\nb \r\n" });
    expect(r.ok && r.value.body).toBe("a\n\nb");
  });
  it("has the agreed duplicate-slug wording", () => {
    expect(SLUG_TAKEN_TH).toBe("slug นี้ถูกใช้แล้ว");
  });
});

describe("isArticleInputShape", () => {
  it("accepts the form shape only", () => {
    expect(isArticleInputShape({ title: "", slug: "", body: "", published: true })).toBe(true);
    expect(isArticleInputShape({ title: "", slug: "", body: "" })).toBe(false);
    expect(isArticleInputShape({ title: 1, slug: "", body: "", published: true })).toBe(false);
    expect(isArticleInputShape(null)).toBe(false);
    expect(isArticleInputShape([])).toBe(false);
  });
});
