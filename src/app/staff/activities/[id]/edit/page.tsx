import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { requireStaff } from "@/lib/auth/dal";
import { getActivity } from "@/lib/activities/queries";
import { activityToInput } from "@/lib/activities/validation";
import { isUuid } from "@/lib/uuid";
import { createServerClient } from "@/lib/supabase/server";
import { ActivityForm } from "../../_components/activity-form";
import { DeleteActivityButton } from "../../_components/delete-activity-button";

export const metadata: Metadata = { title: "แก้ไขกิจกรรม | Green Campus" };

// cacheComponents: params are request-time data, read them inside <Suspense>.
export default function EditActivityPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <h1 className="mb-5 text-xl font-semibold">แก้ไขกิจกรรม</h1>
      <Suspense fallback={<PageSkeleton />}>
        <EditActivity params={params} />
      </Suspense>
    </main>
  );
}

async function EditActivity({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaff(`/staff/activities/${encodeURIComponent(id)}/edit`);
  if (!isUuid(id)) notFound();
  const activity = await getActivity(id);
  if (!activity) notFound();
  // Convenience only: activity_status_locked (trigger) is the real boundary.
  const supabase = await createServerClient();
  const { count: participants } = await supabase
    .from("participations")
    .select("id", { count: "exact", head: true })
    .eq("activity_id", id);
  return (
    <>
      <ActivityForm initial={activityToInput(activity)} id={activity.id} hasParticipants={(participants ?? 0) > 0} />
      <section aria-labelledby="delete-heading" className="mt-10 border-t border-gray-200 pt-6 dark:border-gray-800">
        <h2 id="delete-heading" className="mb-2 font-semibold">
          ลบกิจกรรม
        </h2>
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
          ลบได้เฉพาะกิจกรรมที่ยังไม่มีผู้ส่งผล ถ้ามีผลแล้วให้เปลี่ยนสถานะเป็นปิดแทน
        </p>
        <DeleteActivityButton activityId={activity.id} title={activity.title} />
      </section>
    </>
  );
}
