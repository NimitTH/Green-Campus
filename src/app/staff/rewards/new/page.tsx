import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { requireStaff } from "@/lib/auth/dal";
import type { RewardInput } from "@/lib/rewards/validation";
import { RewardForm } from "../_components/reward-form";

export const metadata: Metadata = { title: "เพิ่มของรางวัล | Green Campus" };

const EMPTY: RewardInput = { name: "", pointsCost: "", stock: "0", active: true };

export default function NewRewardPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <h1 className="mb-5 text-xl font-semibold">เพิ่มของรางวัล</h1>
      <Suspense fallback={<PageSkeleton />}>
        <NewReward />
      </Suspense>
    </main>
  );
}

async function NewReward() {
  await requireStaff("/staff/rewards/new");
  return <RewardForm initial={EMPTY} />;
}
