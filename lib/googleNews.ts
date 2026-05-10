import { createHash } from "node:crypto";
import type { Headline } from "./types";

const FEED_URL = "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en";
const UA = "Timeslop/1.0 (https://github.com/jakeparker/timeslop)";

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&nbsp;/g, " ");
}

function unwrapCdata(s: string): string {
  const m = s.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  return m ? m[1] : s;
}

function tag(item: string, name: string): string | null {
  const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i");
  const m = item.match(re);
  if (!m) return null;
  return decodeEntities(unwrapCdata(m[1]).trim());
}

function rfc822ToIsoDate(s: string): string | null {
  const ms = Date.parse(s);
  if (Number.isNaN(ms)) return null;
  const d = new Date(ms);
  const yyyy = d.getUTCFullYear().toString().padStart(4, "0");
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = d.getUTCDate().toString().padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function splitTitleAndSource(title: string): { title: string; source: string } {
  // Google News titles look like "Headline text - Source Name"
  const idx = title.lastIndexOf(" - ");
  if (idx === -1) return { title, source: "Google News" };
  return {
    title: title.slice(0, idx).trim(),
    source: title.slice(idx + 3).trim() || "Google News",
  };
}

function hashId(s: string): string {
  return createHash("sha1").update(s).digest("hex").slice(0, 16);
}

function withinLastNDays(iso: string, days: number): boolean {
  const ms = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(ms)) return false;
  return Date.now() - ms <= days * 86400000;
}

export async function fetchTopHeadlines(maxAgeDays = 3): Promise<Headline[]> {
  const res = await fetch(FEED_URL, {
    headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`google news rss returned ${res.status}`);
  }
  const xml = await res.text();
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];

  const out: Headline[] = [];
  for (const item of items) {
    const rawTitle = tag(item, "title");
    const link = tag(item, "link");
    const pubDate = tag(item, "pubDate");
    if (!rawTitle || !link || !pubDate) continue;

    const date = rfc822ToIsoDate(pubDate);
    if (!date || !withinLastNDays(date, maxAgeDays)) continue;

    const { title, source } = splitTitleAndSource(rawTitle);
    if (title.length < 8) continue;

    out.push({
      id: `gn-${hashId(link)}`,
      title,
      date,
      blurb: title,
      source,
      url: link,
    });
  }

  return out;
}
