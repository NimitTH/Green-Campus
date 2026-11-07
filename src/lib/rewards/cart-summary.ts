/** Points left after checking out the whole cart ("left"), or how many more are needed ("short"). */
export function cartRemainder(balance: number, total: number): { kind: "left" | "short"; points: number } {
  return total > balance ? { kind: "short", points: total - balance } : { kind: "left", points: balance - total };
}
