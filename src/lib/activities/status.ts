export type JoinState = "joined" | "can_join" | "ended" | "closed" | "not_open";

/** What the student can do on an activity page; mirrors join_activity's rules (spec 6.3). */
export function joinState(args: {
  status: string;
  endsAt: string;
  joined: boolean;
  /** Defaults to the current time (server components call this after connection()). */
  now?: number;
}): JoinState {
  if (args.joined) return "joined";
  if (args.status === "closed") return "closed";
  if (args.status !== "open") return "not_open";
  if (isEnded(args.endsAt, args.now)) return "ended";
  return "can_join";
}

/** ends_at itself counts as ended (join_activity: now() >= ends_at). */
export function isEnded(endsAt: string, now: number = Date.now()): boolean {
  return now >= Date.parse(endsAt);
}
