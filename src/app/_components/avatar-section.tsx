"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { removeAvatar, setAvatar } from "@/app/actions/profile";
import { Avatar, Button, Card } from "@/components/ui";
import { GENERIC_ERROR_TH, errorMessageTh, uploadErrorCode } from "@/lib/errors";
import { ImageError, cropSquareToJpeg } from "@/lib/image";
import { AVATAR_BUCKET } from "@/lib/profile/avatar";
import { createBrowserClient } from "@/lib/supabase/browser";
import { TimeoutError, withTimeout } from "@/lib/timeout";
import { uniqueId } from "@/lib/unique-id";

const REQUEST_TIMEOUT_MS = 60_000;

/** Profile picture: pick, crop to a square JPEG, upload with the signed-in session, then setAvatar. */
export function AvatarSection({ userId, name, url }: { userId: string; name: string; url: string | null }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(task: () => Promise<{ ok: boolean; error?: string }>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await task();
      if (!result.ok) {
        setError(result.error ?? GENERIC_ERROR_TH);
        return;
      }
      router.refresh();
    } catch (e) {
      const code = e instanceof ImageError || e instanceof TimeoutError ? e.code : e instanceof Error ? e.message : null;
      setError(errorMessageTh(code));
    } finally {
      busyRef.current = false;
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const photo = event.target.files?.[0];
    if (!photo) return;
    void run(async () => {
      const jpeg = await cropSquareToJpeg(photo);
      const path = `${userId}/${uniqueId()}.jpg`;
      let failure: string | null;
      try {
        const { error: uploadError } = await withTimeout(
          createBrowserClient().storage.from(AVATAR_BUCKET).upload(path, jpeg, { contentType: "image/jpeg", upsert: false }),
          REQUEST_TIMEOUT_MS,
        );
        failure = uploadError ? uploadErrorCode(uploadError as { status?: number; statusCode?: string; message?: string }) : null;
      } catch (e) {
        failure = e instanceof TimeoutError ? e.code : "upload_failed";
      }
      if (failure) throw new Error(failure);
      return withTimeout(setAvatar(path), REQUEST_TIMEOUT_MS);
    });
  }

  return (
    <Card as="section" aria-labelledby="profile-avatar" className="mb-6 space-y-3">
      <h2 id="profile-avatar" className="font-display text-lg font-semibold">
        รูปโปรไฟล์
      </h2>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={name} url={url} size={72} />
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            onChange={onPick}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          />
          <Button type="button" disabled={busy} onClick={() => fileInput.current?.click()}>
            อัปโหลดรูป
          </Button>
          {url ? (
            <Button
              type="button"
              variant="card"
              disabled={busy}
              onClick={() => void run(() => withTimeout(removeAvatar(), REQUEST_TIMEOUT_MS))}
            >
              ลบรูป
            </Button>
          ) : null}
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
