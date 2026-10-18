import { afterEach, describe, expect, it, vi } from "vitest";
import { TimeoutError, withTimeout } from "./timeout";

afterEach(() => {
  vi.useRealTimers();
});

describe("withTimeout", () => {
  it("resolves with the value when the promise settles in time", async () => {
    await expect(withTimeout(Promise.resolve(42), 1000)).resolves.toBe(42);
  });
  it("passes a rejection through", async () => {
    await expect(withTimeout(Promise.reject(new Error("boom")), 1000)).rejects.toThrow("boom");
  });
  it("rejects with TimeoutError when the promise never settles", async () => {
    vi.useFakeTimers();
    const settled = withTimeout(new Promise<never>(() => {}), 60_000).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(60_000);
    const error = await settled;
    expect(error).toBeInstanceOf(TimeoutError);
    expect((error as TimeoutError).code).toBe("request_timeout");
  });
});
