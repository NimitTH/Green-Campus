"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { saveReward } from "@/app/actions/rewards";
import { Button, ButtonLink, Field, inputClass } from "@/components/ui";
import { errorMessageTh, uploadErrorCode } from "@/lib/errors";
import { ImageError, resizeToJpeg } from "@/lib/image";
import type { RewardFieldErrors, RewardInput } from "@/lib/rewards/validation";
import { createBrowserClient } from "@/lib/supabase/browser";
import { TimeoutError, withTimeout } from "@/lib/timeout";
import { uniqueId } from "@/lib/unique-id";

const BUCKET = "reward-images";
const REQUEST_TIMEOUT_MS = 60_000;

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="text-sm text-danger">
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
  // Unique per form instance: Cache Components keep a visited form alive (hidden) next to the
  // visible one (e.g. "new" and "edit"), and fixed ids would point labels at the hidden inputs.
  const uid = useId();
  const f = (name: string) => `${uid}-${name}`;
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
  const fileInput = useRef<HTMLInputElement>(null);
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
      // Cache Components keep this page alive (hidden in <Activity>) after the navigation below, so the
      // next "เพิ่มของรางวัล" / "แก้ไข" can come back to this same form: never leave it busy, and start a
      // new reward with a new id (reusing the saved one would hit the primary key, 23505).
      if (!id) {
        newId.current = uniqueId();
        setValues(initial);
      }
      uploaded.current = null;
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      busyRef.current = false;
      setBusy(false);
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
        <div role="alert" className="mb-4 rounded-input border border-danger bg-surface p-3 text-sm text-danger">
          {error}
        </div>
      ) : null}
      {hasFieldErrors ? (
        <div role="alert" className="mb-4 rounded-input border border-danger bg-surface p-3 text-sm text-danger">
          กรุณาแก้ช่องที่มีข้อความสีแดง
        </div>
      ) : null}

      <Field id={f("name")} label="ชื่อของรางวัล" className="mb-4">
        <input
          id={f("name")}
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          aria-invalid={fieldErrors.name ? true : undefined}
          aria-describedby={fieldErrors.name ? f("name-error") : undefined}
          className={inputClass}
        />
        <FieldError id={f("name-error")} message={fieldErrors.name} />
      </Field>

      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field id={f("pointsCost")} label="แต้มที่ใช้แลก" className="mb-4">
          <input
            id={f("pointsCost")}
            inputMode="numeric"
            value={values.pointsCost}
            onChange={(e) => set("pointsCost", e.target.value)}
            aria-invalid={fieldErrors.pointsCost ? true : undefined}
            aria-describedby={fieldErrors.pointsCost ? f("pointsCost-error") : undefined}
            className={inputClass}
          />
          <FieldError id={f("pointsCost-error")} message={fieldErrors.pointsCost} />
        </Field>
        <Field id={f("stock")} label="จำนวนในสต็อก" className="mb-4">
          <input
            id={f("stock")}
            inputMode="numeric"
            value={values.stock}
            onChange={(e) => set("stock", e.target.value)}
            aria-invalid={fieldErrors.stock ? true : undefined}
            aria-describedby={fieldErrors.stock ? f("stock-error") : undefined}
            className={inputClass}
          />
          <FieldError id={f("stock-error")} message={fieldErrors.stock} />
        </Field>
      </div>

      <Field
        id={f("image")}
        label="รูปของรางวัล (ไม่บังคับ)"
        hint={
          <>
            {id ? "เลือกรูปใหม่เพื่อเปลี่ยนรูป " : ""}ระบบจะย่อรูปให้อัตโนมัติ
          </>
        }
        className="mb-4"
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- public Supabase Storage URL
          <img src={imageUrl} alt="รูปปัจจุบัน" className="mb-2 h-24 w-24 rounded-input object-cover" />
        ) : null}
        <input
          ref={fileInput}
          id={f("image")}
          type="file"
          accept="image/*"
          className="block w-full text-sm text-ink file:mr-3 file:min-h-11 file:rounded-input file:border file:border-rule-strong file:bg-surface file:px-3 file:text-ink"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </Field>

      <div className="mb-6 flex min-h-11 items-center gap-2">
        <input
          id={f("active")}
          type="checkbox"
          checked={values.active}
          onChange={(e) => set("active", e.target.checked)}
          className="h-5 w-5 accent-accent"
        />
        <label htmlFor={f("active")} className="text-sm">
          เปิดให้แลก (นักเรียนเห็นและใส่ตะกร้าได้)
        </label>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row-reverse">
        <Button type="submit" variant="primary" disabled={busy} className="w-full sm:w-auto">
          {busy ? (stage ?? "กำลังบันทึก...") : "บันทึกของรางวัล"}
        </Button>
        <ButtonLink href="/staff/rewards" variant="card" className="w-full sm:w-auto">
          ยกเลิก
        </ButtonLink>
      </div>
    </form>
  );
}
