import { describe, expect, it } from "vitest";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/messages";
import { TEMP_PASSWORD_ALPHABET, TEMP_PASSWORD_LENGTH, generateTempPassword } from "./temp-password";

/** A deterministic byte source: 0, 1, 2, ... (wrapping at 256). */
function counter(start = 0): (n: number) => Uint8Array {
  let next = start;
  return (n) => {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) out[i] = next++ % 256;
    return out;
  };
}

/** Plays back the given bytes, then repeats the last one. */
function sequence(bytes: number[]): (n: number) => Uint8Array {
  let i = 0;
  return (n) => {
    const out = new Uint8Array(n);
    for (let k = 0; k < n; k++) out[k] = bytes[Math.min(i++, bytes.length - 1)];
    return out;
  };
}

const ALLOWED = new Set(TEMP_PASSWORD_ALPHABET);

describe("generateTempPassword", () => {
  it("uses the spec alphabet (no look-alike characters)", () => {
    expect(TEMP_PASSWORD_ALPHABET).toBe("ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789");
  });

  it("has length 10, only allowed characters, a digit and a letter, and passes MIN_PASSWORD_LENGTH", () => {
    for (const start of [0, 7, 46, 120, 200]) {
      const pw = generateTempPassword(counter(start));
      expect(pw).toHaveLength(TEMP_PASSWORD_LENGTH);
      expect(TEMP_PASSWORD_LENGTH).toBe(10);
      for (const ch of pw) expect(ALLOWED.has(ch)).toBe(true);
      expect(pw).toMatch(/[0-9]/);
      expect(pw).toMatch(/[A-Za-z]/);
      expect(pw.length).toBeGreaterThanOrEqual(MIN_PASSWORD_LENGTH);
    }
  });

  it("is deterministic for a deterministic source", () => {
    expect(generateTempPassword(counter(3))).toBe(generateTempPassword(counter(3)));
  });

  it("skips bytes at or above the largest multiple of the alphabet size (rejection sampling, no modulo bias)", () => {
    const size = TEMP_PASSWORD_ALPHABET.length; // 54 -> bytes 216..255 are rejected
    const limit = Math.floor(256 / size) * size;
    const bytes = [255, limit, 0, limit + 1, 46, 1, 2, 3, 4, 5, 6, 7, 8];
    // 255, 216, 217 are skipped; 0 -> "A", 46 -> "2", 1..8 -> "B".."J" minus I
    expect(generateTempPassword(sequence(bytes))).toBe(`A2${TEMP_PASSWORD_ALPHABET.slice(1, 9)}`);
  });

  it("draws again when a candidate has no digit (or no letter)", () => {
    // first 10 bytes are letters only (0..9), so that candidate is dropped; the next one has a digit
    const pw = generateTempPassword(counter(0));
    expect(pw).toMatch(/[0-9]/);
  });

  it("throws instead of looping forever on a broken source", () => {
    expect(() => generateTempPassword(() => new Uint8Array(64).fill(255))).toThrow();
  });

  it("uses crypto randomness by default", () => {
    const a = generateTempPassword();
    const b = generateTempPassword();
    expect(a).toHaveLength(10);
    expect(a).not.toBe(b);
  });
});
