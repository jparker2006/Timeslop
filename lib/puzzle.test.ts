import { describe, expect, it } from "vitest";
import events from "../data/events.json";
import { HistoricalEventSchema, type Headline } from "./types";
import { composePuzzle, correctOrderIds, TOTAL_SLOTS } from "./puzzle";

const pool = events.map((e) => HistoricalEventSchema.parse(e));

const fakeRecent = (id: string): Headline => ({
  id,
  title: `Recent story ${id}`,
  date: "2026-05-10",
  blurb: "headline blurb",
  source: "Stub",
  url: `https://example.com/${id}`,
});

const recentPool: Headline[] = [
  fakeRecent("r1"),
  fakeRecent("r2"),
  fakeRecent("r3"),
];

describe("composePuzzle", () => {
  it(`produces ${TOTAL_SLOTS} slots: 8 historical + 1 recent`, () => {
    const p = composePuzzle(pool, recentPool);
    expect(p.slots).toHaveLength(TOTAL_SLOTS);
    expect(p.slots.filter((s) => s.kind === "headline")).toHaveLength(1);
    expect(p.slots.filter((s) => s.kind === "historical")).toHaveLength(8);
  });

  it("never picks two events from the same year in one puzzle", () => {
    for (let i = 0; i < 20; i++) {
      const p = composePuzzle(pool, recentPool);
      const years = p.slots.map((s) => s.date.slice(0, 4));
      expect(new Set(years).size).toBe(years.length);
    }
  });

  it("returns a unique puzzleId per call", () => {
    const a = composePuzzle(pool, recentPool);
    const b = composePuzzle(pool, recentPool);
    expect(a.puzzleId).not.toEqual(b.puzzleId);
  });

  it("revealOrder contains every slot id exactly once", () => {
    const p = composePuzzle(pool, recentPool);
    expect(new Set(p.revealOrder)).toEqual(new Set(p.slots.map((s) => s.id)));
    expect(p.revealOrder).toHaveLength(p.slots.length);
  });

  it("honors excludeIds when pool has enough remaining events", () => {
    const first = composePuzzle(pool, recentPool);
    const exclude = new Set(first.slots.map((s) => s.id));
    const second = composePuzzle(pool, recentPool, exclude);
    const overlap = second.slots
      .filter((s) => s.kind === "historical")
      .filter((s) => exclude.has(s.id));
    expect(overlap).toHaveLength(0);
  });

  it("ignores excludeIds when filtering would leave fewer than 8 historical events", () => {
    const everyHistoricalId = new Set(pool.map((p) => p.id));
    const result = composePuzzle(pool, recentPool, everyHistoricalId);
    expect(result.slots.filter((s) => s.kind === "historical")).toHaveLength(8);
  });

  it("correctOrderIds returns ids sorted chronologically", () => {
    const p = composePuzzle(pool, recentPool);
    const ordered = correctOrderIds(p);
    const dates = ordered.map((id) => p.slots.find((s) => s.id === id)!.date);
    expect(dates).toEqual([...dates].sort());
  });
});
