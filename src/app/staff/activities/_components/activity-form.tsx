"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useId, useRef, useState } from "react";
import { saveActivity, saveActivityForm, type ActivityFormState } from "@/app/actions/activities";
import { Button, ButtonLink, Field, inputClass } from "@/components/ui";
import { ACTIVITY_BUCKET } from "@/lib/activities/cover";
import { typeLabelTh } from "@/lib/activities/labels";
import {
  ACTIVITY_TYPES,
  activityInputFromForm,
  defaultRequiresCode,
  LIMITS,
  type ActivityFieldErrors,
  type ActivityInput,
} from "@/lib/activities/validation";
import { errorMessageTh, uploadErrorCode } from "@/lib/errors";
import { ImageError, resizeToJpeg } from "@/lib/image";
import { createBrowserClient } from "@/lib/supabase/browser";
import { TimeoutError, withTimeout } from "@/lib/timeout";
import { uniqueId } from "@/lib/unique-id";

const REQUEST_TIMEOUT_MS = 60_000;

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="text-sm text-danger">
      {message}
    </p>
  ) : null;
}

function TextField({
  label,
  name,
  type = "text",
  defaultValue,
  errors,
  hint,
  inputMode,
}: {
  label: string;
  name: keyof ActivityInput;
  type?: string;
  defaultValue: string;
  errors?: ActivityFieldErrors;
  hint?: string;
  inputMode?: "decimal" | "numeric";
}) {
  const error = errors?.[name];
  // unique per instance: the new and edit forms can both be alive (hidden <Activity>)
  const fid = useId();
  return (
    <Field id={fid} label={label} hint={hint && !error ? hint : undefined} className="mb-4">
      <input
        id={fid}
        name={name}
        type={type}
        inputMode={inputMode}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fid}-error` : undefined}
        className={inputClass}
      />
      <FieldError id={`${fid}-error`} message={error} />
    </Field>
  );
}

type ActivityFormProps = { initial: ActivityInput; id?: string; hasParticipants?: boolean; coverUrl?: string | null };

/**
 * Create / edit form. Cache Components keep a visited route alive in a hidden <Activity>, and this form's
 * state (useActionState errors and values, the chosen type and code switch) cannot be reset from an event
 * handler: a successful save ends in a server-side redirect, with no client callback. So the form is keyed
 * on useRouter().bfcacheId, which changes on every fresh push/replace visit (a new form each time) and
 * stays the same for back/forward (the draft comes back), per the Next docs (use-router, bfcacheId).
 *
 * Cover (DESIGN-3 6.1): the picture is shrunk in the browser and uploaded to activity-images as {id}/{uuid}.jpg,
 * as in the article form. A new activity is inserted first (saveActivity) to get its id, then the cover is
 * uploaded and saved as cover_path; when the upload fails, a retry updates that same activity instead of creating
 * another. Without a new picture the form goes through saveActivityForm as before (server-side redirect).
 */
export function ActivityForm(props: ActivityFormProps) {
  const { bfcacheId } = useRouter();
  return <ActivityFormFields key={bfcacheId} {...props} />;
}

function ActivityFormFields({ initial, id, hasParticipants = false, coverUrl = null }: ActivityFormProps) {
  const router = useRouter();
  const uid = useId();
  const f = (name: string) => `${uid}-${name}`;
  // Once students joined, a non-draft activity cannot go back to draft (activity_status_locked).
  const draftLocked = hasParticipants && initial.status !== "draft";
  // A new activity already inserted by a cover save whose upload then failed: later saves update it.
  const [savedId, setSavedId] = useState<string | null>(null);
  const savedIdRef = useRef<string | null>(null);
  // The cover already uploaded for this file and activity: a retry after a failed save reuses it.
  const uploaded = useRef<{ file: File; path: string } | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [detailsLength, setDetailsLength] = useState(initial.details.length);
  const [removeCover, setRemoveCover] = useState(false);

  async function upload(photo: File, activityId: string): Promise<string> {
    if (uploaded.current?.file === photo && uploaded.current.path.startsWith(`${activityId}/`)) return uploaded.current.path;
    setStage("กำลังย่อรูป...");
    const jpeg = await resizeToJpeg(photo);
    setStage("กำลังอัปโหลดรูป...");
    const path = `${activityId}/${uniqueId()}.jpg`;
    let failure: string | null;
    try {
      const { error: uploadError } = await withTimeout(
        createBrowserClient().storage.from(ACTIVITY_BUCKET).upload(path, jpeg, { contentType: "image/jpeg", upsert: false }),
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

  async function submit(prev: ActivityFormState, formData: FormData): Promise<ActivityFormState> {
    const file = formData.get("cover");
    formData.delete("cover");
    const photo = file instanceof File && file.size > 0 ? file : null;
    const targetId = id ?? savedIdRef.current;
    if (targetId) formData.set("id", targetId);
    // No new picture: the plain server action (it redirects to the list on success).
    if (!photo) return saveActivityForm(prev, formData);

    const values = activityInputFromForm(formData);
    try {
      // A file that is not a picture fails here, before anything is written.
      setStage("กำลังย่อรูป...");
      await resizeToJpeg(photo);
      let activityId = targetId;
      if (!activityId) {
        setStage("กำลังบันทึก...");
        const created = await withTimeout(saveActivity(values), REQUEST_TIMEOUT_MS);
        if (created.id === undefined) return { error: created.error, fieldErrors: created.fieldErrors, values };
        activityId = created.id;
        savedIdRef.current = activityId;
        setSavedId(activityId);
      }
      const coverPath = await upload(photo, activityId);
      setStage("กำลังบันทึก...");
      const saved = await withTimeout(saveActivity({ ...values, id: activityId, coverPath }), REQUEST_TIMEOUT_MS);
      if (saved.id === undefined) return { error: saved.error, fieldErrors: saved.fieldErrors, values };
      router.push("/staff/activities");
      router.refresh();
      return undefined;
    } catch (e) {
      const code = e instanceof ImageError || e instanceof TimeoutError ? e.code : e instanceof Error ? e.message : null;
      return { error: errorMessageTh(code), values };
    } finally {
      setStage(null);
    }
  }

  const [state, action, pending] = useActionState<ActivityFormState, FormData>(submit, undefined);

  // Dispatched by hand (not <form action>) so React does not reset the form: a chosen picture survives an error.
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  }
  const values = state?.values ?? initial;
  const errors = state?.fieldErrors;
  const [type, setType] = useState(initial.type);
  const [requiresCode, setRequiresCode] = useState(initial.requiresCode ?? defaultRequiresCode(initial.type));

  function chooseType(next: string) {
    setType(next);
    // Default by type (waste = needs a weigh code); the teacher may still change it.
    setRequiresCode(defaultRequiresCode(next));
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {id || savedId ? <input type="hidden" name="id" value={id ?? savedId ?? ""} /> : null}
      {state?.error ? (
        <div role="alert" className="mb-4 rounded-input border border-danger bg-surface p-3 text-sm text-danger">
          {state.error}
        </div>
      ) : null}
      {errors && Object.keys(errors).length > 0 ? (
        <div role="alert" className="mb-4 rounded-input border border-danger bg-surface p-3 text-sm text-danger">
          กรุณาแก้ช่องที่มีข้อความสีแดง
        </div>
      ) : null}

      <TextField label="ชื่อกิจกรรม" name="title" defaultValue={values.title} errors={errors} />

      <Field id={f("description")} label="รายละเอียด (ไม่บังคับ)" className="mb-4">
        <textarea
          id={f("description")}
          name="description"
          rows={4}
          defaultValue={values.description}
          aria-invalid={errors?.description ? true : undefined}
          aria-describedby={errors?.description ? f("description-error") : undefined}
          className={inputClass}
        />
        <FieldError id={f("description-error")} message={errors?.description} />
      </Field>

      <Field id={f("details")} label="รายละเอียดกิจกรรม" className="mb-4">
        <textarea
          id={f("details")}
          name="details"
          rows={8}
          maxLength={LIMITS.detailsMax}
          defaultValue={values.details}
          onChange={(e) => setDetailsLength(e.target.value.length)}
          aria-invalid={errors?.details ? true : undefined}
          aria-describedby={errors?.details ? `${f("details-error")} ${f("details-count")}` : f("details-count")}
          className={inputClass}
        />
        <p id={f("details-count")} className="text-right font-mono text-sm text-muted">
          {detailsLength.toLocaleString("th-TH")} / {LIMITS.detailsMax.toLocaleString("th-TH")}
        </p>
        <FieldError id={f("details-error")} message={errors?.details} />
      </Field>

      <Field id={f("cover")} label="ภาพปก" className="mb-4">
        {coverUrl && !removeCover ? (
          // eslint-disable-next-line @next/next/no-img-element -- public Supabase Storage URL
          <img src={coverUrl} alt="รูปปกปัจจุบัน" className="mb-2 h-24 w-40 rounded-input object-cover" />
        ) : null}
        <input
          id={f("cover")}
          name="cover"
          type="file"
          accept="image/*"
          className="block w-full text-sm text-ink file:mr-3 file:min-h-11 file:rounded-input file:border file:border-rule-strong file:bg-surface file:px-3 file:text-ink"
        />
        <p className="text-sm text-muted">{id && coverUrl ? "เลือกรูปใหม่เพื่อเปลี่ยนรูปปก " : ""}ระบบจะย่อรูปให้อัตโนมัติ</p>
        {id && coverUrl ? (
          <div className="flex min-h-11 items-center gap-2">
            <input
              id={f("removeCover")}
              name="removeCover"
              type="checkbox"
              checked={removeCover}
              onChange={(e) => setRemoveCover(e.target.checked)}
              className="h-5 w-5 accent-accent"
            />
            <label htmlFor={f("removeCover")} className="text-sm">
              ลบรูปปก
            </label>
          </div>
        ) : null}
      </Field>

      <TextField label="สถานที่ (ไม่บังคับ)" name="location" defaultValue={values.location} errors={errors} />

      <div className="mb-4 flex min-h-11 items-center gap-2">
        <input
          id={f("isOffsite")}
          name="isOffsite"
          type="checkbox"
          defaultChecked={values.isOffsite}
          className="h-5 w-5 accent-accent"
        />
        <label htmlFor={f("isOffsite")} className="text-sm">
          จัดนอกโรงเรียน
        </label>
      </div>

      <div className="grid gap-x-4 sm:grid-cols-2">
        <TextField
          label="วันเวลาเริ่ม"
          name="startsAt"
          type="datetime-local"
          defaultValue={values.startsAt}
          errors={errors}
          hint="เวลาประเทศไทย"
        />
        <TextField
          label="วันเวลาสิ้นสุด"
          name="endsAt"
          type="datetime-local"
          defaultValue={values.endsAt}
          errors={errors}
          hint="ส่งผลได้ถึง 3 วันหลังเวลาสิ้นสุด"
        />
      </div>

      <fieldset className="mb-4" aria-describedby={errors?.type ? f("type-error") : undefined}>
        <legend className="mb-1 block text-sm font-medium text-ink">ชนิดกิจกรรม</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {ACTIVITY_TYPES.map((t) => (
            <label
              key={t}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-input border border-rule-strong bg-surface px-3 py-2 text-ink has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
            >
              <input
                type="radio"
                name="type"
                value={t}
                checked={type === t}
                onChange={() => chooseType(t)}
                className="h-4 w-4 accent-accent"
              />
              {typeLabelTh(t)}
            </label>
          ))}
        </div>
        <FieldError id={f("type-error")} message={errors?.type} />
      </fieldset>

      {type === "waste" ? (
        <div key="waste">
          <p className="mb-3 text-sm text-muted">
            แต้มและ carbon คิดจากอัตราของแต่ละกลุ่มขยะ (ผู้ดูแลตั้งค่าไว้)
          </p>
          <TextField
            label="น้ำหนักสูงสุดต่อครั้ง (กก.)"
            name="maxPerSubmission"
            inputMode="decimal"
            defaultValue={values.maxPerSubmission}
            errors={errors}
            hint="เว้นว่างได้ถ้าไม่จำกัด"
          />
        </div>
      ) : null}
      {type === "trees" ? (
        <div key="trees">
          <TextField label="แต้มต่อต้น" name="unitPoints" inputMode="numeric" defaultValue={values.unitPoints} errors={errors} />
          <TextField
            label="carbon ต่อต้น (กก. CO2e)"
            name="unitCarbonKg"
            inputMode="decimal"
            defaultValue={values.unitCarbonKg}
            errors={errors}
            hint="เว้นว่างได้ถ้าไม่มีค่าอ้างอิง"
          />
          <TextField
            label="จำนวนต้นสูงสุดต่อครั้ง"
            name="maxPerSubmission"
            inputMode="numeric"
            defaultValue={values.maxPerSubmission}
            errors={errors}
            hint="เว้นว่างได้ถ้าไม่จำกัด"
          />
        </div>
      ) : null}
      {type === "fixed" ? (
        <div key="fixed">
          <TextField label="แต้มต่อครั้ง" name="unitPoints" inputMode="numeric" defaultValue={values.unitPoints} errors={errors} />
          <TextField
            label="carbon ต่อครั้ง (กก. CO2e)"
            name="unitCarbonKg"
            inputMode="decimal"
            defaultValue={values.unitCarbonKg}
            errors={errors}
            hint="เว้นว่างได้ถ้าไม่มีค่าอ้างอิง"
          />
        </div>
      ) : null}

      <div className="mb-4">
        <div className="flex min-h-11 items-center gap-2">
          <input
            id={f("requiresCode")}
            name="requiresCode"
            type="checkbox"
            checked={requiresCode}
            onChange={(e) => setRequiresCode(e.target.checked)}
            className="h-5 w-5 accent-accent"
          />
          <label htmlFor={f("requiresCode")} className="text-sm">
            ต้องใช้รหัสยืนยันจากจุดชั่งเมื่อส่งผล
          </label>
        </div>
        <p className="mt-1 text-sm text-muted">ค่าเริ่มต้น: ชั่งน้ำหนักขยะต้องใช้รหัส ชนิดอื่นไม่ต้อง</p>
      </div>

      <Field id={f("status")} label="สถานะ" className="mb-6">
        <select
          id={f("status")}
          name="status"
          defaultValue={values.status}
          aria-invalid={errors?.status ? true : undefined}
          className={inputClass}
        >
          <option value="draft" disabled={draftLocked}>
            ฉบับร่าง (นักเรียนยังไม่เห็น){draftLocked ? " - เลือกไม่ได้ เพราะมีนักเรียนเข้าร่วมแล้ว" : ""}
          </option>
          <option value="open">เปิดรับ</option>
          <option value="closed">ปิดแล้ว</option>
        </select>
        <FieldError id={f("status-error")} message={errors?.status} />
      </Field>

      <div className="flex flex-col gap-3 sm:flex-row-reverse">
        <Button type="submit" variant="primary" disabled={pending} className="w-full sm:w-auto">
          {pending ? (stage ?? "กำลังบันทึก...") : "บันทึกกิจกรรม"}
        </Button>
        <ButtonLink href="/staff/activities" variant="card" className="w-full sm:w-auto">
          ยกเลิก
        </ButtonLink>
      </div>
    </form>
  );
}
