"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  MouseSensor,
  KeyboardSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { EventCard } from "./EventCard";
import { ResultModal } from "./ResultModal";
import { Rules, RULES_SEEN_KEY } from "./Rules";
import { SessionStats, type Stats } from "./SessionStats";
import { formatEventDate } from "@/lib/format";
import type { Difficulty, PuzzlePayload, RevealedSlot } from "@/lib/types";
import type { SlotShareState } from "@/lib/scoring";

type Props = { initialPuzzle: PuzzlePayload };
type Phase = "ready" | "pending" | "revealing" | "feedback" | "done";
type CardState = "neutral" | "correct" | "wrong" | "reveal" | "pending";

const FEEDBACK_HOLD_MS = 1500;
const FEEDBACK_FADE_MS = 400;
const FEEDBACK_TOTAL_MS = FEEDBACK_HOLD_MS + FEEDBACK_FADE_MS;
const FLIP_REVEAL_MS = 2200;

function correctIndex(date: string, placedDates: string[]): number {
  for (let i = 0; i < placedDates.length; i++) {
    if (date < placedDates[i]) return i;
  }
  return placedDates.length;
}

function pointerClientX(event: Event | null): number | null {
  if (!event) return null;
  if ("touches" in event) {
    const te = event as TouchEvent;
    const t = te.touches[0] ?? te.changedTouches[0] ?? te.targetTouches[0];
    return t ? t.clientX : null;
  }
  if ("clientX" in event) {
    return (event as MouseEvent).clientX;
  }
  return null;
}

function Gap({ id, active }: { id: string; active: boolean }) {
  const { isOver, setNodeRef } = useDroppable({ id, disabled: !active });
  return (
    <div
      ref={setNodeRef}
      aria-hidden
      className={
        active
          ? `h-12 rounded-md border-2 border-dashed ${
              isOver
                ? "border-blue-500 bg-blue-100/70 dark:bg-blue-950/40"
                : "border-zinc-300 dark:border-zinc-700"
            }`
          : "h-2"
      }
    />
  );
}

function DraggableSlot({
  slot,
  state,
  onTilt,
}: {
  slot: RevealedSlot;
  state: CardState;
  onTilt: (dir: "left" | "right") => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: "next" });
  const elRef = useRef<HTMLDivElement | null>(null);

  function handlePointerDown(clientX: number) {
    const el = elRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    onTilt(clientX < rect.left + rect.width / 2 ? "left" : "right");
  }

  return (
    <div
      ref={(node) => {
        elRef.current = node;
        setNodeRef(node);
      }}
      {...attributes}
      {...listeners}
      onPointerDownCapture={(e) => handlePointerDown(e.clientX)}
      onTouchStartCapture={(e) => {
        const t = e.touches[0] ?? e.changedTouches[0];
        if (t) handlePointerDown(t.clientX);
      }}
      onMouseDownCapture={(e) => handlePointerDown(e.clientX)}
      style={{ touchAction: "none", opacity: isDragging ? 0.35 : 1 }}
      className="cursor-grab active:cursor-grabbing"
    >
      <EventCard title={slot.title} kind={slot.kind} state={state} />
    </div>
  );
}

function FlipRevealCard({ slot, onDone }: { slot: RevealedSlot; onDone: () => void }) {
  const yearLabel = formatEventDate(slot.date, slot.yearOnly ?? false);
  const year = yearLabel.match(/(AD\s+)?\d+$/)?.[0] ?? yearLabel;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const id = setTimeout(() => onDoneRef.current(), FLIP_REVEAL_MS);
    return () => clearTimeout(id);
  }, []);

  return (
    <div style={{ perspective: 1200 }}>
      <div className="relative timeslop-flip-reveal">
        <div className="timeslop-flip-face">
          <EventCard title={slot.title} kind={slot.kind} state="pending" />
        </div>
        <div
          className="timeslop-flip-face timeslop-flip-back absolute inset-0 flex items-center justify-center rounded-lg border-2 border-blue-500 bg-blue-50 dark:bg-blue-950/40"
        >
          <span className="text-6xl font-bold tabular-nums text-blue-700 dark:text-blue-200">
            {year}
          </span>
        </div>
      </div>
    </div>
  );
}

export function Game({ initialPuzzle }: Props) {
  const [puzzle, setPuzzle] = useState<PuzzlePayload>(initialPuzzle);
  const [sessionUsedIds, setSessionUsedIds] = useState<Set<string>>(
    () => new Set(initialPuzzle.slots.map((s) => s.id)),
  );
  const [stats, setStats] = useState<Stats>({
    gamesPlayed: 0,
    currentPerfectRun: 0,
    bestPerfectRun: 0,
  });
  const [difficulty, setDifficulty] = useState<Difficulty>("hard");

  const slotsById = useMemo(() => {
    const m = new Map<string, RevealedSlot>();
    puzzle.slots.forEach((s) => m.set(s.id, s));
    return m;
  }, [puzzle.slots]);
  const order = puzzle.revealOrder ?? [];

  const [placed, setPlaced] = useState<RevealedSlot[]>(() => {
    const first = order.length > 0 ? slotsById.get(order[0]) : undefined;
    return first ? [first] : [];
  });
  const [nextIdx, setNextIdx] = useState(1);
  const [phase, setPhase] = useState<Phase>("ready");
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [feedbackForId, setFeedbackForId] = useState<string | null>(null);
  const [feedbackKind, setFeedbackKind] = useState<"correct" | "wrong" | null>(null);
  const [feedbackFading, setFeedbackFading] = useState(false);
  const [wrongSlotIds, setWrongSlotIds] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<SlotShareState[]>([]);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [dragTilt, setDragTilt] = useState<"left" | "right">("left");
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingNext, setLoadingNext] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const completionRecorded = useRef<string | null>(null);

  useEffect(() => {
    try {
      if (!localStorage.getItem(RULES_SEEN_KEY)) {
        setShowRules(true);
      }
    } catch {}
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const nextSlot: RevealedSlot | null =
    nextIdx < order.length ? slotsById.get(order[nextIdx]) ?? null : null;

  function confirmPlacement() {
    if (phase !== "pending" || pendingIndex === null || !nextSlot) return;
    setPhase("revealing");
  }

  function commitPlacement() {
    if (pendingIndex === null || !nextSlot) return;
    const userIndex = pendingIndex;
    const placedDates = placed.map((p) => p.date);
    const correct = correctIndex(nextSlot.date, placedDates);
    const wasCorrect = userIndex === correct;

    setPlaced((prev) => {
      const next = prev.slice();
      next.splice(correct, 0, nextSlot);
      return next;
    });
    setResults((prev) => [...prev, wasCorrect ? "correct" : "wrong"]);
    if (!wasCorrect) {
      setWrongSlotIds((prev) => {
        const n = new Set(prev);
        n.add(nextSlot.id);
        return n;
      });
    }
    setFeedbackForId(nextSlot.id);
    setFeedbackKind(wasCorrect ? "correct" : "wrong");
    setFeedbackFading(false);
    setPendingIndex(null);
    setPhase("feedback");
  }

  useEffect(() => {
    if (phase !== "feedback") return;
    const fade = setTimeout(() => setFeedbackFading(true), FEEDBACK_HOLD_MS);
    const advance = setTimeout(() => {
      setFeedbackForId(null);
      setFeedbackKind(null);
      setFeedbackFading(false);
      const advanced = nextIdx + 1;
      setNextIdx(advanced);
      if (advanced >= order.length) {
        setPhase("done");
        setModalOpen(true);
      } else {
        setPhase("ready");
      }
    }, FEEDBACK_TOTAL_MS);
    return () => {
      clearTimeout(fade);
      clearTimeout(advance);
    };
  }, [phase, nextIdx, order.length]);

  // Record stats once when a puzzle completes.
  useEffect(() => {
    if (phase !== "done") return;
    if (completionRecorded.current === puzzle.puzzleId) return;
    completionRecorded.current = puzzle.puzzleId;
    setStats((s) => {
      const wasPerfect = results.length > 0 && results.every((r) => r === "correct");
      const run = wasPerfect ? s.currentPerfectRun + 1 : 0;
      return {
        gamesPlayed: s.gamesPlayed + 1,
        currentPerfectRun: run,
        bestPerfectRun: Math.max(s.bestPerfectRun, run),
      };
    });
  }, [phase, puzzle.puzzleId, results]);

  function onDragStart(e: DragStartEvent) {
    setActiveDragId(String(e.active.id));
    const rect = e.active.rect.current.initial;
    const pointerX = pointerClientX(e.activatorEvent);
    if (rect && pointerX !== null) {
      setDragTilt(pointerX < rect.left + rect.width / 2 ? "left" : "right");
    }
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveDragId(null);
    if (!e.over) return;
    const overId = String(e.over.id);
    if (!overId.startsWith("gap-")) return;
    const renderedIdx = parseInt(overId.slice(4), 10);

    let logical: number;
    if (phase === "ready") {
      logical = renderedIdx;
    } else if (phase === "pending" && pendingIndex !== null) {
      logical = renderedIdx <= pendingIndex ? renderedIdx : renderedIdx - 1;
      if (logical === pendingIndex) return;
    } else {
      return;
    }

    setPendingIndex(logical);
    setPhase("pending");
  }

  async function loadPuzzle(forDifficulty: Difficulty) {
    if (loadingNext) return;
    setLoadingNext(true);
    setModalOpen(false);
    try {
      const res = await fetch("/api/puzzle/new", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          excludeIds: Array.from(sessionUsedIds),
          difficulty: forDifficulty,
        }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const next: PuzzlePayload = await res.json();

      setPuzzle(next);
      setSessionUsedIds((prev) => {
        const u = new Set(prev);
        next.slots.forEach((s) => u.add(s.id));
        return u;
      });

      const firstId = next.revealOrder[0];
      const first = next.slots.find((s) => s.id === firstId);
      setPlaced(first ? [first] : []);
      setNextIdx(1);
      setPhase("ready");
      setPendingIndex(null);
      setFeedbackForId(null);
      setFeedbackKind(null);
      setFeedbackFading(false);
      setWrongSlotIds(new Set());
      setResults([]);
      setActiveDragId(null);
    } catch (err) {
      console.error("load puzzle failed", err);
      setModalOpen(true);
    } finally {
      setLoadingNext(false);
    }
  }

  async function playAgain() {
    await loadPuzzle(difficulty);
  }

  async function changeDifficulty(d: Difficulty) {
    if (d === difficulty || loadingNext) return;
    setDifficulty(d);
    await loadPuzzle(d);
  }

  const canChangeDifficulty = nextIdx === 1 && phase === "ready";

  const totalRounds = order.length - 1;
  const score = results.filter((r) => r === "correct").length;
  const roundLabel =
    phase === "done"
      ? `${score}/${totalRounds}`
      : `${Math.min(nextIdx, totalRounds)}/${totalRounds}`;

  const showGaps =
    (phase === "ready" || phase === "pending") && activeDragId !== null;

  const isAdjacentToPending = (gapId: string) =>
    phase === "pending" &&
    pendingIndex !== null &&
    (gapId === `gap-${pendingIndex}` || gapId === `gap-${pendingIndex + 1}`);

  const gapActive = (gapId: string) => showGaps && !isAdjacentToPending(gapId);

  type Row =
    | { kind: "placed"; slot: RevealedSlot }
    | { kind: "pending"; slot: RevealedSlot }
    | { kind: "revealing"; slot: RevealedSlot };
  const rows: Row[] = (() => {
    const base: Row[] = placed.map((s) => ({ kind: "placed" as const, slot: s }));
    if ((phase === "pending" || phase === "revealing") && pendingIndex !== null && nextSlot) {
      const kind = phase === "revealing" ? "revealing" : "pending";
      base.splice(pendingIndex, 0, { kind, slot: nextSlot });
    }
    return base;
  })();

  return (
    <div className="mx-auto w-full max-w-md px-4 pt-4 pb-12">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">Timeslop</h1>
          <p className="text-lg text-zinc-500">order events on a timeline</p>
        </div>
        <div className="flex items-center gap-3">
          <SessionStats stats={stats} />
          <button
            onClick={() => setShowRules(true)}
            aria-label="how to play"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-300 dark:border-zinc-700 text-lg font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            ?
          </button>
        </div>
      </header>

      {canChangeDifficulty && (
        <div className="mb-5 grid grid-cols-2 gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 p-1">
          {(["hard", "insane"] as const).map((d) => (
            <button
              key={d}
              onClick={() => changeDifficulty(d)}
              disabled={loadingNext}
              className={`rounded-md py-3 text-lg font-medium capitalize transition-colors disabled:opacity-50 ${
                difficulty === d
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                  : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
              aria-pressed={difficulty === d}
            >
              {d}
            </button>
          ))}
        </div>
      )}

      <DndContext
        id="timeslop-board"
        sensors={sensors}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveDragId(null)}
      >
        <section className="sticky top-0 z-10 -mx-4 px-4 pb-3 pt-2 bg-zinc-50/95 dark:bg-black/95 backdrop-blur">
          <div className="text-base uppercase tracking-wide text-zinc-500 mb-2">
            Round {roundLabel}
            {phase === "ready" && nextSlot ? " — place this event" : ""}
            {phase === "pending" ? " — drag to reposition or confirm" : ""}
          </div>
          {phase === "ready" && nextSlot && (
            <div key={`next-${nextIdx}`} className="timeslop-card-enter">
              <DraggableSlot slot={nextSlot} state="neutral" onTilt={setDragTilt} />
            </div>
          )}
          {phase === "feedback" && feedbackKind && (
            <div
              style={{
                opacity: feedbackFading ? 0 : 1,
                transition: `opacity ${FEEDBACK_FADE_MS}ms ease-out`,
              }}
              className={`rounded-lg border-2 px-4 py-5 text-center text-xl font-medium ${
                feedbackKind === "correct"
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                  : "border-rose-400 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300"
              }`}
            >
              {feedbackKind === "correct"
                ? "Correct!"
                : "Not quite — moved to its actual spot."}
            </div>
          )}
          {phase === "done" && (
            <div className="rounded-lg border-2 border-zinc-300 dark:border-zinc-700 px-4 py-5 text-center text-xl">
              Done — {score}/{totalRounds} correct
            </div>
          )}
        </section>

        <p className="mt-4 mb-2 text-lg text-zinc-500">Timeline · oldest at top</p>

        <ol>
          <Gap key="gap-leading" id="gap-0" active={gapActive("gap-0")} />
          {rows.map((row, i) => {
            const slot = row.slot;
            const cardState: CardState =
              row.kind === "pending"
                ? "pending"
                : phase === "done" && wrongSlotIds.has(slot.id)
                  ? "wrong"
                  : feedbackForId === slot.id && feedbackKind
                    ? feedbackKind
                    : phase === "done"
                      ? "reveal"
                      : "neutral";
            const gapId = `gap-${i + 1}`;
            return (
              <Fragment key={`row-${row.kind}-${slot.id}`}>
                <li>
                  {row.kind === "pending" ? (
                    <div>
                      <DraggableSlot slot={slot} state="pending" onTilt={setDragTilt} />
                      <button
                        onClick={confirmPlacement}
                        className="mt-2 w-full rounded-lg bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white py-4 text-xl font-medium hover:opacity-90"
                      >
                        Confirm placement
                      </button>
                    </div>
                  ) : row.kind === "revealing" ? (
                    <FlipRevealCard slot={slot} onDone={commitPlacement} />
                  ) : (
                    <EventCard
                      title={slot.title}
                      kind={slot.kind}
                      date={slot.date}
                      yearOnly={slot.yearOnly}
                      state={cardState}
                    />
                  )}
                </li>
                <Gap id={gapId} active={gapActive(gapId)} />
              </Fragment>
            );
          })}
        </ol>

        <DragOverlay dropAnimation={null}>
          {activeDragId && nextSlot ? (
            <div
              className={`cursor-grabbing shadow-2xl ${
                dragTilt === "right" ? "rotate-[3deg]" : "rotate-[-3deg]"
              }`}
            >
              <EventCard
                title={nextSlot.title}
                kind={nextSlot.kind}
                state={phase === "pending" ? "pending" : "neutral"}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {phase === "done" && !modalOpen && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => setModalOpen(true)}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-5 py-4 text-xl font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            View result
          </button>
          <button
            onClick={playAgain}
            disabled={loadingNext}
            className="rounded-lg bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white px-6 py-4 text-xl font-medium disabled:opacity-50"
          >
            {loadingNext ? "Loading…" : "Play again"}
          </button>
        </div>
      )}

      {modalOpen && phase === "done" && (
        <ResultModal
          slotStates={results}
          score={score}
          total={totalRounds}
          onClose={() => setModalOpen(false)}
          onPlayAgain={playAgain}
          loadingNext={loadingNext}
        />
      )}

      {showRules && <Rules onDismiss={() => setShowRules(false)} />}
    </div>
  );
}
