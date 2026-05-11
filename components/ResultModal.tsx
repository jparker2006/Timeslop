"use client";

import { useState } from "react";
import { buildShareGrid, type SlotShareState } from "@/lib/scoring";

type Props = {
  slotStates: SlotShareState[];
  score: number;
  total: number;
  onClose: () => void;
  onPlayAgain: () => void;
  loadingNext: boolean;
};

export function ResultModal({
  slotStates,
  score,
  total,
  onClose,
  onPlayAgain,
  loadingNext,
}: Props) {
  const [copied, setCopied] = useState(false);
  const grid = buildShareGrid(slotStates);
  const isPerfect = score === total;

  async function share() {
    try {
      await navigator.clipboard.writeText(grid);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white dark:bg-zinc-900 shadow-xl p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-4xl font-semibold">
            {isPerfect ? "Perfect run!" : `Score: ${score}/${total}`}
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 text-3xl leading-none"
            aria-label="close"
          >
            ×
          </button>
        </div>

        <div className="mt-5 rounded-lg bg-zinc-100 dark:bg-zinc-800 p-4 text-center text-2xl tracking-widest font-mono whitespace-nowrap overflow-x-auto">
          {slotStates.map((s) => (s === "correct" ? "🟩" : "⬜")).join("")}
        </div>

        <button
          onClick={onPlayAgain}
          disabled={loadingNext}
          className="mt-4 w-full rounded-lg bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white py-4 text-xl font-medium hover:opacity-90 disabled:opacity-50"
        >
          {loadingNext ? "Loading…" : "Play again"}
        </button>
        <button
          onClick={share}
          className="mt-2 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 py-4 text-xl font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          {copied ? "Copied!" : "Share result"}
        </button>
      </div>
    </div>
  );
}
