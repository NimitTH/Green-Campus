"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { saveArticle } from "@/app/actions/articles";
import { ARTICLE_BUCKET, ARTICLE_LIMITS, type ArticleFieldErrors, type ArticleInput } from "@/lib/articles/format";
import { errorMessageTh, uploadErrorCode } from "@/lib/errors";
import { ImageError, resizeToJpeg } from "@/lib/image";
import { createBrowserClient } from "@/lib/supabase/browser";
import { TimeoutError, withTimeout } from "@/lib/timeout";
import { uniqueId } from "@/lib/unique-id";

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
 * Create / edit form for an article (R122). The body is plain text: a blank line starts a new
 * paragraph. An optional cover is shrunk in the browser and uploaded to the public `article-images`
 * bucket under {articleId}/{uuid}.jpg before the save. Editing sends the updated_at the form was loaded
 * with, so a second editor's save is never silently overwritten.
 */
export function ArticleForm({
  initial,
  id,
  coverUrl,
  updatedAt,
}: {
  initial: ArticleInput;
  /** Set when editing. */
  id?: string;
  coverUrl?: string | null;
  updatedAt?: string;
}) {
  const router = useRouter();
  // Unique per form instance: Cache Components keep a visited form alive (hidden) next to the
  // visible one (e.g. "new" and "edit"), and fixed ids would point labels at the hidden inputs.
  const uid = useId();
  const f = (name: string) => `${uid}-${name}`;
  // A new article's id, chosen once per form so a retry reuses it.
  const newId = useRef(uniqueId());
  const articleId = id ?? newId.current;
  const [values, setValues] = useState<ArticleInput>(initial);
  const [file, setFile] = useState<File | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ArticleFieldErrors>({});
  const busyRef = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  // The cover already uploaded for this file: a retry after a failed save reuses it.
  const uploaded = useRef<{ file: File; path: string } | null>(null);

  function set<K extends keyof ArticleInput>(key: K, value: ArticleInput[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function upload(photo: File): Promise<string> {
    if (uploaded.current?.file === photo) return uploaded.current.path;
    setStage("กำลังย่อรูป...");
    const jpeg = await resizeToJpeg(photo);
    setStage("กำลังอัปโหลดรูป...");
    const path = `${articleId}/${uniqueId()}.jpg`;
    let failure: string | null;
    try {
      const { error: uploadError } = await withTimeout(
        createBrowserClient().storage.from(ARTICLE_BUCKET).upload(path, jpeg, { contentType: "image/jpeg", upsert: false }),
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
        saveArticle({
          ...values,
          id: articleId,
          mode: id ? "update" : "create",
          imagePath,
          ...(id ? { loadedUpdatedAt: updatedAt, removeCover } : {}),
        }),
        REQUEST_TIMEOUT_MS,
      );
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        if (result.error) setError(result.error);
        return;
      }
      done = true;
      if (!id) {
        // Cache Components keep this page alive (hidden in <Activity>) after the navigation below, so a
        // second "เขียนบทความ" would come back to this same form: start it fresh with a new id.
        newId.current = uniqueId();
        uploaded.current = null;
        setValues(initial);
        setFile(null);
        if (fileInput.current) fileInput.current.value = "";
      }
      busyRef.current = false;
      setBusy(false);
      router.push("/staff/articles");
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
      {id ? <input type="hidden" name="loadedUpdatedAt" value={updatedAt} /> : null}
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
        <label htmlFor={f("title")} className="mb-1 block text-sm font-medium">
          ชื่อบทความ
        </label>
        <input
          id={f("title")}
          value={values.title}
          onChange={(e) => set("title", e.target.value)}
          aria-invalid={fieldErrors.title ? true : undefined}
          aria-describedby={fieldErrors.title ? f("title-error") : undefined}
          className={inputClass}
        />
        <FieldError id={f("title-error")} message={fieldErrors.title} />
      </div>

      <div className="mb-4">
        <label htmlFor={f("slug")} className="mb-1 block text-sm font-medium">
          slug (ส่วนท้ายของลิงก์ ไม่บังคับ)
        </label>
        <input
          id={f("slug")}
          value={values.slug}
          onChange={(e) => set("slug", e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="เช่น lod-kaya-plastic"
          aria-invalid={fieldErrors.slug ? true : undefined}
          aria-describedby={fieldErrors.slug ? `${f("slug-error")} ${f("slug-hint")}` : f("slug-hint")}
          className={inputClass}
        />
        <p id={f("slug-hint")} className="mt-1 text-xs text-gray-500">
          ใช้ a-z, 0-9 และขีด (-) ไม่เกิน {ARTICLE_LIMITS.slugMax} ตัว{" "}
          {id ? "เว้นว่างเพื่อใช้ slug เดิม" : "เว้นว่างให้ระบบสร้างให้"}
        </p>
        <FieldError id={f("slug-error")} message={fieldErrors.slug} />
      </div>

      <div className="mb-4">
        <label htmlFor={f("body")} className="mb-1 block text-sm font-medium">
          เนื้อหา
        </label>
        <textarea
          id={f("body")}
          rows={12}
          value={values.body}
          onChange={(e) => set("body", e.target.value)}
          aria-invalid={fieldErrors.body ? true : undefined}
          aria-describedby={fieldErrors.body ? `${f("body-error")} ${f("body-hint")}` : f("body-hint")}
          className={inputClass}
        />
        <p id={f("body-hint")} className="mt-1 text-xs text-gray-500">
          ข้อความล้วน เว้นบรรทัดว่างหนึ่งบรรทัดเพื่อขึ้นย่อหน้าใหม่
        </p>
        <FieldError id={f("body-error")} message={fieldErrors.body} />
      </div>

      <div className="mb-4">
        <label htmlFor={f("cover")} className="mb-1 block text-sm font-medium">
          รูปปก (ไม่บังคับ)
        </label>
        {coverUrl && !removeCover ? (
          // eslint-disable-next-line @next/next/no-img-element -- public Supabase Storage URL
          <img src={coverUrl} alt="รูปปกปัจจุบัน" className="mb-2 h-24 w-40 rounded-lg object-cover" />
        ) : null}
        <input
          ref={fileInput}
          id={f("cover")}
          type="file"
          accept="image/*"
          className="block w-full text-sm"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <p className="mt-1 text-xs text-gray-500">{id && coverUrl ? "เลือกรูปใหม่เพื่อเปลี่ยนรูปปก " : ""}ระบบจะย่อรูปให้อัตโนมัติ</p>
        {id && coverUrl ? (
          <div className="mt-2 flex items-center gap-2">
            <input
              id={f("removeCover")}
              type="checkbox"
              checked={removeCover}
              onChange={(e) => setRemoveCover(e.target.checked)}
              className="h-5 w-5 accent-green-700"
            />
            <label htmlFor={f("removeCover")} className="text-sm">
              ลบรูปปก
            </label>
          </div>
        ) : null}
      </div>

      <div className="mb-6 flex items-center gap-2">
        <input
          id={f("published")}
          type="checkbox"
          checked={values.published}
          onChange={(e) => set("published", e.target.checked)}
          className="h-5 w-5 accent-green-700"
        />
        <label htmlFor={f("published")} className="text-sm">
          เผยแพร่ (ทุกคนเห็นที่หน้าบทความ)
        </label>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row-reverse">
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-green-700 px-4 py-3 text-base font-semibold text-white hover:bg-green-800 disabled:opacity-60 sm:w-auto"
        >
          {busy ? (stage ?? "กำลังบันทึก...") : "บันทึกบทความ"}
        </button>
        <Link
          href="/staff/articles"
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-center text-base dark:border-gray-700 sm:w-auto"
        >
          ยกเลิก
        </Link>
      </div>
    </form>
  );
}
