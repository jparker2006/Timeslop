"use client";

import { formatEventDate } from "@/lib/format";

export type CardKind = "historical" | "headline";

type Props = {
  title: string;
  kind: CardKind;
  date?: string;
  yearOnly?: boolean;
  state?: "neutral" | "correct" | "wrong" | "reveal" | "pending";
  compact?: boolean;
};

export function EventCard({ title, kind, date, yearOnly, state = "neutral", compact }: Props) {
  const border =
    state === "correct"
      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
      : state === "wrong"
      ? "border-rose-400 bg-rose-50 dark:bg-rose-950/40"
      : state === "reveal"
      ? "border-zinc-400 bg-zinc-100 dark:bg-zinc-800"
      : state === "pending"
      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40"
      : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900";

  const yearLabel = date ? formatEventDate(date, yearOnly ?? false) : null;

  void kind;
  return (
    <div
      className={`rounded-lg border-2 px-4 ${compact ? "py-2.5" : "py-3.5"} shadow-sm select-none transition-colors duration-300 ${border}`}
    >
      <div className="flex items-start gap-3">
        {yearLabel && (
          <span className="shrink-0 text-sm font-semibold tabular-nums text-zinc-700 dark:text-zinc-300 mt-0.5">
            {yearLabel.match(/(AD\s+)?\d+$/)?.[0] ?? yearLabel}
          </span>
        )}
        <span className={`flex-1 text-base leading-snug ${yearLabel ? "" : "text-center"}`}>{title}</span>
      </div>
    </div>
  );
}
