"use client";

import { useEffect, useState } from "react";

export const RULES_SEEN_KEY = "timeslop:rules-seen:v1";

type StepKind = "welcome" | "drag" | "today" | "score";

const STEPS: Array<{ kind: StepKind; title: string; body: string }> = [
  {
    kind: "welcome",
    title: "Welcome to Timeslop",
    body: "Place historical events on a timeline — oldest at the top, newest at the bottom.",
  },
  {
    kind: "drag",
    title: "Drag each event",
    body: "One card at a time appears. Drag it into the spot you think it belongs in history.",
  },
  {
    kind: "today",
    title: "One is from today",
    body: "Mixed in with history is a real headline from the last 24 hours. Can you spot it?",
  },
  {
    kind: "score",
    title: "Eight rounds. Try to ace it.",
    body: "Wrong placements snap to the right spot — but they cost you. Perfect run? Share it. Then play again, endlessly.",
  },
];

export function Rules({ onDismiss }: { onDismiss: () => void }) {
  const [step, setStep] = useState(0);
  const total = STEPS.length;
  const isLast = step === total - 1;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onDismiss();
      if (e.key === "ArrowRight" && !isLast) setStep((s) => s + 1);
      if (e.key === "ArrowLeft" && step > 0) setStep((s) => s - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, isLast, onDismiss]);

  function next() {
    if (isLast) {
      try {
        localStorage.setItem(RULES_SEEN_KEY, "true");
      } catch {}
      onDismiss();
    } else {
      setStep((s) => s + 1);
    }
  }

  const current = STEPS[step];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 rules-backdrop-in"
      onClick={onDismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden rules-modal-in"
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-1 text-base text-zinc-500">
          <span className="tabular-nums">
            {step + 1} <span className="text-zinc-400">/ {total}</span>
          </span>
          <button
            onClick={onDismiss}
            className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            Skip
          </button>
        </div>

        <div key={step} className="rules-step-in">
          <div className="h-56 px-6 flex items-center justify-center">
            <Illustration kind={current.kind} />
          </div>

          <div className="px-7 pt-2">
            <h2 className="text-3xl font-semibold tracking-tight mb-3">{current.title}</h2>
            <p className="text-lg text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {current.body}
            </p>
          </div>
        </div>

        <div className="px-7 pt-7 pb-6 flex items-center justify-between gap-4">
          <div className="flex gap-2.5 items-center">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-2.5 w-2.5 rounded-full transition-colors ${
                  i === step
                    ? "bg-zinc-900 dark:bg-zinc-100 rules-dot-active"
                    : i < step
                      ? "bg-zinc-500 dark:bg-zinc-400"
                      : "bg-zinc-300 dark:bg-zinc-700"
                }`}
              />
            ))}
          </div>
          <button
            onClick={next}
            className="rounded-lg bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white px-6 py-3 text-lg font-medium hover:opacity-90"
          >
            {isLast ? "Let's play" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Illustration({ kind }: { kind: StepKind }) {
  if (kind === "welcome") {
    return (
      <div className="relative w-72 h-44">
        <div className="absolute inset-x-4 inset-y-2 rounded-xl border-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-lg rules-fan-1 flex items-center justify-center">
          <span className="text-base font-medium text-zinc-400">1066</span>
        </div>
        <div className="absolute inset-x-4 inset-y-2 rounded-xl border-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-lg rules-fan-2 flex items-center justify-center">
          <span className="text-base font-medium text-zinc-400">1969</span>
        </div>
        <div className="absolute inset-x-4 inset-y-2 rounded-xl border-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-lg rules-fan-3 flex items-center justify-center">
          <span className="text-2xl font-semibold tracking-tight">Timeslop</span>
        </div>
      </div>
    );
  }

  if (kind === "drag") {
    return (
      <div className="relative w-72 h-44">
        <div className="absolute top-0 inset-x-0 rounded-lg border-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 shadow-sm">
          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 tabular-nums">
            1066
          </span>
          <span className="ml-3 text-sm">Battle of Hastings</span>
        </div>
        <div className="absolute top-1/2 -translate-y-1/2 inset-x-0 h-12 rounded-md border-2 border-dashed border-zinc-300 dark:border-zinc-700" />
        <div className="absolute bottom-0 inset-x-0 rounded-lg border-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 shadow-sm">
          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 tabular-nums">
            2026
          </span>
          <span className="ml-3 text-sm">Today's headline</span>
        </div>
        <div className="absolute top-1/2 -translate-y-1/2 inset-x-0">
          <div className="rounded-lg border-2 border-blue-500 bg-blue-50 dark:bg-blue-950/40 px-3 py-2.5 shadow-md rules-drag-loop">
            <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
              Apollo 11 lands on the Moon
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (kind === "today") {
    return (
      <div className="relative w-72 h-44 flex items-center justify-center">
        <div className="absolute -top-1 left-2 right-2 rounded-lg border-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 shadow-sm opacity-60">
          <span className="text-sm">A long-ago event…</span>
        </div>
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 px-5 py-4 shadow-lg rules-pulse max-w-xs">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📰</span>
            <div>
              <div className="text-base font-semibold text-amber-900 dark:text-amber-100">
                A real news headline
              </div>
              <div className="text-sm text-amber-800/80 dark:text-amber-200/70">
                from the last 24 hours
              </div>
            </div>
          </div>
        </div>
        <div className="absolute -bottom-1 left-2 right-2 rounded-lg border-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 shadow-sm opacity-60">
          <span className="text-sm">Another moment in history…</span>
        </div>
      </div>
    );
  }

  // score
  const grid: Array<"correct" | "wrong"> = [
    "correct", "correct", "wrong", "correct",
    "correct", "correct", "correct", "wrong",
  ];
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-3xl font-mono whitespace-nowrap">
        {grid.map((s, i) => (
          <span
            key={i}
            className="rules-emoji-pop"
            style={{ animationDelay: `${i * 90}ms` }}
          >
            {s === "correct" ? "🟩" : "⬜"}
          </span>
        ))}
      </div>
      <div className="text-2xl font-semibold tracking-tight">
        6 / 8 correct
      </div>
    </div>
  );
}
