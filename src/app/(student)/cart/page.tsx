import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/dal";
import { cartTotal, getBalance, listCartLines } from "@/lib/rewards/queries";
import { CartLine } from "./cart-line";
import { CheckoutButton } from "./checkout-button";

export const metadata: Metadata = { title: "ตะกร้า | Green Campus" };

export default function CartPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <div className="mb-5">
        <PageHeader title="ตะกร้า" />
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <Cart />
      </Suspense>
    </main>
  );
}

const number = new Intl.NumberFormat("th-TH");

async function Cart() {
  const user = await requireUser("/cart");
  if (user.role !== "student") {
    return (
      <EmptyState>เฉพาะบัญชีนักเรียนเท่านั้นที่ใช้ตะกร้าได้</EmptyState>
    );
  }
  const [lines, balance] = await Promise.all([listCartLines(user.id), getBalance(user.id)]);

  if (lines.length === 0) {
    return (
      <EmptyState>
        <p>ตะกร้าว่าง</p>
        <ButtonLink href="/rewards" variant="card" className="mt-3">
          ไปเลือกของรางวัล
        </ButtonLink>
      </EmptyState>
    );
  }

  const total = cartTotal(lines);
  return (
    <>
      <ul className="space-y-3">
        {lines.map((l) => (
          <CartLine
            key={l.rewardId}
            line={{
              rewardId: l.rewardId,
              qty: l.qty,
              reward:
                l.reward && l.reward.active
                  ? { name: l.reward.name, pointsCost: l.reward.points_cost, stock: l.reward.stock, imageUrl: l.reward.imageUrl }
                  : null,
            }}
          />
        ))}
      </ul>
      <Card as="section" tone="accent" aria-label="สรุปตะกร้า" className="mt-5 space-y-1">
        <p className="flex justify-between">
          <span>รวมทั้งหมด</span>
          <strong data-testid="cart-total">
            <span className="font-mono">{number.format(total)}</span> แต้ม
          </strong>
        </p>
        <p className="flex justify-between text-sm">
          <span>แต้มของฉัน</span>
          <span data-testid="balance">
            <span className="font-mono">{number.format(balance)}</span> แต้ม
          </span>
        </p>
        {total > balance ? (
          <p role="alert" className="pt-1 text-sm font-medium text-danger">
            แต้มไม่พอ ขาดอีก <span className="font-mono">{number.format(total - balance)}</span> แต้ม
          </p>
        ) : null}
        <p className="pt-1 text-xs text-muted">
          ตะกร้าไม่ได้กันสต็อกไว้ให้ ของอาจหมดก่อนยืนยันแลก
        </p>
      </Card>
      <CheckoutButton
        disabled={total > balance}
        names={Object.fromEntries(lines.map((l) => [l.rewardId, l.reward?.active ? l.reward.name : "ของรางวัลที่ปิดการแลกแล้ว"]))}
      />
    </>
  );
}
