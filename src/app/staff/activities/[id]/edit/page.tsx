import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { requireStaff } from "@/lib/auth/dal";
import { getActivity } from "@/lib/activities/queries";
import { activityToInput } from "@/lib/activities/validation";
import { isUuid } from "@/lib/uuid";
import { ActivityForm } from "../../_components/activity-form";

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
  return <ActivityForm initial={activityToInput(activity)} id={activity.id} />;
}
