import { describe, expect, it } from "vitest";
import { articleSlugFromPath, isPublishedArticle } from "./not-found-check";

describe("articleSlugFromPath", () => {
  it("returns the slug of /articles/<slug> only", () => {
    expect(articleSlugFromPath("/articles/hello-world")).toBe("hello-world");
    expect(articleSlugFromPath("/articles/hello-world/")).toBe("hello-world");
    expect(articleSlugFromPath("/articles/%E0%B8%81")).toBe("ก");
    expect(articleSlugFromPath("/articles")).toBeNull();
    expect(articleSlugFromPath("/articles/")).toBeNull();
    expect(articleSlugFromPath("/articles/a/b")).toBeNull();
    expect(articleSlugFromPath("/staff/articles/x")).toBeNull();
    expect(articleSlugFromPath("/article-not-found")).toBeNull();
  });

  it("gives an empty slug for undecodable input", () => {
    expect(articleSlugFromPath("/articles/%E0%A4%A")).toBe("");
  });
});

describe("isPublishedArticle", () => {
  it("rejects malformed slugs without a lookup", async () => {
    for (const slug of ["", "Bad Slug", "ก", "-x", "a--b", "x".repeat(81)]) expect(await isPublishedArticle(slug)).toBe(false);
  });
});
