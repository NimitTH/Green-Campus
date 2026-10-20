import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/app/_components/activity-ui";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { requireUser } from "@/lib/auth/dal";
import { typeLabelTh } from "@/lib/activities/labels";
import { getActivity, hasActiveSubmission, hasJoined, type ActivityRow } from "@/lib/activities/queries";
import { inSubmitWindow, joinState, type JoinState } from "@/lib/activities/status";
import { formatBangkok } from "@/lib/datetime";
import { isUuid } from "@/lib/uuid";
import { JoinButton } from "./join-button";

export const metadata: Metadata = { title: "รายละเอียดกิจกรรม | Green Campus" };

// cacheComponents: params are request-time data, read them inside <Suspense>.
export default function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <Link href="/activities" className="mb-4 inline-block text-sm text-green-700 underline">
        ← กิจกรรมทั้งหมด
      </Link>
      <Suspense fallback={<PageSkeleton />}>
        <ActivityDetail params={params} />
      </Suspense>
    </main>
  );
}

const STATE_NOTE: Partial<Record<JoinState, string>> = {
  ended: "กิจกรรมนี้สิ้นสุดแล้ว เข้าร่วมไม่ได้",
  closed: "กิจกรรมนี้ปิดแล้ว",
  not_open: "กิจกรรมนี้ยังไม่เปิดรับ",
};

function rewardText(a: ActivityRow): string {
  if (a.type === "waste") return "แต้มและ carbon คิดจากน้ำหนักขยะแต่ละกลุ่มที่ครูตรวจผ่าน";
  const unit = a.type === "trees" ? "ต้น" : "ครั้ง";
  const carbon = a.unit_carbon_kg !== null ? ` และ carbon ${a.unit_carbon_kg} กก. CO2e` : "";
  return `ได้ ${a.unit_points} แต้มต่อ${unit}${carbon} เมื่อครูตรวจผ่าน`;
}

async function ActivityDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/activities/${encodeURIComponent(id)}`);
  if (!isUuid(id)) notFound();
  const activity = await getActivity(id);
  if (!activity) notFound();

  const joined = await hasJoined(activity.id, user.id);
  const state = joinState({ status: activity.status, endsAt: activity.ends_at, joined });
  const note = STATE_NOTE[state];
  // fixed activities: one pending/approved submission per student (the server enforces it)
  const canSubmit =
    user.role === "student" &&
    state === "joined" &&
    inSubmitWindow({ status: activity.status, startsAt: activity.starts_at, endsAt: activity.ends_at });
  const alreadySubmitted =
    canSubmit && activity.type === "fixed" && (await hasActiveSubmission(activity.id, user.id));

  return (
    <article>
      <h1 className="text-xl font-semibold break-words">{activity.title}</h1>
      <div className="mt-2 flex flex-wrap gap-2">
        <Badge>{typeLabelTh(activity.type)}</Badge>
        <Badge>{activity.is_offsite ? "นอกโรงเรียน" : "ในโรงเรียน"}</Badge>
        {activity.requires_code ? <Badge>ใช้รหัสจากจุดชั่งตอนส่งผล</Badge> : null}
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <div>
          <dt className="inline text-gray-500">เริ่ม: </dt>
          <dd className="inline">{formatBangkok(activity.starts_at)}</dd>
        </div>
        <div>
          <dt className="inline text-gray-500">สิ้นสุด: </dt>
          <dd className="inline">{formatBangkok(activity.ends_at)}</dd>
        </div>
        {activity.location ? (
          <div>
            <dt className="inline text-gray-500">สถานที่: </dt>
            <dd className="inline">{activity.location}</dd>
          </div>
        ) : null}
        <div>
          <dt className="inline text-gray-500">แต้ม: </dt>
          <dd className="inline">{rewardText(activity)}</dd>
        </div>
      </dl>

      {activity.description ? (
        <p className="mt-4 whitespace-pre-line text-gray-800 dark:text-gray-200">{activity.description}</p>
      ) : null}

      <div className="mt-6">
        {note ? (
          <p role="status" className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {note}
          </p>
        ) : null}
        {user.role !== "student" ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">เฉพาะบัญชีนักเรียนเท่านั้นที่เข้าร่วมกิจกรรมได้</p>
        ) : state === "can_join" || state === "joined" ? (
          <JoinButton activityId={activity.id} joined={state === "joined"} />
        ) : null}
        {canSubmit && alreadySubmitted ? (
          <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
            <span className="font-semibold">ส่งผลแล้ว</span>{" "}
            <Link href="/my-submissions" className="text-green-700 underline">
              ดูผลที่ส่ง
            </Link>
          </p>
        ) : canSubmit ? (
          <Link
            href={`/activities/${activity.id}/submit`}
            className="mt-3 block w-full rounded-lg bg-green-700 px-4 py-3 text-center text-base font-semibold text-white hover:bg-green-800 sm:inline-block sm:w-auto"
          >
            ส่งผล
          </Link>
        ) : null}
        {state === "joined" && activity.status === "closed" ? (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">กิจกรรมนี้ปิดแล้ว</p>
        ) : null}
      </div>
    </article>
  );
}
