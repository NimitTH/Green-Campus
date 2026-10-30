import { BANGKOK_TIME_ZONE } from "@/lib/datetime";

export type Greeting = "สวัสดีตอนเช้า" | "สวัสดีตอนเที่ยง" | "สวัสดีตอนบ่าย" | "สวัสดีตอนเย็น";

const hourFormat = new Intl.DateTimeFormat("en-GB", { timeZone: BANGKOK_TIME_ZONE, hour: "2-digit", hourCycle: "h23" });

/** Time-of-day greeting in Asia/Bangkok: 05-10 morning, 11-12 noon, 13-16 afternoon, 17-04 evening. */
export function greetingFor(date: Date): Greeting {
  const hour = Number(hourFormat.format(date));
  if (hour >= 5 && hour < 11) return "สวัสดีตอนเช้า";
  if (hour >= 11 && hour < 13) return "สวัสดีตอนเที่ยง";
  if (hour >= 13 && hour < 17) return "สวัสดีตอนบ่าย";
  return "สวัสดีตอนเย็น";
}

/** displayName (trimmed) when non-empty, otherwise the first word of fullName. */
export function greetingName(user: { displayName: string | null; fullName: string }): string {
  const display = user.displayName?.trim();
  if (display) return display;
  return user.fullName.trim().split(/\s+/)[0] ?? "";
}
