import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { requireUser } from "@/lib/auth/dal";
import { createServerClient } from "@/lib/supabase/server";
import { NotificationList, type NotificationRow } from "./notification-list";

export const metadata: Metadata = { title: "แจ้งเตือน | Green Campus" };

// Every signed-in role (staff too) reads their own rows; RLS limits them to user_id = auth.uid().
export default function NotificationsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <h1 className="mb-5 text-xl font-semibold">แจ้งเตือน</h1>
      <Suspense fallback={<PageSkeleton />}>
        <Notifications />
      </Suspense>
    </main>
  );
}

async function Notifications() {
  await requireUser("/notifications");
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, body, link, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("load notifications failed", error.code, error.message);
    return (
      <p role="alert" className="rounded-2xl border border-red-300 p-4 text-red-700">
        โหลดการแจ้งเตือนไม่สำเร็จ รีเฟรชหน้าแล้วลองอีกครั้ง
      </p>
    );
  }
  return <NotificationList items={(data ?? []) as NotificationRow[]} />;
}
