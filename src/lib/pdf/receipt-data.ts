import type { OrderDetail } from "@/lib/orders/queries";
import { orderNumber, orderStatusLabelTh } from "@/lib/orders/format";
import type { ReceiptData } from "./receipt";

/**
 * getOrder() result -> what the receipt prints. Pure: names are the order_items.reward_name
 * snapshot (getOrder), the status is the single Thai label (ready_at makes it พร้อมรับ). The raw
 * status and ready_at go along too: the receipt decides pending / overdue from them, not the label.
 */
export function toReceiptData(order: OrderDetail): ReceiptData {
  return {
    orderNo: orderNumber(order.id),
    createdAt: new Date(order.createdAt),
    studentName: order.studentName?.trim() || "-",
    status: orderStatusLabelTh(order.status, order.readyAt),
    rawStatus: order.status,
    readyAt: order.readyAt ? new Date(order.readyAt) : null,
    expiresAt: new Date(order.expiresAt),
    items: order.lines.map((l) => ({ name: l.name, qty: l.qty, unitCost: l.unitCost })),
    totalPoints: order.totalPoints,
  };
}
