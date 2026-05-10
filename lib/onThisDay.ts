import type { HistoricalEvent } from "./types";
import { yearToEra } from "./era";

const BASE = "https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/events";
const UA = "Timeslop/1.0 (https://github.com/jakeparker/timeslop; contact via repo)";

type RawPage = {
  title?: string;
  extract?: string;
  content_urls?: { desktop?: { page?: string } };
};

type RawEvent = {
  text?: string;
  year?: number;
  pages?: RawPage[];
};

type RawResponse = {
  events?: RawEvent[];
};

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max).replace(/\s+\S*$/, "");
  return `${cut}…`;
}

export async function fetchEventsForDate(
  month: number,
  day: number,
): Promise<HistoricalEvent[]> {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const res = await fetch(`${BASE}/${mm}/${dd}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`onthisday ${mm}/${dd} returned ${res.status}`);
  }
  const data = (await res.json()) as RawResponse;
  const events = data.events ?? [];
  const currentYear = new Date().getFullYear();
  const out: HistoricalEvent[] = [];

  for (const e of events) {
    if (typeof e.year !== "number" || !Number.isFinite(e.year)) continue;
    if (e.year < 1 || e.year > currentYear) continue;
    if (!e.text || e.text.trim().length < 8) continue;
    const page = e.pages?.[0];
    const wiki = page?.content_urls?.desktop?.page;
    if (!wiki) continue;

    const yyyy = String(e.year).padStart(4, "0");
    const date = `${yyyy}-${mm}-${dd}`;
    const titleSource = e.text.trim();
    const title = clip(titleSource, 140);
    const blurb = clip((page.extract ?? titleSource).trim(), 220);
    const id = `otd-${e.year}-${slug(titleSource)}`;

    out.push({
      id,
      title,
      date,
      yearOnly: false,
      blurb,
      wikipediaUrl: wiki,
      era: yearToEra(e.year),
    });
  }

  return out;
}
