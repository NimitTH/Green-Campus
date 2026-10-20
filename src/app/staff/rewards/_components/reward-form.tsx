"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { saveReward } from "@/app/actions/rewards";
import { errorMessageTh, uploadErrorCode } from "@/lib/errors";
import { ImageError, resizeToJpeg } from "@/lib/image";
import type { RewardFieldErrors, RewardInput } from "@/lib/rewards/validation";
import { createBrowserClient } from "@/lib/supabase/browser";
import { TimeoutError, withTimeout } from "@/lib/timeout";
import { uniqueId } from "@/lib/unique-id";

const BUCKET = "reward-images";
const REQUEST_TIMEOUT_MS = 60_000;

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-base outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/30 aria-[invalid=true]:border-red-500 dark:border-gray-700 dark:bg-gray-900";

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="mt-1 text-sm text-red-600">
      {message}
    </p>
  ) : null;
}

/**
 * Create / edit form for a reward (R67). The browser shrinks the photo, uploads it to the public
 * `reward-images` bucket under {rewardId}/{uuid}.jpg, then saves the reward with that path.
 * A new reward gets its id here so the image can be uploaded before the row exists.
 */
export function RewardForm({
  initial,
  id,
  imageUrl,
}: {
  initial: RewardInput;
  /** Set when editing. */
  id?: string;
  imageUrl?: string | null;
}) {
  const router = useRouter();
  // A new reward's id, chosen once per form so a retry reuses it.
  const newId = useRef(uniqueId());
  const rewardId = id ?? newId.current;
  const [values, setValues] = useState<RewardInput>(initial);
  // The stock this form was loaded with (R91): the save only writes stock if the teacher changed
  // it, and only while the row still holds this value.
  const loadedStock = initial.stock;
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<RewardFieldErrors>({});
  const busyRef = useRef(false);
  // The photo already uploaded for this file: a retry after a failed save reuses it.
  const uploaded = useRef<{ file: File; path: string } | null>(null);

  function set<K extends keyof RewardInput>(key: K, value: RewardInput[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function upload(photo: File): Promise<string> {
    if (uploaded.current?.file === photo) return uploaded.current.path;
    setStage("กำลังย่อรูป...");
    const jpeg = await resizeToJpeg(photo);
    setStage("กำลังอัปโหลดรูป...");
    const path = `${rewardId}/${uniqueId()}.jpg`;
    let failure: string | null;
    try {
      const { error: uploadError } = await withTimeout(
        createBrowserClient().storage.from(BUCKET).upload(path, jpeg, { contentType: "image/jpeg", upsert: false }),
        REQUEST_TIMEOUT_MS,
      );
      failure = uploadError ? uploadErrorCode(uploadError as { status?: number; statusCode?: string; message?: string }) : null;
    } catch (e) {
      failure = e instanceof TimeoutError ? e.code : "upload_failed";
    }
    if (failure) throw new Error(failure);
    uploaded.current = { file: photo, path };
    return path;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setFieldErrors({});
    let done = false;
    try {
      const imagePath = file ? await upload(file) : null;
      setStage("กำลังบันทึก...");
      const result = await withTimeout(
        saveReward({ ...values, id: rewardId, mode: id ? "update" : "create", imagePath, ...(id ? { loadedStock } : {}) }),
        REQUEST_TIMEOUT_MS,
      );
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        if (result.error) setError(result.error);
        return;
      }
      if (result.previousImagePath) {
        // Best effort: an orphan is cleaned up later (Task 19).
        await createBrowserClient().storage.from(BUCKET).remove([result.previousImagePath]).catch(() => undefined);
      }
      done = true;
      router.push("/staff/rewards");
      router.refresh();
    } catch (e) {
      const code = e instanceof ImageError || e instanceof TimeoutError ? e.code : e instanceof Error ? e.message : null;
      setError(errorMessageTh(code));
    } finally {
      setStage(null);
      if (!done) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }

  const hasFieldErrors = Object.keys(fieldErrors).length > 0;

  return (
    <form onSubmit={onSubmit} noValidate>
      {id ? <input type="hidden" name="loadedStock" value={loadedStock} /> : null}
      {error ? (
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      ) : null}
      {hasFieldErrors ? (
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          กรุณาแก้ช่องที่มีข้อความสีแดง
        </div>
      ) : null}

      <div className="mb-4">
        <label htmlFor="name" className="mb-1 block text-sm font-medium">
          ชื่อของรางวัล
        </label>
        <input
          id="name"
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          aria-invalid={fieldErrors.name ? true : undefined}
          aria-describedby={fieldErrors.name ? "name-error" : undefined}
          className={inputClass}
        />
        <FieldError id="name-error" message={fieldErrors.name} />
      </div>

      <div className="grid gap-x-4 sm:grid-cols-2">
        <div className="mb-4">
          <label htmlFor="pointsCost" className="mb-1 block text-sm font-medium">
            แต้มที่ใช้แลก
          </label>
          <input
            id="pointsCost"
            inputMode="numeric"
            value={values.pointsCost}
            onChange={(e) => set("pointsCost", e.target.value)}
            aria-invalid={fieldErrors.pointsCost ? true : undefined}
            aria-describedby={fieldErrors.pointsCost ? "pointsCost-error" : undefined}
            className={inputClass}
          />
          <FieldError id="pointsCost-error" message={fieldErrors.pointsCost} />
        </div>
        <div className="mb-4">
          <label htmlFor="stock" className="mb-1 block text-sm font-medium">
            จำนวนในสต็อก
          </label>
          <input
            id="stock"
            inputMode="numeric"
            value={values.stock}
            onChange={(e) => set("stock", e.target.value)}
            aria-invalid={fieldErrors.stock ? true : undefined}
            aria-describedby={fieldErrors.stock ? "stock-error" : undefined}
            className={inputClass}
          />
          <FieldError id="stock-error" message={fieldErrors.stock} />
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor="image" className="mb-1 block text-sm font-medium">
          รูปของรางวัล (ไม่บังคับ)
        </label>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- public Supabase Storage URL
          <img src={imageUrl} alt="รูปปัจจุบัน" className="mb-2 h-24 w-24 rounded-lg object-cover" />
        ) : null}
        <input
          id="image"
          type="file"
          accept="image/*"
          className="block w-full text-sm"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <p className="mt-1 text-xs text-gray-500">
          {id ? "เลือกรูปใหม่เพื่อเปลี่ยนรูป " : ""}ระบบจะย่อรูปให้อัตโนมัติ
        </p>
      </div>

      <div className="mb-6 flex items-center gap-2">
        <input
          id="active"
          type="checkbox"
          checked={values.active}
          onChange={(e) => set("active", e.target.checked)}
          className="h-5 w-5 accent-green-700"
        />
        <label htmlFor="active" className="text-sm">
          เปิดให้แลก (นักเรียนเห็นและใส่ตะกร้าได้)
        </label>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row-reverse">
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-green-700 px-4 py-3 text-base font-semibold text-white hover:bg-green-800 disabled:opacity-60 sm:w-auto"
        >
          {busy ? (stage ?? "กำลังบันทึก...") : "บันทึกของรางวัล"}
        </button>
        <Link
          href="/staff/rewards"
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-center text-base dark:border-gray-700 sm:w-auto"
        >
          ยกเลิก
        </Link>
      </div>
    </form>
  );
}
