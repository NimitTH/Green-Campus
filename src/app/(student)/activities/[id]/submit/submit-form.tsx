"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { submitResult, type SubmitItem } from "@/app/actions/submissions";
import { submitErrorMessageTh, uploadErrorCode } from "@/lib/errors";
import { ImageError, resizeToJpeg } from "@/lib/image";
import { createBrowserClient } from "@/lib/supabase/browser";
import { TimeoutError, withTimeout } from "@/lib/timeout";
import { estimateWaste, toGrams } from "@/lib/units";

export type WasteCategoryOption = { id: string; name: string; pointsPerKg: number; carbonKgPerKg: number };
export type SubmitActivity = {
  id: string;
  type: "waste" | "trees" | "fixed";
  requiresCode: boolean;
  unitPoints: number;
  unitCarbonKg: number | null;
  maxPerSubmission: number | null;
};

type Weight = { kg: string; khit: string };

/** Upload and the submit call each give up after this long, so the button never stays on loading. */
const REQUEST_TIMEOUT_MS = 60_000;
/** After these the student may already have a submission (lost response): point to ผลที่ส่ง. */
const CHECK_HISTORY_CODES = new Set(["code_invalid", "request_timeout", "evidence_already_used"]);

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-base dark:border-gray-700 dark:bg-gray-900";

/** "" -> 0; a non-negative number -> it; anything else -> null. */
function parseNumber(text: string, integer: boolean): number | null {
  const t = text.trim();
  if (t === "") return 0;
  if (!(integer ? /^\d+$/ : /^\d+(\.\d+)?$/).test(t)) return null;
  return Number(t);
}

/** Grams for one category, or null when the input is not a valid weight. */
function gramsOf(w: Weight | undefined): number | null {
  const kg = parseNumber(w?.kg ?? "", false);
  const khit = parseNumber(w?.khit ?? "", true);
  if (kg === null || khit === null) return null;
  try {
    return toGrams(kg, khit);
  } catch {
    return null;
  }
}

type Built = { items: SubmitItem[] } | { errorCode: string };

function buildItems(
  activity: SubmitActivity,
  categories: WasteCategoryOption[],
  weights: Record<string, Weight>,
  trees: string,
): Built {
  if (activity.type === "fixed") return { items: [] };
  if (activity.type === "trees") {
    const count = parseNumber(trees, true);
    if (count === null || count <= 0 || count > 2147483647) return { errorCode: "invalid_items" };
    if (activity.maxPerSubmission !== null && count > activity.maxPerSubmission) return { errorCode: "over_limit" };
    return { items: [{ quantity: count }] };
  }
  const items: SubmitItem[] = [];
  let total = 0;
  for (const c of categories) {
    const grams = gramsOf(weights[c.id]);
    if (grams === null) return { errorCode: "invalid_items" };
    if (grams > 0) items.push({ waste_category_id: c.id, quantity: grams });
    total += grams;
  }
  if (items.length === 0) return { errorCode: "invalid_items" };
  if (activity.maxPerSubmission !== null && total > activity.maxPerSubmission) return { errorCode: "over_limit" };
  return { items };
}

function estimate(
  activity: SubmitActivity,
  categories: WasteCategoryOption[],
  weights: Record<string, Weight>,
  trees: string,
): { points: number; carbonKg: number } | null {
  if (activity.type === "fixed") return { points: activity.unitPoints, carbonKg: activity.unitCarbonKg ?? 0 };
  if (activity.type === "trees") {
    const count = parseNumber(trees, true);
    if (count === null) return null;
    return { points: count * activity.unitPoints, carbonKg: Math.round(count * (activity.unitCarbonKg ?? 0) * 1000) / 1000 };
  }
  const items = [];
  for (const c of categories) {
    const grams = gramsOf(weights[c.id]);
    if (grams === null) return null;
    items.push({ grams, rates: { pointsPerKg: c.pointsPerKg, carbonKgPerKg: c.carbonKgPerKg } });
  }
  try {
    return estimateWaste(items);
  } catch {
    return null;
  }
}

/** Submit form (spec 9.4). Order: resize photo -> upload to `evidence` -> submit_result (spec 7.1). */
export function SubmitForm({
  userId,
  activity,
  categories,
}: {
  userId: string;
  activity: SubmitActivity;
  categories: WasteCategoryOption[];
}) {
  const router = useRouter();
  const formId = useId();
  const [weights, setWeights] = useState<Record<string, Weight>>({});
  const [trees, setTrees] = useState("");
  const [code, setCode] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<{ code: string | null; message: string } | null>(null);
  // Guards a second tap before React re-renders the disabled button.
  const busyRef = useRef(false);
  // The photo already uploaded for this file: a retry after e.g. a wrong code reuses it.
  const uploaded = useRef<{ file: File; path: string } | null>(null);

  const est = estimate(activity, categories, weights, trees);

  function setWeight(id: string, key: keyof Weight, value: string) {
    setWeights((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { kg: "", khit: "" }), [key]: value } }));
  }

  async function upload(photo: File): Promise<string> {
    if (uploaded.current?.file === photo) return uploaded.current.path;
    setStage("กำลังย่อรูป...");
    const jpeg = await resizeToJpeg(photo);
    setStage("กำลังอัปโหลดรูป...");
    const path = `${userId}/${crypto.randomUUID()}/evidence.jpg`;
    let failure: string | null;
    try {
      const { error: uploadError } = await withTimeout(
        createBrowserClient().storage.from("evidence").upload(path, jpeg, { contentType: "image/jpeg", upsert: false }),
        REQUEST_TIMEOUT_MS,
      );
      failure = uploadError ? uploadErrorCode(uploadError as { status?: number; statusCode?: string; message?: string }) : null;
    } catch (e) {
      failure = e instanceof TimeoutError ? e.code : "upload_failed"; // network error
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
    let done = false;
    try {
      const built = buildItems(activity, categories, weights, trees);
      if ("errorCode" in built) throw new Error(built.errorCode);
      if (!file) throw new Error("bad_evidence_path");
      const trimmed = code.trim();
      if (activity.requiresCode && !/^\d{6}$/.test(trimmed)) throw new Error("code_required");

      const evidencePath = await upload(file);
      setStage("กำลังส่งผล...");
      const result = await withTimeout(
        submitResult({
          activityId: activity.id,
          code: activity.requiresCode ? trimmed : null,
          items: built.items,
          evidencePath,
        }),
        REQUEST_TIMEOUT_MS,
      );
      if (!result.ok) {
        // The photo is missing or already used: the next try uploads it again under a new path.
        if (result.code === "bad_evidence_path" || result.code === "evidence_already_used") uploaded.current = null;
        setError({ code: result.code, message: result.error });
        return;
      }
      done = true;
      router.push("/my-submissions");
    } catch (e) {
      const codeOf = e instanceof ImageError || e instanceof TimeoutError ? e.code : e instanceof Error ? e.message : null;
      setError({ code: codeOf, message: submitErrorMessageTh(codeOf) });
    } finally {
      setStage(null);
      // After success the button stays disabled while the next page loads.
      if (!done) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      {activity.type === "waste" ? (
        <fieldset className="space-y-3">
          <legend className="mb-2 font-semibold">น้ำหนักขยะแต่ละกลุ่ม</legend>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            กรอกเป็นกิโลกรัมและขีด (1 ขีด = 100 กรัม) เว้นว่างกลุ่มที่ไม่มี
            {activity.maxPerSubmission !== null ? ` · รวมไม่เกิน ${activity.maxPerSubmission / 1000} กก. ต่อครั้ง` : ""}
          </p>
          {categories.map((c) => (
            <div key={c.id} className="grid grid-cols-[1fr_6rem_5rem] items-end gap-2">
              <span className="pb-2 break-words">{c.name}</span>
              <label className="text-xs text-gray-600 dark:text-gray-400">
                กก.
                <input
                  aria-label={`${c.name} กิโลกรัม`}
                  inputMode="decimal"
                  className={inputClass}
                  value={weights[c.id]?.kg ?? ""}
                  onChange={(e) => setWeight(c.id, "kg", e.target.value)}
                />
              </label>
              <label className="text-xs text-gray-600 dark:text-gray-400">
                ขีด
                <input
                  aria-label={`${c.name} ขีด`}
                  inputMode="numeric"
                  className={inputClass}
                  value={weights[c.id]?.khit ?? ""}
                  onChange={(e) => setWeight(c.id, "khit", e.target.value)}
                />
              </label>
            </div>
          ))}
        </fieldset>
      ) : null}

      {activity.type === "trees" ? (
        <label className="block">
          <span className="mb-1 block font-semibold">จำนวนต้นไม้ที่ปลูก</span>
          <input
            inputMode="numeric"
            className={inputClass}
            value={trees}
            onChange={(e) => setTrees(e.target.value)}
          />
          {activity.maxPerSubmission !== null ? (
            <span className="mt-1 block text-sm text-gray-600 dark:text-gray-400">
              ไม่เกิน {activity.maxPerSubmission} ต้นต่อครั้ง
            </span>
          ) : null}
        </label>
      ) : null}

      <label className="block">
        <span className="mb-1 block font-semibold">รูปหลักฐาน</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="block w-full text-sm"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <span className="mt-1 block text-sm text-gray-600 dark:text-gray-400">
          ถ่ายรูปขณะชั่งหรือทำกิจกรรม ระบบจะย่อรูปให้อัตโนมัติ
        </span>
      </label>

      {activity.requiresCode ? (
        <label className="block">
          <span className="mb-1 block font-semibold">รหัสจากจุดชั่ง (6 หลัก)</span>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="\d{6}"
            className={`${inputClass} font-mono tracking-widest`}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
        </label>
      ) : null}

      <section
        aria-labelledby={`${formId}-estimate`}
        className="rounded-2xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950"
      >
        <h2 id={`${formId}-estimate`} className="font-semibold">
          ประมาณการแต้มและ carbon
        </h2>
        {est ? (
          <p className="mt-1 text-lg">
            {est.points.toLocaleString("th-TH")} แต้ม · {est.carbonKg.toLocaleString("th-TH")} กก. CO2e
          </p>
        ) : (
          <p className="mt-1 text-lg">-</p>
        )}
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          เป็นค่าประมาณเท่านั้น แต้มจริงจะได้เมื่อครูตรวจผ่าน
        </p>
      </section>

      {error ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error.message}
          {error.code && CHECK_HISTORY_CODES.has(error.code) ? (
            <>
              {" "}
              <Link href="/my-submissions" className="font-semibold underline">
                ดูผลที่ส่ง
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-green-700 px-4 py-3 text-base font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? (stage ?? "กำลังส่ง...") : "ส่งผล"}
      </button>
    </form>
  );
}
