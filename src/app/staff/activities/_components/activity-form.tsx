"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { saveActivityForm, type ActivityFormState } from "@/app/actions/activities";
import { typeLabelTh } from "@/lib/activities/labels";
import {
  ACTIVITY_TYPES,
  defaultRequiresCode,
  type ActivityFieldErrors,
  type ActivityInput,
} from "@/lib/activities/validation";

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-base outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/30 aria-[invalid=true]:border-red-500 dark:border-gray-700 dark:bg-gray-900";

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="mt-1 text-sm text-red-600">
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
  return (
    <div className="mb-4">
      <label htmlFor={name} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        inputMode={inputMode}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
        className={inputClass}
      />
      {hint && !error ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
      <FieldError id={`${name}-error`} message={error} />
    </div>
  );
}

export function ActivityForm({
  initial,
  id,
  hasParticipants = false,
}: {
  initial: ActivityInput;
  id?: string;
  hasParticipants?: boolean;
}) {
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
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {state.error}
        </div>
      ) : null}
      {errors && Object.keys(errors).length > 0 ? (
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          กรุณาแก้ช่องที่มีข้อความสีแดง
        </div>
      ) : null}

      <TextField label="ชื่อกิจกรรม" name="title" defaultValue={values.title} errors={errors} />

      <div className="mb-4">
        <label htmlFor="description" className="mb-1 block text-sm font-medium">
          รายละเอียด (ไม่บังคับ)
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={values.description}
          aria-invalid={errors?.description ? true : undefined}
          aria-describedby={errors?.description ? "description-error" : undefined}
          className={inputClass}
        />
        <FieldError id="description-error" message={errors?.description} />
      </div>

      <TextField label="สถานที่ (ไม่บังคับ)" name="location" defaultValue={values.location} errors={errors} />

      <div className="mb-4 flex items-center gap-2">
        <input
          id="isOffsite"
          name="isOffsite"
          type="checkbox"
          defaultChecked={values.isOffsite}
          className="h-5 w-5 accent-green-700"
        />
        <label htmlFor="isOffsite" className="text-sm">
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

      <fieldset className="mb-4" aria-describedby={errors?.type ? "type-error" : undefined}>
        <legend className="mb-1 block text-sm font-medium">ชนิดกิจกรรม</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {ACTIVITY_TYPES.map((t) => (
            <label
              key={t}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 py-3 has-[:checked]:border-green-600 has-[:checked]:bg-green-50 dark:border-gray-700 dark:has-[:checked]:bg-green-950"
            >
              <input
                type="radio"
                name="type"
                value={t}
                checked={type === t}
                onChange={() => chooseType(t)}
                className="h-4 w-4 accent-green-700"
              />
              {typeLabelTh(t)}
            </label>
          ))}
        </div>
        <FieldError id="type-error" message={errors?.type} />
      </fieldset>

      {type === "waste" ? (
        <div key="waste">
          <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
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
        <div className="flex items-center gap-2">
          <input
            id="requiresCode"
            name="requiresCode"
            type="checkbox"
            checked={requiresCode}
            onChange={(e) => setRequiresCode(e.target.checked)}
            className="h-5 w-5 accent-green-700"
          />
          <label htmlFor="requiresCode" className="text-sm">
            ต้องใช้รหัสยืนยันจากจุดชั่งเมื่อส่งผล
          </label>
        </div>
        <p className="mt-1 text-xs text-gray-500">ค่าเริ่มต้น: ชั่งน้ำหนักขยะต้องใช้รหัส ชนิดอื่นไม่ต้อง</p>
      </div>

      <div className="mb-6">
        <label htmlFor="status" className="mb-1 block text-sm font-medium">
          สถานะ
        </label>
        <select
          id="status"
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
        <FieldError id="status-error" message={errors?.status} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row-reverse">
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-green-700 px-4 py-3 text-base font-semibold text-white hover:bg-green-800 disabled:opacity-60 sm:w-auto"
        >
          {pending ? "กำลังบันทึก..." : "บันทึกกิจกรรม"}
        </button>
        <Link
          href="/staff/activities"
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-center text-base dark:border-gray-700 sm:w-auto"
        >
          ยกเลิก
        </Link>
      </div>
    </form>
  );
}
