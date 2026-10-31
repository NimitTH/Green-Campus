import { createAnonClient } from "@/lib/supabase/anon";

// Activity cover images (DESIGN-3 6.1, migration 0028): public bucket `activity-images`, one object per cover at
// `<activity id>/<lowercase uuid>.jpg` (the same shape the activities_cover_path_format check enforces).

export const ACTIVITY_BUCKET = "activity-images";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const COVER_PATH_RE = new RegExp(`^(${UUID})/${UUID}\\.jpg$`);

/** True when `path` is a cover object inside this activity's own folder. */
export function isActivityCoverPath(path: string, activityId: string): boolean {
  const match = COVER_PATH_RE.exec(path);
  return match !== null && match[1] === activityId.toLowerCase();
}

/** The public URL of a cover path, or null when there is none. */
export function activityCoverUrl(path: string | null | undefined): string | null {
  return path ? createAnonClient().storage.from(ACTIVITY_BUCKET).getPublicUrl(path).data.publicUrl : null;
}
