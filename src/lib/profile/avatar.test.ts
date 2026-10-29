import { afterEach, describe, expect, it, vi } from "vitest";
import { AVATAR_BUCKET, avatarInitial, avatarPublicUrl, isOwnAvatarPath } from "./avatar";

const uid = "11111111-1111-4111-8111-11111111111b";
const other = "22222222-2222-4222-8222-222222222222";
const file = "33333333-3333-4333-8333-33333333333a";

afterEach(() => vi.unstubAllEnvs());

describe("avatarInitial", () => {
  it.each([
    ["มานี ใจดี", "ม"],
    ["เอก", "อ"],
    ["ไพลิน", "พ"],
    ["  somchai", "S"],
    ["", "?"],
    ["   ", "?"],
  ])("%j -> %j", (name, expected) => {
    expect(avatarInitial(name)).toBe(expected);
  });
});

describe("isOwnAvatarPath", () => {
  it("accepts <uid>/<uuid>.jpg", () => {
    expect(isOwnAvatarPath(`${uid}/${file}.jpg`, uid)).toBe(true);
  });
  it.each([
    [`${other}/${file}.jpg`],
    [`${uid}/${file}.png`],
    [`${uid}/../${file}.jpg`],
    [`${uid}/x/${file}.jpg`],
    [`${uid}/${file}.jpg/`],
    [`${uid}/${file}Xjpg`],
    [`${uid}/${file.toUpperCase()}.jpg`],
    [`${uid.toUpperCase()}/${file}.jpg`],
    [""],
  ])("rejects %j", (path) => {
    expect(isOwnAvatarPath(path, uid)).toBe(false);
  });
});

describe("avatarPublicUrl", () => {
  it("is null without a path", () => {
    expect(avatarPublicUrl(null)).toBeNull();
  });
  it("points into the public avatars bucket", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    expect(AVATAR_BUCKET).toBe("avatars");
    expect(avatarPublicUrl(`${uid}/${file}.jpg`)).toBe(`http://127.0.0.1:54321/storage/v1/object/public/avatars/${uid}/${file}.jpg`);
  });
});
