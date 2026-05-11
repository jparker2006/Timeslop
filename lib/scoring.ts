export type SlotShareState = "correct" | "wrong";

export function buildShareGrid(states: SlotShareState[]): string {
  const emoji = (s: SlotShareState) => (s === "correct" ? "🟩" : "⬜");
  const score = states.filter((s) => s === "correct").length;
  return `Timeslop — ${score}/${states.length}\n${states.map(emoji).join("")}\nhttps://timeslop.vercel.app`;
}
