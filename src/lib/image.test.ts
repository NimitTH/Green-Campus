import { afterEach, describe, expect, it, vi } from "vitest";
import { GENERIC_ERROR_TH, errorMessageTh } from "./errors";
import { ImageError, MAX_UPLOAD_BYTES, resizeToJpeg, type ImageCodec } from "./image";

// Vitest runs in Node (no canvas): decode/encode are injected. The fake encoder makes a JPEG
// whose size grows with the pixel count and the quality, like a real one.
function fakeCodec(opts: { width?: number; height?: number; bytesPerPixel?: number } = {}) {
  const width = opts.width ?? 4032;
  const height = opts.height ?? 3024;
  const bytesPerPixel = opts.bytesPerPixel ?? 0.6;
  const encodes: { width: number; height: number; quality: number }[] = [];
  const codec: ImageCodec = {
    decode: vi.fn(async () => ({ width, height, source: {}, close: () => {} })),
    encode: vi.fn(async (_source, w, h, quality) => {
      encodes.push({ width: w, height: h, quality });
      const size = Math.round(w * h * quality * bytesPerPixel);
      return new Blob([new Uint8Array(size)], { type: "image/jpeg" });
    }),
  };
  return { codec, encodes };
}

function bigFile(name: string, type: string, bytes = 5 * 1024 * 1024): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

async function rejection(promise: Promise<unknown>): Promise<ImageError> {
  try {
    await promise;
  } catch (e) {
    expect(e).toBeInstanceOf(ImageError);
    return e as ImageError;
  }
  throw new Error("expected a rejection");
}

afterEach(() => {
  vi.useRealTimers();
});

describe("resizeToJpeg", () => {
  it.each([
    ["photo.heic", "image/heic"],
    ["photo.HEIF", "image/heif"],
    ["IMG_0001.heic", ""],
  ])("converts HEIC input %s (%j) to image/jpeg <= 2 MB", async (name, type) => {
    const { codec } = fakeCodec();
    const out = await resizeToJpeg(bigFile(name, type), undefined, undefined, { codec });
    expect(out.type).toBe("image/jpeg");
    expect(out.size).toBeLessThanOrEqual(MAX_UPLOAD_BYTES);
    expect(codec.decode).toHaveBeenCalledTimes(1);
  });

  it("shrinks a > 2 MB photo to <= 2 MB, lowering quality before the edge", async () => {
    const { codec, encodes } = fakeCodec();
    const out = await resizeToJpeg(bigFile("big.jpg", "image/jpeg", 6 * 1024 * 1024), 1600, 0.8, { codec });
    expect(out.type).toBe("image/jpeg");
    expect(out.size).toBeLessThanOrEqual(MAX_UPLOAD_BYTES);
    expect(out.size).toBeLessThanOrEqual(300 * 1024);
    // first try: long edge 1600, aspect ratio kept, the given quality
    expect(encodes[0]).toEqual({ width: 1600, height: 1200, quality: 0.8 });
    // quality goes down at 1600 before the edge shrinks
    expect(encodes[1].width).toBe(1600);
    expect(encodes[1].quality).toBeLessThan(0.8);
    expect(Math.max(...encodes.map((e) => Math.max(e.width, e.height)))).toBe(1600);
  });

  it("does not upscale a small photo", async () => {
    const { codec, encodes } = fakeCodec({ width: 800, height: 600 });
    await resizeToJpeg(bigFile("small.png", "image/png", 100_000), 1600, 0.8, { codec });
    expect(encodes[0]).toEqual({ width: 800, height: 600, quality: 0.8 });
  });

  it("returns the first try when it is already small enough", async () => {
    const { codec, encodes } = fakeCodec({ width: 640, height: 480 });
    const out = await resizeToJpeg(bigFile("ok.webp", "image/webp", 50_000), 1600, 0.8, { codec });
    expect(encodes).toHaveLength(1);
    expect(out.size).toBe(Math.round(640 * 480 * 0.8 * 0.6));
  });

  it("rejects a non-image with not_image (Thai message) without decoding", async () => {
    const { codec } = fakeCodec();
    const err = await rejection(resizeToJpeg(new File(["hello"], "notes.txt", { type: "text/plain" }), undefined, undefined, { codec }));
    expect(err.code).toBe("not_image");
    expect(codec.decode).not.toHaveBeenCalled();
    expect(errorMessageTh("not_image")).not.toBe(GENERIC_ERROR_TH);
    expect(errorMessageTh("not_image")).toMatch(/[฀-๿]/);
  });

  it.each(["photo.heic", "IMG.HEIF", "a.jpg", "a.jpeg", "a.png", "a.webp"])(
    "tries to decode application/octet-stream named %s",
    async (name) => {
      const { codec } = fakeCodec();
      const out = await resizeToJpeg(bigFile(name, "application/octet-stream", 1000), undefined, undefined, { codec });
      expect(out.type).toBe("image/jpeg");
      expect(codec.decode).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    ["data.bin", "application/octet-stream"],
    ["clip.gif", "application/octet-stream"],
    ["report.pdf", "application/pdf"],
  ])("rejects %s (%s) as not_image without decoding", async (name, type) => {
    const { codec } = fakeCodec();
    expect((await rejection(resizeToJpeg(bigFile(name, type, 1000), undefined, undefined, { codec }))).code).toBe("not_image");
    expect(codec.decode).not.toHaveBeenCalled();
  });

  it("rejects an empty or extension-less file with no type as not_image", async () => {
    const { codec } = fakeCodec();
    expect((await rejection(resizeToJpeg(new File([], "empty.jpg", { type: "image/jpeg" }), undefined, undefined, { codec }))).code).toBe("not_image");
    expect((await rejection(resizeToJpeg(new File(["x"], "blob", { type: "" }), undefined, undefined, { codec }))).code).toBe("not_image");
  });

  it("rejects with not_image when the browser cannot decode the file", async () => {
    const codec: ImageCodec = {
      decode: vi.fn(async () => {
        throw new Error("decode failed");
      }),
      encode: vi.fn(),
    };
    const err = await rejection(resizeToJpeg(bigFile("broken.jpg", "image/jpeg", 1000), undefined, undefined, { codec }));
    expect(err.code).toBe("not_image");
    expect(codec.encode).not.toHaveBeenCalled();
  });

  it("rejects within the timeout when decoding never finishes", async () => {
    vi.useFakeTimers();
    const codec: ImageCodec = { decode: vi.fn(() => new Promise<never>(() => {})), encode: vi.fn() };
    const promise = resizeToJpeg(bigFile("stuck.heic", "image/heic", 1000), undefined, undefined, { codec, timeoutMs: 15_000 });
    const settled = rejection(promise);
    await vi.advanceTimersByTimeAsync(15_000);
    expect((await settled).code).toBe("not_image");
  });

  it("rejects with image_too_large when no attempt fits in 2 MB", async () => {
    const codec: ImageCodec = {
      decode: vi.fn(async () => ({ width: 4000, height: 3000, source: {} })),
      encode: vi.fn(async () => new Blob([new Uint8Array(MAX_UPLOAD_BYTES + 1)], { type: "image/jpeg" })),
    };
    const err = await rejection(resizeToJpeg(bigFile("huge.jpg", "image/jpeg"), undefined, undefined, { codec }));
    expect(err.code).toBe("image_too_large");
    expect(errorMessageTh("image_too_large")).toMatch(/[฀-๿]/);
  });

  it("falls back to the smallest result <= 2 MB when the ~300 KB target is never reached", async () => {
    const codec: ImageCodec = {
      decode: vi.fn(async () => ({ width: 4000, height: 3000, source: {} })),
      encode: vi.fn(async (_s, w, h, q) => new Blob([new Uint8Array(Math.round(1_000_000 + w * h * q * 0.1))], { type: "image/jpeg" })),
    };
    const out = await resizeToJpeg(bigFile("noisy.jpg", "image/jpeg"), undefined, undefined, { codec });
    expect(out.size).toBeLessThanOrEqual(MAX_UPLOAD_BYTES);
    expect(out.size).toBeGreaterThan(300 * 1024);
  });
});
