import { describe, expect, it } from "vitest";
import { GENERIC_ERROR_TH, errorCodeFromDb, errorMessageTh } from "./errors";

describe("errorMessageTh", () => {
  it.each(["activity_not_open", "activity_ended", "already_joined", "not_authenticated", "not_student"])(
    "has a Thai message for %s",
    (code) => {
      const message = errorMessageTh(code);
      expect(message).not.toBe(GENERIC_ERROR_TH);
      expect(message).toMatch(/[฀-๿]/);
    },
  );
  it("gives distinct messages for the three join codes", () => {
    const messages = new Set(["activity_not_open", "activity_ended", "already_joined"].map(errorMessageTh));
    expect(messages.size).toBe(3);
  });
  it.each([undefined, null, "", "something_else", "toString", "__proto__"])("falls back for %j", (code) => {
    expect(errorMessageTh(code)).toBe(GENERIC_ERROR_TH);
  });
});

describe("errorCodeFromDb", () => {
  it("returns the code when the message is exactly a known code", () => {
    expect(errorCodeFromDb({ message: "already_joined" })).toBe("already_joined");
    expect(errorCodeFromDb({ message: " activity_ended " })).toBe("activity_ended");
  });
  it("returns null for other messages or no error", () => {
    expect(errorCodeFromDb({ message: 'permission denied for function join_activity' })).toBeNull();
    expect(errorCodeFromDb({ message: null })).toBeNull();
    expect(errorCodeFromDb(null)).toBeNull();
    expect(errorCodeFromDb(undefined)).toBeNull();
  });
});
