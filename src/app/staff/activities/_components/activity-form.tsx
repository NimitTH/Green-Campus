"use client";

import { useRouter } from "next/navigation";
import { useActionState, useId, useState } from "react";
import { saveActivityForm, type ActivityFormState } from "@/app/actions/activities";
import { Button, ButtonLink, Field, inputClass } from "@/components/ui";
import { typeLabelTh } from "@/lib/activities/labels";
import {
  ACTIVITY_TYPES,
  defaultRequiresCode,
  type ActivityFieldErrors,
  type ActivityInput,
} from "@/lib/activities/validation";

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

type ActivityFormProps = { initial: ActivityInput; id?: string; hasParticipants?: boolean };

/**
 * Create / edit form. Cache Components keep a visited route alive in a hidden <Activity>, and this form's
 * state (useActionState errors and values, the chosen type and code switch) cannot be reset from an event
 * handler: a successful save ends in a server-side redirect, with no client callback. So the form is keyed
 * on useRouter().bfcacheId, which changes on every fresh push/replace visit (a new form each time) and
 * stays the same for back/forward (the draft comes back), per the Next docs (use-router, bfcacheId).
 */
export function ActivityForm(props: ActivityFormProps) {
  const { bfcacheId } = useRouter();
  return <ActivityFormFields key={bfcacheId} {...props} />;
}

function ActivityFormFields({
  initial,
  id,
  hasParticipants = false,
}: {
  initial: ActivityInput;
  id?: string;
  hasParticipants?: boolean;
}) {
  const uid = useId();
  const f = (name: string) => `${uid}-${name}`;
  // Once students joined, a non-draft activity cannot go back to draft (activity_status_locked).
  const draftLocked = hasParticipants && initial.status !== "draft";
  const [state, action, pending] = useActionState<ActivityFormState, FormData>(saveActivityForm, undefined);
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
    <form action={action} noValidate>
      {id ? <input type="hidden" name="id" value={id} /> : null}
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
          {pending ? "กำลังบันทึก..." : "บันทึกกิจกรรม"}
        </Button>
        <ButtonLink href="/staff/activities" variant="card" className="w-full sm:w-auto">
          ยกเลิก
        </ButtonLink>
      </div>
    </form>
  );
}
