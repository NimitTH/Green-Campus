import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { getOrder } from "@/lib/orders/queries";
import { renderReceipt } from "@/lib/pdf/receipt";
import { toReceiptData } from "@/lib/pdf/receipt-data";
import { isUuid } from "@/lib/uuid";

// GET /api/receipts/[orderId] (Task 14, R88; spec 8.5): the order receipt as a PDF download.
// The requester is checked before anything is generated: the order is read through the user-scoped
// client, so RLS lets through only its owner and staff. Anyone else gets the same 404 as a missing
// order, so another student cannot tell which order ids exist. Never the service role here.
// Runs in the Node.js runtime, the default (pdfmake/pdfkit and the font files need it): with
// cacheComponents the `runtime` segment config is rejected, so it is not exported. Request-time
// only: it reads the session cookie (never prerendered) and every response is private, no-store.

const NO_STORE = { "Cache-Control": "private, no-store" };

function status(code: 401 | 404): Response {
  return new Response(null, { status: code, headers: NO_STORE });
}

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/receipts/[orderId]">): Promise<Response> {
  const { orderId } = await ctx.params;
  if (!isUuid(orderId)) return status(404);
  const user = await getCurrentUser();
  if (!user) return status(401);
  const order = await getOrder(orderId);
  if (!order) return status(404);

  const data = toReceiptData(order);
  let pdf: Uint8Array;
  try {
    pdf = await renderReceipt(data);
  } catch (error) {
    // Logged server-side only; the browser gets a generic message (no stack, no order data).
    console.error("receipt render failed", data.orderNo, error);
    return new Response("สร้างใบเสร็จไม่สำเร็จ กรุณาลองใหม่อีกครั้ง (Receipt could not be generated.)", {
      status: 500,
      headers: { ...NO_STORE, "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return new Response(new Blob([pdf as Uint8Array<ArrayBuffer>], { type: "application/pdf" }), {
    status: 200,
    headers: {
      ...NO_STORE,
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="receipt-${data.orderNo}.pdf"`,
    },
  });
}
