import fs from "node:fs/promises";
import path from "node:path";
import type { HistoricalEvent } from "./types";
import { fetchOnThisDay } from "./onThisDay";
import { SEED_EVENTS } from "./seedEvents";

const CACHE_DIR = process.env.VERCEL
  ? "/tmp/timeslop-cache"
  : path.join(process.cwd(), ".timeslop-cache");
const CACHE_FILE = path.join(CACHE_DIR, "events-v4.json");
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SAMPLE_DATES = 30;
const MIN_POOL_SIZE = 100;

let memCache: { events: HistoricalEvent[]; loadedAt: number } | null = null;
let inFlight: Promise<HistoricalEvent[]> | null = null;

async function readDiskCache(): Promise<HistoricalEvent[] | null> {
  try {
    const stat = await fs.stat(CACHE_FILE);
    if (Date.now() - stat.mtimeMs > CACHE_TTL_MS) return null;
    const raw = await fs.readFile(CACHE_FILE, "utf8");
    const parsed = JSON.parse(raw) as HistoricalEvent[];
    if (!Array.isArray(parsed) || parsed.length < MIN_POOL_SIZE) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeDiskCache(events: HistoricalEvent[]): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(CACHE_FILE, JSON.stringify(events));
  } catch (err) {
    console.warn("[eventsCache] disk write failed:", err);
  }
}

function randomCalendarDates(n: number): Array<[number, number]> {
  const seen = new Set<string>();
  const out: Array<[number, number]> = [];
  while (out.length < n) {
    const month = 1 + Math.floor(Math.random() * 12);
    const day = 1 + Math.floor(Math.random() * 28);
    const key = `${month}-${day}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push([month, day]);
  }
  return out;
}

async function fetchFromOnThisDay(): Promise<HistoricalEvent[]> {
  const dates = randomCalendarDates(SAMPLE_DATES);
  const tasks: Array<Promise<HistoricalEvent[]>> = [];
  for (const [m, d] of dates) {
    tasks.push(fetchOnThisDay("selected", m, d));
    tasks.push(fetchOnThisDay("events", m, d));
  }
  const results = await Promise.allSettled(tasks);

  let failures = 0;
  let selectedCount = 0;
  const dedup = new Map<string, HistoricalEvent>();
  // Process selected first so the `selected: true` flag wins on duplicates.
  for (let i = 0; i < results.length; i += 2) {
    const r = results[i];
    if (r.status === "fulfilled") {
      for (const e of r.value) {
        if (!dedup.has(e.id)) {
          dedup.set(e.id, e);
          selectedCount += 1;
        }
      }
    } else {
      failures += 1;
    }
  }
  for (let i = 1; i < results.length; i += 2) {
    const r = results[i];
    if (r.status === "fulfilled") {
      for (const e of r.value) {
        if (!dedup.has(e.id)) dedup.set(e.id, e);
      }
    } else {
      failures += 1;
    }
  }

  if (failures > 0) {
    console.warn(`[eventsCache] ${failures}/${tasks.length} OnThisDay calls failed`);
  }
  console.log(
    `[eventsCache] ${dedup.size} unique events (${selectedCount} curated/selected)`,
  );
  return Array.from(dedup.values());
}

async function hydrate(): Promise<HistoricalEvent[]> {
  const disk = await readDiskCache();
  if (disk) {
    console.log(`[eventsCache] loaded ${disk.length} events from disk cache`);
    return disk;
  }
  try {
    const fresh = await fetchFromOnThisDay();
    if (fresh.length >= MIN_POOL_SIZE) {
      await writeDiskCache(fresh);
      return fresh;
    }
    console.warn(
      `[eventsCache] OnThisDay returned only ${fresh.length} events (< ${MIN_POOL_SIZE}); using seed`,
    );
    return SEED_EVENTS;
  } catch (err) {
    console.warn("[eventsCache] hydration failed; using seed:", err);
    return SEED_EVENTS;
  }
}

export async function loadHistoricalPool(): Promise<HistoricalEvent[]> {
  if (memCache && Date.now() - memCache.loadedAt < CACHE_TTL_MS) {
    return memCache.events;
  }
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const events = await hydrate();
      memCache = { events, loadedAt: Date.now() };
      return events;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export function clearPoolCache(): void {
  memCache = null;
}
