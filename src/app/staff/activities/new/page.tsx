import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth/dal";
import type { ActivityInput } from "@/lib/activities/validation";
import { ActivityForm } from "../_components/activity-form";

export const metadata: Metadata = { title: "สร้างกิจกรรม | Green Campus" };

const EMPTY: ActivityInput = {
  title: "",
  description: "",
  location: "",
  isOffsite: false,
  startsAt: "",
  endsAt: "",
  status: "draft",
  type: "waste",
  requiresCode: null,
  unitPoints: "",
  unitCarbonKg: "",
  maxPerSubmission: "",
  details: "",
};

export default function NewActivityPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <div className="mb-6">
        <PageHeader title="สร้างกิจกรรม" />
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <NewActivity />
      </Suspense>
    </main>
  );
}

async function NewActivity() {
  await requireStaff("/staff/activities/new");
  return <ActivityForm initial={EMPTY} />;
}
