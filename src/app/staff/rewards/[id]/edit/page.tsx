import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth/dal";
import { isAdminRole } from "@/lib/auth/routes";
import { getReward } from "@/lib/rewards/queries";
import { rewardToInput } from "@/lib/rewards/validation";
import { isUuid } from "@/lib/uuid";
import { DeleteRewardButton } from "../../_components/delete-reward-button";
import { RewardForm } from "../../_components/reward-form";

export const metadata: Metadata = { title: "แก้ไขของรางวัล | Green Campus" };

// cacheComponents: params are request-time data, read them inside <Suspense>.
export default function EditRewardPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <div className="mb-6">
        <PageHeader title="แก้ไขของรางวัล" />
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <EditReward params={params} />
      </Suspense>
    </main>
  );
}

async function EditReward({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // per-route id: two edit pages can be alive at once (hidden <Activity>); useId is identical across separate server renders
  const deleteHeadingId = `delete-heading-${id}`;
  const user = await requireStaff(`/staff/rewards/${encodeURIComponent(id)}/edit`);
  if (!isUuid(id)) notFound();
  const reward = await getReward(id);
  if (!reward) notFound();
  return (
    <>
      <RewardForm initial={rewardToInput(reward)} id={reward.id} imageUrl={reward.imageUrl} />
      {isAdminRole(user.role) ? (
        <section aria-labelledby={deleteHeadingId} className="mt-10 border-t border-rule pt-6">
          <h2 id={deleteHeadingId} className="mb-2 font-display text-lg font-semibold">
            ลบของรางวัล
          </h2>
          <p className="mb-3 text-sm text-muted">
            ลบได้เฉพาะของรางวัลที่ยังไม่มีคนแลก ถ้ามีคนแลกแล้วให้ปิดการแลกแทน
          </p>
          <DeleteRewardButton rewardId={reward.id} name={reward.name} />
        </section>
      ) : null}
    </>
  );
}
