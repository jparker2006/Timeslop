import fs from "node:fs/promises";
import path from "node:path";
import type { Headline } from "./types";
import { fetchTopHeadlines } from "./googleNews";

const CACHE_DIR = process.env.VERCEL
  ? "/tmp/timeslop-cache"
  : path.join(process.cwd(), ".timeslop-cache");
const CACHE_FILE = path.join(CACHE_DIR, "recent.json");
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const MIN_POOL_SIZE = 10;

const TODAY = new Date().toISOString().slice(0, 10);
const STUB_RECENT: Headline[] = [
  {
    id: "stub-recent-1",
    title: "A recent global event",
    date: TODAY,
    blurb: "Placeholder used when the live news feed is unreachable.",
    source: "Stub",
    url: "https://example.com/headline",
  },
];

let memCache: { items: Headline[]; loadedAt: number } | null = null;
let inFlight: Promise<Headline[]> | null = null;

async function readDiskCache(): Promise<Headline[] | null> {
  try {
    const stat = await fs.stat(CACHE_FILE);
    if (Date.now() - stat.mtimeMs > CACHE_TTL_MS) return null;
    const raw = await fs.readFile(CACHE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Headline[];
    if (!Array.isArray(parsed) || parsed.length < MIN_POOL_SIZE) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeDiskCache(items: Headline[]): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(CACHE_FILE, JSON.stringify(items));
  } catch (err) {
    console.warn("[recentCache] disk write failed:", err);
  }
}

async function hydrate(): Promise<Headline[]> {
  const disk = await readDiskCache();
  if (disk) {
    console.log(`[recentCache] loaded ${disk.length} headlines from disk cache`);
    return disk;
  }
  try {
    const fresh = await fetchTopHeadlines();
    if (fresh.length >= MIN_POOL_SIZE) {
      console.log(`[recentCache] fetched ${fresh.length} headlines from Google News`);
      await writeDiskCache(fresh);
      return fresh;
    }
    console.warn(
      `[recentCache] Google News returned only ${fresh.length} items (< ${MIN_POOL_SIZE}); using stub`,
    );
    return STUB_RECENT;
  } catch (err) {
    console.warn("[recentCache] hydration failed; using stub:", err);
    return STUB_RECENT;
  }
}

export async function loadRecentPool(): Promise<Headline[]> {
  if (memCache && Date.now() - memCache.loadedAt < CACHE_TTL_MS) {
    return memCache.items;
  }
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const items = await hydrate();
      memCache = { items, loadedAt: Date.now() };
      return items;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export function clearRecentCache(): void {
  memCache = null;
}
