import { describe, expect, it } from "vitest";
import { fetchWithTimeout } from "./fetch-timeout";

// A fake fetch that never answers, but rejects like the real one when its signal aborts.
const hanging: typeof fetch = (_input, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
  });

describe("fetchWithTimeout (M1)", () => {
  it("aborts a hanging request after the timeout", async () => {
    const started = Date.now();
    await expect(fetchWithTimeout(30, hanging)("http://x.invalid")).rejects.toMatchObject({ name: "TimeoutError" });
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("passes a fast response through, with the caller's init", async () => {
    let seen: RequestInit | undefined;
    const ok: typeof fetch = async (_input, init) => {
      seen = init;
      return new Response("ok");
    };
    const res = await fetchWithTimeout(1000, ok)("http://x.invalid", { method: "POST", headers: { a: "b" } });
    expect(await res.text()).toBe("ok");
    expect(seen?.method).toBe("POST");
    expect(seen?.headers).toEqual({ a: "b" });
    expect(seen?.signal).toBeInstanceOf(AbortSignal);
  });

  it("keeps the caller's own abort signal working", async () => {
    const controller = new AbortController();
    const pending = fetchWithTimeout(10_000, hanging)("http://x.invalid", { signal: controller.signal });
    controller.abort(new Error("caller aborted"));
    await expect(pending).rejects.toThrow("caller aborted");
  });
});
