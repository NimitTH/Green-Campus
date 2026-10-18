// Client-side photo shrinking before upload (spec 8.4): any photo the browser can open
// (JPEG/PNG/WebP, and HEIC/HEIF on iOS Safari, which decodes it natively) becomes a JPEG of
// about 300 KB and never more than 2 MB (the evidence bucket limit). No extra dependency.
//
// Decoding/encoding is injectable (ImageCodec) so unit tests run without a real canvas.

import { withTimeout } from "./timeout";

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const TARGET_BYTES = 300 * 1024;
const DEFAULT_TIMEOUT_MS = 15_000;
const QUALITY_STEPS = [0.7, 0.6, 0.5];
const EDGE_STEPS = [1280, 1024, 800, 640];
const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|heic|heif)$/i;

export type ImageErrorCode = "not_image" | "image_too_large";

/** Rejection reason of resizeToJpeg; `code` maps to Thai text with errorMessageTh. */
export class ImageError extends Error {
  readonly code: ImageErrorCode;
  constructor(code: ImageErrorCode) {
    super(code);
    this.name = "ImageError";
    this.code = code;
  }
}

export type DecodedImage = { width: number; height: number; source: unknown; close?: () => void };

export type ImageCodec = {
  decode(file: Blob): Promise<DecodedImage>;
  /** Draw `source` at width x height and encode it as image/jpeg. */
  encode(source: unknown, width: number, height: number, quality: number): Promise<Blob>;
};

export type ResizeOptions = { codec?: ImageCodec; timeoutMs?: number };

/**
 * HEIC may arrive as image/heic, image/heif, or with an empty / application/octet-stream type
 * and a .heic name (some pickers do the same for JPEG/PNG/WebP): try to decode those too.
 */
function looksLikeImage(file: File): boolean {
  if (file.size === 0) return false;
  if (file.type === "" || file.type === "application/octet-stream") return IMAGE_EXTENSIONS.test(file.name);
  return file.type.startsWith("image/");
}

function scaled(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Attempts in order: lower the quality first, then the long edge. */
function attempts(maxEdge: number, quality: number): { edge: number; quality: number }[] {
  const qualities = [quality, ...QUALITY_STEPS.filter((q) => q < quality)];
  const edges = [maxEdge, ...EDGE_STEPS.filter((e) => e < maxEdge)];
  const list: { edge: number; quality: number }[] = qualities.map((q) => ({ edge: maxEdge, quality: q }));
  for (const edge of edges.slice(1)) list.push({ edge, quality: qualities[qualities.length - 1] });
  return list;
}

/**
 * Resize a photo to a JPEG (long edge <= maxEdge, ~300 KB, always <= 2 MB).
 * Rejects with ImageError: `not_image` (not an image, cannot decode, decode timed out) or
 * `image_too_large` (still over 2 MB at the smallest size). Never hangs.
 */
export async function resizeToJpeg(
  file: File,
  maxEdge = 1600,
  quality = 0.8,
  options: ResizeOptions = {},
): Promise<Blob> {
  if (!looksLikeImage(file)) throw new ImageError("not_image");
  const codec = options.codec ?? browserCodec;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let image: DecodedImage;
  try {
    image = await withTimeout(codec.decode(file), timeoutMs);
  } catch {
    throw new ImageError("not_image");
  }
  if (!(image.width > 0 && image.height > 0)) {
    image.close?.();
    throw new ImageError("not_image");
  }

  try {
    let best: Blob | null = null;
    const tried = new Set<string>();
    for (const step of attempts(maxEdge, quality)) {
      const size = scaled(image.width, image.height, step.edge);
      // A photo smaller than several edges would repeat the same attempt.
      const key = `${size.width}x${size.height}@${step.quality}`;
      if (tried.has(key)) continue;
      tried.add(key);
      let blob: Blob;
      try {
        blob = await withTimeout(codec.encode(image.source, size.width, size.height, step.quality), timeoutMs);
      } catch {
        throw new ImageError("not_image");
      }
      if (blob.type !== "image/jpeg") throw new ImageError("not_image");
      if (blob.size <= MAX_UPLOAD_BYTES && (!best || blob.size < best.size)) best = blob;
      if (blob.size <= TARGET_BYTES) return blob;
    }
    if (best) return best;
    throw new ImageError("image_too_large");
  } finally {
    image.close?.();
  }
}

// Browser implementation -----------------------------------------------------------------

async function decodeInBrowser(file: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return { width: bitmap.width, height: bitmap.height, source: bitmap, close: () => bitmap.close() };
    } catch {
      // Some browsers (older Safari for HEIC) decode only through <img>; fall through.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { width: img.naturalWidth, height: img.naturalHeight, source: img, close: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function encodeInBrowser(source: unknown, width: number, height: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("no 2d context"));
      return;
    }
    // JPEG has no transparency: paint white first so transparent PNG areas are not black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(source as CanvasImageSource, 0, 0, width, height);
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encode failed"))), "image/jpeg", quality);
  });
}

const browserCodec: ImageCodec = { decode: decodeInBrowser, encode: encodeInBrowser };
