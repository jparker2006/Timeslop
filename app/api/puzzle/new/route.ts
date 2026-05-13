import { NextResponse } from "next/server";
import { z } from "zod";
import { loadHistoricalPool } from "@/lib/eventsCache";
import { loadRecentPool } from "@/lib/recentCache";
import { composePuzzle } from "@/lib/puzzle";

export const runtime = "nodejs";

const Body = z.object({
  excludeIds: z.array(z.string()).optional(),
  difficulty: z.enum(["hard", "insane"]).optional(),
});

export async function POST(req: Request) {
  let json: unknown = null;
  try {
    json = await req.json();
  } catch {
    json = {};
  }
  const parsed = Body.safeParse(json ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const excludeIds = new Set(parsed.data.excludeIds ?? []);
  const difficulty = parsed.data.difficulty ?? "hard";
  const [pool, recent] = await Promise.all([
    loadHistoricalPool(),
    loadRecentPool(),
  ]);
  const puzzle = composePuzzle(pool, recent, excludeIds, difficulty);

  return NextResponse.json(puzzle, {
    headers: { "Cache-Control": "no-store" },
  });
}
