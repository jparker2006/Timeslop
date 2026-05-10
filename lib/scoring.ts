export type SlotShareState = "correct" | "wrong";

export function buildShareGrid(states: SlotShareState[], date: string): string {
  const emoji = (s: SlotShareState) => (s === "correct" ? "🟩" : "⬜");
  const score = states.filter((s) => s === "correct").length;
  return `Timeslop ${date} — ${score}/${states.length}\n${states.map(emoji).join("")}\ntimeslop.app`;
}
