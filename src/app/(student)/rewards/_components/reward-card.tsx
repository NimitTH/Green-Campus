import { Badge } from "@/app/_components/activity-ui";
import { RewardImage } from "@/app/_components/reward-image";
import { Card } from "@/components/ui";
import type { Reward } from "@/lib/rewards/queries";
import { AddToCartButton } from "../add-to-cart-button";

// One reward on /rewards, as a card (grid view) or a row (list view, 96x64 thumbnail). Both keep the same
// data-testid and the add-to-cart button (students only; staff just look).

const number = new Intl.NumberFormat("th-TH");

function Stock({ reward: r }: { reward: Reward }) {
  return r.stock > 0 ? (
    <>
      เหลือ <span className="font-mono">{number.format(r.stock)}</span> ชิ้น
    </>
  ) : (
    <Badge tone="amber">หมดแล้ว</Badge>
  );
}

export function RewardCard({
  reward: r,
  isStudent,
}: {
  reward: Reward;
  isStudent: boolean;
}) {
  return (
    <Card
      as="li"
      flush
      data-testid="reward-card"
      className="flex flex-col overflow-hidden"
    >
      <RewardImage url={r.imageUrl} className="aspect-[4/3] w-full" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 className="font-semibold break-words">{r.name}</h2>
        <p className="text-accent">
          <span className="font-mono">{number.format(r.points_cost)}</span> แต้ม
        </p>
        <p className="text-sm text-muted">
          <Stock reward={r} />
        </p>
        {isStudent ? (
          <div className="mt-auto pt-2">
            <AddToCartButton rewardId={r.id} outOfStock={r.stock <= 0} />
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export function RewardRow({
  reward: r,
  isStudent,
}: {
  reward: Reward;
  isStudent: boolean;
}) {
  return (
    <li
      data-testid="reward-card"
      className="flex min-w-0 items-center gap-3 p-3 md:p-4"
    >
      <RewardImage
        url={r.imageUrl}
        className="h-16 w-24 shrink-0 rounded-input"
      />
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold break-words">{r.name}</h2>
        <p className="text-accent">
          <span className="font-mono">{number.format(r.points_cost)}</span> แต้ม
        </p>
        <p className="text-sm text-muted">
          <Stock reward={r} />
        </p>
      </div>
      {isStudent ? (
        <div className="shrink-0">
          <AddToCartButton rewardId={r.id} outOfStock={r.stock <= 0} />
        </div>
      ) : null}
    </li>
  );
}
