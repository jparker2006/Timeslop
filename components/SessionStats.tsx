"use client";

export type Stats = {
  gamesPlayed: number;
  currentPerfectRun: number;
  bestPerfectRun: number;
};

export function SessionStats({ stats }: { stats: Stats }) {
  if (stats.gamesPlayed === 0) return null;
  return (
    <div className="text-base text-zinc-600 dark:text-zinc-400">
      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{stats.gamesPlayed}</span>{" "}
      {stats.gamesPlayed === 1 ? "game" : "games"}
      <span className="mx-1.5">·</span>
      best run{" "}
      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{stats.bestPerfectRun}</span>
    </div>
  );
}
