import { describe, expect, it } from "vitest";
import { GENERIC_ERROR_TH, errorCodeFromDb, errorMessageTh, submitErrorMessageTh, uploadErrorCode } from "./errors";

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

describe("weigh code errors (issue_weigh_code)", () => {
  const codes = ["not_staff", "activity_not_found", "code_not_required", "not_participant", "out_of_window"];
  it.each(codes)("has a Thai message for %s", (code) => {
    expect(errorMessageTh(code)).not.toBe(GENERIC_ERROR_TH);
    expect(errorMessageTh(code)).toMatch(/[฀-๿]/);
    expect(errorCodeFromDb({ message: code })).toBe(code);
  });
  it("gives distinct messages", () => {
    expect(new Set(codes.map(errorMessageTh)).size).toBe(codes.length);
  });
});

describe("activity delete blocked (trigger activity_has_submissions)", () => {
  it("maps to the Thai 'close it instead' message", () => {
    expect(errorMessageTh("activity_has_submissions")).toBe("ลบไม่ได้ เพราะมีผู้ส่งผลแล้ว ให้ปิดกิจกรรมแทน");
  });
  it("is recognised in a database error", () => {
    expect(errorCodeFromDb({ message: "activity_has_submissions" })).toBe("activity_has_submissions");
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

describe("submit errors (submit_result, image upload)", () => {
  const submitCodes = [
    "code_required",
    "code_invalid",
    "code_expired",
    "code_locked",
    "not_participant",
    "out_of_window",
    "over_limit",
    "invalid_items",
    "bad_evidence_path",
    "evidence_already_used",
  ];
  const clientCodes = ["not_image", "image_too_large", "upload_failed"];
  it.each([...submitCodes, ...clientCodes])("has a Thai message for %s", (code) => {
    expect(submitErrorMessageTh(code)).not.toBe(GENERIC_ERROR_TH);
    expect(submitErrorMessageTh(code)).toMatch(/[฀-๿]/);
    expect(errorMessageTh(code)).not.toBe(GENERIC_ERROR_TH);
  });
  it("gives distinct messages for every submit code", () => {
    const all = [...submitCodes, ...clientCodes];
    expect(new Set(all.map(submitErrorMessageTh)).size).toBe(all.length);
  });
  it("speaks to the student for codes shared with the weigh station", () => {
    expect(submitErrorMessageTh("not_participant")).not.toBe(errorMessageTh("not_participant"));
    expect(submitErrorMessageTh("out_of_window")).not.toBe(errorMessageTh("out_of_window"));
    expect(submitErrorMessageTh("out_of_window")).not.toMatch(/ออกรหัส/);
  });
  it("falls back like errorMessageTh", () => {
    expect(submitErrorMessageTh("already_joined")).toBe(errorMessageTh("already_joined"));
    expect(submitErrorMessageTh(null)).toBe(GENERIC_ERROR_TH);
    expect(submitErrorMessageTh("__proto__")).toBe(GENERIC_ERROR_TH);
  });
});

describe("submit follow-ups (review)", () => {
  it("code_invalid tells a student who just submitted to check ผลที่ส่ง", () => {
    expect(submitErrorMessageTh("code_invalid")).toMatch(/ผลที่ส่ง/);
  });
  it.each(["request_timeout", "upload_unauthorized"])("has a Thai message for %s", (code) => {
    expect(submitErrorMessageTh(code)).not.toBe(GENERIC_ERROR_TH);
    expect(submitErrorMessageTh(code)).toMatch(/[฀-๿]/);
  });
  it("upload_unauthorized asks the student to sign in again", () => {
    expect(submitErrorMessageTh("upload_unauthorized")).toMatch(/เข้าสู่ระบบใหม่/);
  });
});

describe("uploadErrorCode", () => {
  it.each([
    [{ status: 401, statusCode: "401", message: "Unauthorized" }],
    [{ status: 403, statusCode: "403", message: "Forbidden" }],
    [{ status: 400, statusCode: "403", message: "new row violates row-level security policy" }],
    [{ status: 400, statusCode: "400", message: "new row violates row-level security policy for table \"objects\"" }],
    [{ status: 400, statusCode: "400", message: "jwt expired" }],
  ])("maps auth / RLS errors %j to upload_unauthorized", (error) => {
    expect(uploadErrorCode(error)).toBe("upload_unauthorized");
  });
  it.each([
    [{ status: 500, statusCode: "500", message: "Internal Server Error" }],
    [{ status: 413, statusCode: "413", message: "Payload too large" }],
    [{ message: "Failed to fetch" }],
    [null],
    [undefined],
  ])("keeps network and other errors %j on upload_failed", (error) => {
    expect(uploadErrorCode(error)).toBe("upload_failed");
  });
});

describe("evidence_already_used", () => {
  it("says the photo was used and points to ผลที่ส่ง, unlike bad_evidence_path", () => {
    const message = submitErrorMessageTh("evidence_already_used");
    expect(message).toMatch(/ใช้ส่งผลไปแล้ว/);
    expect(message).toMatch(/ผลที่ส่ง/);
    expect(message).not.toBe(submitErrorMessageTh("bad_evidence_path"));
  });
});
