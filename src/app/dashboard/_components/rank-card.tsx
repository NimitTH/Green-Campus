import Link from "next/link";
import { getLeaderboard } from "@/lib/leaderboard/queries";

// Students only; rendered after the session read (inside <Suspense>), see the dashboard page.
// A failed lookup hides the card instead of breaking the dashboard.
export async function RankCard() {
  let rank: number | null = null;
  try {
    const me = (await getLeaderboard("month")).find((r) => r.isMe);
    if (me) rank = me.rank;
  } catch {
    return null;
  }
  return (
    <Link
      href="/leaderboard"
      className="mb-4 block rounded-2xl border border-gray-200 p-4 font-semibold hover:border-green-600 dark:border-gray-800"
    >
      {rank === null ? "อันดับเดือนนี้ ยังไม่มีอันดับ" : `อันดับเดือนนี้ #${rank}`}
      <span className="block text-sm font-normal text-gray-600 dark:text-gray-400">ดูอันดับคาร์บอนทั้งหมด</span>
    </Link>
  );
}
