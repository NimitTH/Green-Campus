import { pageSizeOf, type ListConfig, type ListState } from "@/app/_components/list/list-params";
import { fetchPage } from "@/app/_components/list/paging";
import { toIlikePattern } from "@/app/_components/list/search-escape";
import type { NotificationRow } from "@/app/_components/notification-list";
import { createServerClient } from "@/lib/supabase/server";
import { NOTIFICATION_SORT_COLUMN, typePrefix } from "./list-config";

/**
 * One page of the caller's notifications (their session, so RLS limits it to their own rows). Optional title/body
 * search, a type-prefix filter, sorted by date or title then id. A page past the end returns no items with the real
 * total, so the page can ask again for the last page. Throws on failure.
 */
export async function listNotificationsPage(
  state: Pick<ListState, "q" | "sort" | "dir" | "filters" | "page">,
  config: ListConfig,
): Promise<{ items: NotificationRow[]; total: number }> {
  const supabase = await createServerClient();
  const pattern = state.q ? toIlikePattern(state.q) : null;
  const prefix = typePrefix(state.filters.type);
  const filtered = <T extends { ilike(column: string, pattern: string): T; like(column: string, pattern: string): T }>(query: T): T => {
    let out = query;
    if (pattern) out = out.ilike("title", pattern);
    if (prefix) out = out.like("type", prefix);
    return out;
  };
  const column = Object.hasOwn(NOTIFICATION_SORT_COLUMN, state.sort) ? NOTIFICATION_SORT_COLUMN[state.sort as keyof typeof NOTIFICATION_SORT_COLUMN] : "created_at";
  const ascending = state.dir === "asc";
  return fetchPage<NotificationRow>("listNotificationsPage", {
    page: state.page,
    size: pageSizeOf(config),
    run: (from, to) =>
      filtered(supabase.from("notifications").select("id, title, body, link, read_at, created_at", { count: "exact" }))
        .order(column, { ascending, nullsFirst: false })
        .order("id", { ascending })
        .range(from, to),
    head: () => filtered(supabase.from("notifications").select("id", { count: "exact", head: true })),
  });
}

/**
 * How many of the caller's notifications are unread, over the whole list (RLS limits it to their own rows), so
 * "อ่านทั้งหมด" does not depend on the page that is shown. Throws on failure.
 */
export async function countUnreadNotifications(): Promise<number> {
  const supabase = await createServerClient();
  const { count, error } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  if (error) throw new Error(`countUnreadNotifications: ${error.message}`);
  return count ?? 0;
}
