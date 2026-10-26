export type CountdownTone = "normal" | "warn" | "danger";

/** Colour step for the weigh-code countdown: warn in the last five minutes, danger once expired. */
export function countdownTone(remainingMs: number): CountdownTone {
  if (remainingMs <= 0) return "danger";
  if (remainingMs <= 300_000) return "warn";
  return "normal";
}
