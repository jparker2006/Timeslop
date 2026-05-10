import type {
  Difficulty,
  Headline,
  HistoricalEvent,
  PuzzlePayload,
  RevealedSlot,
} from "./types";
import { maskDates } from "./mask";

export const HISTORICAL_PER_PUZZLE = 8;
export const TOTAL_SLOTS = HISTORICAL_PER_PUZZLE + 1;
const MIN_DISTINCT_ERAS = 3;
const SHUFFLE_RETRIES = 30;

// Easy: only editor-curated "selected" events from OnThisDay.
// Hard: everything in the pool, including the broader/niche events.
const DIFFICULTY_FILTERS: Record<Difficulty, (e: HistoricalEvent) => boolean> = {
  easy: (e) => e.selected === true,
  hard: () => true,
};

function filterByDifficulty(
  pool: HistoricalEvent[],
  difficulty: Difficulty,
): HistoricalEvent[] {
  const fn = DIFFICULTY_FILTERS[difficulty];
  const filtered = pool.filter(fn);
  return filtered.length >= HISTORICAL_PER_PUZZLE ? filtered : pool;
}

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function yearOf(iso: string): string {
  return iso.slice(0, 4);
}

function pickHistorical(pool: HistoricalEvent[]): HistoricalEvent[] {
  if (pool.length < HISTORICAL_PER_PUZZLE) {
    throw new Error(`historical pool too small (${pool.length} < ${HISTORICAL_PER_PUZZLE})`);
  }
  let lastAttempt: HistoricalEvent[] = [];
  for (let attempt = 0; attempt < SHUFFLE_RETRIES; attempt++) {
    const shuffled = shuffle(pool);
    const picked: HistoricalEvent[] = [];
    const usedYears = new Set<string>();
    for (const e of shuffled) {
      const y = yearOf(e.date);
      if (usedYears.has(y)) continue;
      picked.push(e);
      usedYears.add(y);
      if (picked.length === HISTORICAL_PER_PUZZLE) break;
    }
    if (picked.length === HISTORICAL_PER_PUZZLE) {
      lastAttempt = picked;
      const eras = new Set(picked.map((e) => e.era));
      if (eras.size >= MIN_DISTINCT_ERAS) return picked;
    }
  }
  if (lastAttempt.length === HISTORICAL_PER_PUZZLE) return lastAttempt;
  throw new Error("could not assemble historical picks with distinct years");
}

function pickRecent(
  recentPool: Headline[],
  forbiddenYears: Set<string>,
): Headline {
  if (recentPool.length === 0) {
    throw new Error("recent pool is empty");
  }
  const safe = recentPool.filter((r) => !forbiddenYears.has(yearOf(r.date)));
  const candidates = safe.length > 0 ? safe : recentPool;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function applyExcludes<T extends { id: string }>(
  pool: T[],
  excludeIds: Set<string>,
  minSize: number,
): T[] {
  const filtered = pool.filter((e) => !excludeIds.has(e.id));
  return filtered.length >= minSize ? filtered : pool;
}

export function composePuzzle(
  pool: HistoricalEvent[],
  recentPool: Headline[],
  excludeIds: Set<string> = new Set(),
  difficulty: Difficulty = "easy",
): PuzzlePayload {
  const filteredPool = filterByDifficulty(pool, difficulty);
  const usableHistorical = applyExcludes(filteredPool, excludeIds, HISTORICAL_PER_PUZZLE);
  const picked = pickHistorical(usableHistorical);
  const usedYears = new Set(picked.map((e) => yearOf(e.date)));

  const usableRecent = applyExcludes(recentPool, excludeIds, 1);
  const recent = pickRecent(usableRecent, usedYears);

  const historicalSlots: RevealedSlot[] = picked.map((e) => ({
    id: e.id,
    kind: "historical",
    title: maskDates(e.title),
    date: e.date,
    blurb: maskDates(e.blurb),
    url: e.wikipediaUrl,
    yearOnly: e.yearOnly ?? false,
  }));
  const recentSlot: RevealedSlot = {
    id: recent.id,
    kind: "headline",
    title: maskDates(recent.title),
    date: recent.date,
    blurb: maskDates(recent.blurb),
    url: recent.url,
    yearOnly: false,
    source: recent.source,
  };

  const allSlots = shuffle([...historicalSlots, recentSlot]);
  const revealOrder = allSlots.map((s) => s.id);

  return {
    puzzleId: typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    revealOrder,
    slots: allSlots,
  };
}

export function correctOrderIds(payload: PuzzlePayload): string[] {
  return payload.slots
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => s.id);
}
