"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { Button, Card, inputClass, inputClassLg } from "@/components/ui";
import { submitResult, type SubmitItem } from "@/app/actions/submissions";
import { submitErrorMessageTh, uploadErrorCode } from "@/lib/errors";
import { ImageError, resizeToJpeg } from "@/lib/image";
import { createBrowserClient } from "@/lib/supabase/browser";
import { TimeoutError, withTimeout } from "@/lib/timeout";
import { uniqueId } from "@/lib/unique-id";
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
const CHECK_HISTORY_CODES = new Set(["code_invalid", "request_timeout", "evidence_already_used", "already_submitted"]);

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
  const fileInput = useRef<HTMLInputElement>(null);

  const est = estimate(activity, categories, weights, trees);

  function setWeight(id: string, key: keyof Weight, value: string) {
    setWeights((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { kg: "", khit: "" }), [key]: value } }));
  }

  async function upload(photo: File): Promise<string> {
    if (uploaded.current?.file === photo) return uploaded.current.path;
    setStage("กำลังย่อรูป...");
    const jpeg = await resizeToJpeg(photo);
    setStage("กำลังอัปโหลดรูป...");
    const path = `${userId}/${uniqueId()}/evidence.jpg`;
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
      // Cache Components keep this page alive (hidden in <Activity>): Back, or the next submission of a
      // waste / trees activity, comes back to this same form. Start it fresh: no busy button, no old
      // weights, code or photo (the evidence path is generated per upload, so nothing else to renew).
      uploaded.current = null;
      setWeights({});
      setTrees("");
      setCode("");
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      router.push("/my-submissions");
    } catch (e) {
      const codeOf = e instanceof ImageError || e instanceof TimeoutError ? e.code : e instanceof Error ? e.message : null;
      setError({ code: codeOf, message: submitErrorMessageTh(codeOf) });
    } finally {
      setStage(null);
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      {activity.type === "waste" ? (
        <fieldset className="space-y-3">
          <legend className="mb-2 font-display text-lg font-semibold">น้ำหนักขยะแต่ละกลุ่ม</legend>
          <p className="text-sm text-muted">
            กรอกเป็นกิโลกรัมและขีด (1 ขีด = 100 กรัม) เว้นว่างกลุ่มที่ไม่มี
            {activity.maxPerSubmission !== null ? ` · รวมไม่เกิน ${activity.maxPerSubmission / 1000} กก. ต่อครั้ง` : ""}
          </p>
          {categories.map((c) => (
            <Card key={c.id} className="grid grid-cols-2 items-end gap-3">
              <span className="col-span-2 font-semibold break-words">{c.name}</span>
              <label className="text-sm text-muted">
                กก.
                <input
                  aria-label={`${c.name} กิโลกรัม`}
                  inputMode="decimal"
                  className={inputClass}
                  value={weights[c.id]?.kg ?? ""}
                  onChange={(e) => setWeight(c.id, "kg", e.target.value)}
                />
              </label>
              <label className="text-sm text-muted">
                ขีด
                <input
                  aria-label={`${c.name} ขีด`}
                  inputMode="numeric"
                  className={inputClass}
                  value={weights[c.id]?.khit ?? ""}
                  onChange={(e) => setWeight(c.id, "khit", e.target.value)}
                />
              </label>
            </Card>
          ))}
        </fieldset>
      ) : null}

      {activity.type === "trees" ? (
        <Card as="div">
          <label className="block">
            <span className="mb-1 block font-semibold">จำนวนต้นไม้ที่ปลูก</span>
            <input
              inputMode="numeric"
              className={inputClass}
              value={trees}
              onChange={(e) => setTrees(e.target.value)}
            />
            {activity.maxPerSubmission !== null ? (
              <span className="mt-1 block text-sm text-muted">
                ไม่เกิน {activity.maxPerSubmission} ต้นต่อครั้ง
              </span>
            ) : null}
          </label>
        </Card>
      ) : null}

      <label className="block rounded-card border border-dashed border-rule-strong bg-paper p-4">
        <span className="mb-2 block font-semibold">รูปหลักฐาน</span>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="block w-full text-sm text-ink file:mr-3 file:min-h-11 file:rounded-input file:border file:border-rule-strong file:bg-surface file:px-4 file:text-ink"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <span className="mt-2 block text-sm text-muted">
          ถ่ายรูปขณะชั่งหรือทำกิจกรรม ระบบจะย่อรูปให้อัตโนมัติ
        </span>
      </label>

      {activity.requiresCode ? (
        <Card as="div">
          <label className="block">
            <span className="mb-1 block font-semibold">รหัสจากจุดชั่ง (6 หลัก)</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="\d{6}"
              className={`${inputClassLg} font-mono tracking-[0.3em]`}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </label>
        </Card>
      ) : null}

      <Card
        as="section"
        tone="accent"
        aria-labelledby={`${formId}-estimate`}
      >
        <h2 id={`${formId}-estimate`} className="font-display font-semibold">
          ประมาณการแต้มและ carbon
        </h2>
        {est ? (
          <p className="mt-1 text-lg">
            <span className="font-mono">{est.points.toLocaleString("th-TH")}</span> แต้ม ·{" "}
            <span className="font-mono">{est.carbonKg.toLocaleString("th-TH")}</span> กก. CO2e
          </p>
        ) : (
          <p className="mt-1 text-lg">-</p>
        )}
        <p className="mt-1 text-sm text-muted">
          เป็นค่าประมาณเท่านั้น แต้มจริงจะได้เมื่อครูตรวจผ่าน
        </p>
      </Card>

      {error ? (
        <p role="alert" className="rounded-input border border-danger p-3 text-sm text-danger">
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

      <Button type="submit" variant="primary" size="lg" disabled={busy} className="w-full sm:w-auto">
        {busy ? (stage ?? "กำลังส่ง...") : "ส่งผล"}
      </Button>
    </form>
  );
}
