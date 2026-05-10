import { Game } from "@/components/Game";
import { loadHistoricalPool } from "@/lib/eventsCache";
import { loadRecentPool } from "@/lib/recentCache";
import { composePuzzle } from "@/lib/puzzle";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [pool, recent] = await Promise.all([
    loadHistoricalPool(),
    loadRecentPool(),
  ]);
  const initialPuzzle = composePuzzle(pool, recent);

  return (
    <main className="flex flex-1 w-full justify-center bg-zinc-50 dark:bg-black">
      <Game initialPuzzle={initialPuzzle} />
    </main>
  );
}
