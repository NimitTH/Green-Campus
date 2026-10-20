import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { requireUser } from "@/lib/auth/dal";
import { getActivity, hasActiveSubmission, hasJoined } from "@/lib/activities/queries";
import { inSubmitWindow } from "@/lib/activities/status";
import { createServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";
import { SubmitForm, type WasteCategoryOption } from "./submit-form";

export const metadata: Metadata = { title: "ส่งผล | Green Campus" };

// cacheComponents: params and the session are request-time data, read them inside <Suspense>.
export default function SubmitPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <Suspense fallback={<PageSkeleton />}>
        <Submit params={params} />
      </Suspense>
    </main>
  );
}

function Notice({ activityId, children }: { activityId: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-gray-600 dark:border-gray-700 dark:text-gray-400">
      <p>{children}</p>
      <Link href={`/activities/${activityId}`} className="mt-3 inline-block text-sm text-green-700 underline">
        กลับไปหน้ากิจกรรม
      </Link>
    </section>
  );
}

async function Submit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/activities/${encodeURIComponent(id)}/submit`);
  if (!isUuid(id)) notFound();
  const activity = await getActivity(id);
  if (!activity) notFound();

  const back = (
    <Link href={`/activities/${activity.id}`} className="mb-4 inline-block text-sm text-green-700 underline">
      ← {activity.title}
    </Link>
  );
  if (user.role !== "student") {
    return <Notice activityId={activity.id}>เฉพาะบัญชีนักเรียนเท่านั้นที่ส่งผลได้</Notice>;
  }
  if (!(await hasJoined(activity.id, user.id))) {
    return <Notice activityId={activity.id}>คุณยังไม่ได้เข้าร่วมกิจกรรมนี้ กดเข้าร่วมกิจกรรมก่อนส่งผล</Notice>;
  }
  if (!inSubmitWindow({ status: activity.status, startsAt: activity.starts_at, endsAt: activity.ends_at })) {
    return (
      <Notice activityId={activity.id}>
        ตอนนี้ส่งผลไม่ได้ เพราะกิจกรรมยังไม่เริ่ม หรือเลยช่วงส่งผลแล้ว (ส่งได้ถึง 3 วันหลังกิจกรรมสิ้นสุด)
      </Notice>
    );
  }

  if (activity.type === "fixed" && (await hasActiveSubmission(activity.id, user.id))) {
    return (
      <>
        {back}
        <section className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-gray-600 dark:border-gray-700 dark:text-gray-400">
          <p className="font-semibold">ส่งผลแล้ว</p>
          <Link href="/my-submissions" className="mt-3 inline-block text-sm text-green-700 underline">
            ดูผลที่ส่ง
          </Link>
        </section>
      </>
    );
  }

  let categories: WasteCategoryOption[] = [];
  if (activity.type === "waste") {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("waste_categories")
      .select("id, name, points_per_kg, carbon_kg_per_kg")
      .order("created_at", { ascending: true });
    if (error) throw new Error(`waste categories: ${error.message}`);
    categories = (data ?? []).map((raw) => {
      const row = raw as { id: string; name: string; points_per_kg: number; carbon_kg_per_kg: number | string };
      return { id: row.id, name: row.name, pointsPerKg: row.points_per_kg, carbonKgPerKg: Number(row.carbon_kg_per_kg) };
    });
  }

  return (
    <>
      {back}
      <h1 className="mb-5 text-xl font-semibold break-words">ส่งผล: {activity.title}</h1>
      <SubmitForm
        userId={user.id}
        activity={{
          id: activity.id,
          type: activity.type,
          requiresCode: activity.requires_code,
          unitPoints: activity.unit_points,
          unitCarbonKg: activity.unit_carbon_kg,
          maxPerSubmission: activity.max_per_submission,
        }}
        categories={categories}
      />
    </>
  );
}
