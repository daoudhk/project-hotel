"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Plus, Repeat, SkipForward, Timer, X } from "lucide-react";
import { useApp, useHydrated } from "@/lib/store/store";
import { getExercise } from "@/lib/data/exercises";
import { alternatives } from "@/lib/engine/recovery";
import { exerciseHistory } from "@/lib/engine/progression";
import { displayStep, fmtClock, fmtDuration, fmtWeight, fromDisplayWeight, toDisplayWeight, weightUnit } from "@/lib/format";
import { Button, Pill, Ring, Segmented, Stepper, cx } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/Sheet";
import { useNow } from "@/components/train/useNow";
import type { SessionExercise } from "@/lib/types";

/** Set while we navigate away after finishing, so the empty-state redirect doesn't race it. */
const leaving = { current: false };

export default function WorkoutPage() {
  const hydrated = useHydrated();
  const router = useRouter();
  const s = useApp();
  const active = s.active;
  const [swapOpen, setSwapOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [cueOpen, setCueOpen] = useState(false);

  useEffect(() => {
    leaving.current = false;
  }, []);
  useEffect(() => {
    if (hydrated && !active && !leaving.current) router.replace("/today");
  }, [hydrated, active, router]);

  if (!hydrated || !active || !s.profile) return <div className="min-h-dvh" />;

  const units = s.profile.units;
  const idx = Math.min(s.activeIndex, active.exercises.length - 1);
  const cur = active.exercises[idx];
  const ex = getExercise(cur.exerciseId);
  const activeSet = cur.sets.findIndex((x) => !x.done);
  const allDone = activeSet === -1;
  const next = active.exercises[idx + 1];
  const totalSets = active.exercises.reduce((a, e) => a + (e.skipped ? 0 : e.sets.length), 0);
  const doneSets = active.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0);
  const timed = cur.prescription.workSec !== undefined;
  const bodyweight = ex.loadType === "bodyweight" || (ex.loadType === "timed" && ex.pattern !== "carry");
  const unloaded = bodyweight && ex.increment === 0;

  return (
    <div className="mx-auto flex min-h-dvh max-w-[560px] flex-col pt-[max(env(safe-area-inset-top),8px)]">
      {/* Top bar */}
      <header className="flex h-14 items-center gap-2 px-3">
        <button onClick={() => router.push("/today")} aria-label="Minimise workout" className="grid h-10 w-10 place-items-center rounded-full text-text-2 hover:bg-surface">
          <ChevronDown size={22} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-[14px] font-semibold">{active.title}</div>
          <Elapsed since={active.startedAt} />
        </div>
        <Button size="sm" variant="secondary" onClick={() => setFinishOpen(true)}>
          Finish
        </Button>
      </header>

      {/* Progress */}
      <div className="px-5">
        <div className="flex gap-1">
          {active.exercises.map((e, i) => {
            const d = e.sets.filter((x) => x.done).length;
            return (
              <button key={e.slotId + i} aria-label={`Go to ${getExercise(e.exerciseId).name}`} onClick={() => s.setActiveIndex(i)} className="h-6 flex-1 py-2.5">
                <div className={cx("h-1 overflow-hidden rounded-full", i === idx ? "bg-text/20" : "bg-surface-3")}>
                  <motion.div className={cx("h-full", e.skipped ? "bg-text-3" : "bg-accent")} animate={{ width: e.skipped ? "100%" : `${(d / Math.max(1, e.sets.length)) * 100}%` }} />
                </div>
              </button>
            );
          })}
        </div>
        <div className="tnum mt-1 flex justify-between text-[12px] text-text-3">
          <span>
            Exercise {idx + 1} of {active.exercises.length}
          </span>
          <span>
            {doneSets}/{totalSets} sets
          </span>
        </div>
      </div>

      {/* Exercise */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.main key={cur.slotId + cur.exerciseId} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="flex-1 px-5 pb-64 pt-5">
          <div className="flex items-center gap-2">
            <Pill tone={cur.role === "main" ? "accent" : "neutral"}>{cur.role === "main" ? "Main lift" : cur.role.charAt(0).toUpperCase() + cur.role.slice(1)}</Pill>
            {cur.substitutedFrom && <Pill>Swapped from {getExercise(cur.substitutedFrom).name}</Pill>}
            {cur.skipped && <Pill tone="caution">Skipped</Pill>}
          </div>
          <h1 className="text-title mt-2">{ex.name}</h1>
          <div className="tnum mt-1 text-[15px] text-text-2">
            {cur.prescription.sets} sets × {timed ? fmtDuration(cur.prescription.workSec!) : `${cur.prescription.repsMin}–${cur.prescription.repsMax} reps`} · rest {fmtDuration(cur.prescription.restSec)} · RPE {cur.prescription.rpe}
          </div>

          <button onClick={() => setCueOpen(!cueOpen)} className="mt-4 w-full rounded-2xl bg-surface p-4 text-left">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-micro text-text-3">{cur.recommendedWeight ? `Recommended · ${fmtWeight(cur.recommendedWeight, units)}` : "Coaching"}</div>
                <p className="mt-1 text-[14px] leading-snug text-text-2">{cur.recommendationReason}</p>
              </div>
              <motion.span animate={{ rotate: cueOpen ? 180 : 0 }} className="mt-1 shrink-0 text-text-3">
                <ChevronDown size={16} />
              </motion.span>
            </div>
            <AnimatePresence>
              {cueOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="mt-3 border-t border-line pt-3 text-[14px]">
                    <span className="font-medium">Cue: </span>
                    <span className="text-text-2">{ex.cue}</span>
                  </div>
                  <PreviousPerformance exerciseId={cur.exerciseId} />
                </motion.div>
              )}
            </AnimatePresence>
          </button>

          {/* Sets */}
          <ol className="mt-5 space-y-2">
            {cur.sets.map((set, si) => {
              const isActive = si === activeSet;
              return (
                <motion.li layout key={si} className={cx("rounded-2xl transition-colors", isActive ? "bg-surface p-4 ring-1 ring-line-strong" : "bg-transparent px-4 py-2.5")}>
                  <div className="flex items-center gap-3">
                    <span className={cx("tnum grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-semibold", set.done ? "bg-positive text-white" : isActive ? "bg-text text-bg" : "bg-surface-2 text-text-3")}>{set.done ? <Check size={14} strokeWidth={3} /> : si + 1}</span>
                    <div className={cx("tnum flex-1 text-[16px]", set.done ? "text-text-2" : isActive ? "font-semibold" : "text-text-3")}>
                      {timed ? (
                        <>
                          {!bodyweight && `${fmtWeight(set.weight, units)} · `}
                          {fmtDuration(set.seconds ?? cur.prescription.workSec!)}
                        </>
                      ) : (
                        <>
                          {bodyweight ? (set.weight > 0 ? `BW + ${fmtWeight(set.weight, units)}` : "Bodyweight") : fmtWeight(set.weight, units)} × {set.reps}
                          {set.rpe ? <span className="ml-2 text-[13px] font-normal text-text-3">RPE {set.rpe}</span> : null}
                        </>
                      )}
                    </div>
                    {!isActive && (
                      <button onClick={() => s.completeSet(idx, si)} className="text-[13px] font-medium text-text-3 hover:text-text" aria-label={set.done ? `Undo set ${si + 1}` : `Log set ${si + 1}`}>
                        {set.done ? "Undo" : "Log"}
                      </button>
                    )}
                  </div>
                  {isActive && !cur.skipped && <ActiveSetEditor exIndex={idx} setIndex={si} cur={cur} units={units} timed={timed} bodyweight={bodyweight} unloaded={unloaded} increment={ex.increment} />}
                </motion.li>
              );
            })}
          </ol>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => s.addSet(idx)}>
              Add set
            </Button>
            <Button size="sm" variant="secondary" icon={<Repeat size={14} />} onClick={() => setSwapOpen(true)}>
              Swap
            </Button>
            <Button size="sm" variant="secondary" icon={<SkipForward size={14} />} onClick={() => s.skipExercise(idx)}>
              {cur.skipped ? "Unskip" : "Skip"}
            </Button>
          </div>
        </motion.main>
      </AnimatePresence>

      {/* Bottom action area */}
      <div className="pb-safe pointer-events-none fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-bg via-bg to-transparent pt-6">
        <div className="pointer-events-auto mx-auto max-w-[560px] space-y-3 px-5 pb-4">
          <RestTimer />
          {allDone || cur.skipped ? (
            next ? (
              <Button size="lg" block onClick={() => s.setActiveIndex(idx + 1)} icon={<ChevronRight size={18} />}>
                Next: {getExercise(next.exerciseId).name}
              </Button>
            ) : (
              <Button size="lg" block onClick={() => setFinishOpen(true)}>
                Finish workout
              </Button>
            )
          ) : (
            <div className="flex gap-2">
              {idx > 0 && (
                <Button size="lg" variant="secondary" aria-label="Previous exercise" onClick={() => s.setActiveIndex(idx - 1)}>
                  <ChevronLeft size={20} />
                </Button>
              )}
              <Button size="lg" block onClick={() => s.completeSet(idx, activeSet)} icon={<Check size={18} />}>
                Log set {activeSet + 1}
              </Button>
              {next && (
                <Button size="lg" variant="secondary" aria-label="Next exercise" onClick={() => s.setActiveIndex(idx + 1)}>
                  <ChevronRight size={20} />
                </Button>
              )}
            </div>
          )}
          {next && !allDone && <div className="text-center text-[12px] text-text-3">Up next: {getExercise(next.exerciseId).name}</div>}
        </div>
      </div>

      <SwapSheet open={swapOpen} onClose={() => setSwapOpen(false)} exIndex={idx} exerciseId={cur.exerciseId} />
      <FinishSheet open={finishOpen} onClose={() => setFinishOpen(false)} remaining={totalSets - doneSets} />
    </div>
  );
}

function Elapsed({ since }: { since: string }) {
  const now = useNow(1000);
  return <div className="tnum text-[12px] text-text-3">{fmtClock((now - new Date(since).getTime()) / 1000)}</div>;
}

function PreviousPerformance({ exerciseId }: { exerciseId: string }) {
  const sessions = useApp((s) => s.sessions);
  const units = useApp((s) => s.profile!.units);
  const h = useMemo(() => exerciseHistory(sessions, exerciseId, 3), [sessions, exerciseId]);
  if (!h.length) return <p className="mt-2 text-[13px] text-text-3">No previous sessions for this exercise yet.</p>;
  return (
    <div className="mt-3 space-y-1">
      {h.map((e) => (
        <div key={e.date} className="tnum flex justify-between text-[13px] text-text-2">
          <span className="text-text-3">{new Date(e.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
          <span>
            {e.sets[0].weight > 0 ? fmtWeight(e.sets[0].weight, units) + " × " : ""}
            {e.sets.map((x) => x.reps).join(", ")}
          </span>
        </div>
      ))}
    </div>
  );
}

function ActiveSetEditor({ exIndex, setIndex, cur, units, timed, bodyweight, unloaded, increment }: { exIndex: number; setIndex: number; cur: SessionExercise; units: "metric" | "imperial"; timed: boolean; bodyweight: boolean; unloaded: boolean; increment: number }) {
  const update = useApp((s) => s.updateSet);
  const set = cur.sets[setIndex];
  const step = displayStep(increment, units);
  return (
    <div className="mt-4 space-y-4">
      <div className={cx("grid gap-2", unloaded || (timed && bodyweight) ? "grid-cols-1" : "grid-cols-2")}>
        {!unloaded && !(timed && bodyweight) && (
          <Stepper
            label={bodyweight ? `Added ${weightUnit(units)}` : weightUnit(units)}
            value={toDisplayWeight(set.weight, units)}
            step={step}
            min={0}
            onChange={(v) => update(exIndex, setIndex, { weight: fromDisplayWeight(v, units) })}
          />
        )}
        {timed ? <TimedControl seconds={set.seconds ?? cur.prescription.workSec!} onDone={() => useApp.getState().completeSet(exIndex, setIndex)} /> : <Stepper label="Reps" value={set.reps} step={1} min={0} max={100} onChange={(v) => update(exIndex, setIndex, { reps: Math.round(v) })} />}
      </div>
      {!timed && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-caption text-text-3">Effort (optional)</span>
          <Segmented
            size="sm"
            className="w-[220px]"
            options={[
              { value: 0, label: "–" },
              { value: 7, label: "7" },
              { value: 8, label: "8" },
              { value: 9, label: "9" },
              { value: 10, label: "10" },
            ]}
            value={set.rpe ?? 0}
            onChange={(v) => update(exIndex, setIndex, { rpe: v || undefined })}
          />
        </div>
      )}
    </div>
  );
}

function TimedControl({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const now = useNow(250);
  const left = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : seconds;
  useEffect(() => {
    if (endsAt && now >= endsAt) {
      setEndsAt(null);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(200);
      onDone();
    }
  }, [now, endsAt, onDone]);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-micro text-text-3">Work</span>
      <button onClick={() => setEndsAt(endsAt ? null : Date.now() + seconds * 1000)} className="flex items-center gap-2">
        <Ring value={endsAt ? 1 - left / seconds : 0} size={48} stroke={4}>
          <Timer size={16} />
        </Ring>
        <span className="tnum text-[28px] font-semibold">{fmtClock(left)}</span>
      </button>
      <span className="text-[12px] text-text-3">{endsAt ? "Tap to stop" : "Tap to start"}</span>
    </div>
  );
}

function RestTimer() {
  const restEndsAt = useApp((s) => s.restEndsAt);
  const clear = useApp((s) => s.clearRest);
  const startRest = useApp((s) => s.startRest);
  const now = useNow(250);
  const [total, setTotal] = useState(90);
  useEffect(() => {
    if (restEndsAt) setTotal(Math.max(1, Math.round((restEndsAt - Date.now()) / 1000)));
  }, [restEndsAt]);
  const left = restEndsAt ? Math.max(0, Math.ceil((restEndsAt - now) / 1000)) : 0;
  useEffect(() => {
    if (restEndsAt && left === 0) {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.([120, 80, 120]);
      const t = setTimeout(clear, 1500);
      return () => clearTimeout(t);
    }
  }, [left, restEndsAt, clear]);
  return (
    <AnimatePresence>
      {restEndsAt && (
        <motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }} className="flex items-center gap-3 rounded-2xl bg-text p-3 pr-2 text-bg" role="timer" aria-live="polite">
          <Ring value={left / total} size={44} stroke={4} tone={left === 0 ? "positive" : "accent"} track={false}>
            <Timer size={15} />
          </Ring>
          <div className="flex-1">
            <div className="text-[12px] opacity-70">{left === 0 ? "Rest complete" : "Rest"}</div>
            <div className="tnum text-[22px] font-semibold leading-tight">{fmtClock(left)}</div>
          </div>
          <button onClick={() => startRest(left + 30)} className="h-9 rounded-xl px-3 text-[13px] font-medium opacity-80 hover:opacity-100">
            +30s
          </button>
          <button onClick={clear} aria-label="Skip rest" className="grid h-9 w-9 place-items-center rounded-xl opacity-80 hover:opacity-100">
            <X size={18} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SwapSheet({ open, onClose, exIndex, exerciseId }: { open: boolean; onClose: () => void; exIndex: number; exerciseId: string }) {
  const profile = useApp((s) => s.profile!);
  const swap = useApp((s) => s.swapExercise);
  const alts = useMemo(() => alternatives(exerciseId, profile.equipment, profile.limitations, 6), [exerciseId, profile]);
  return (
    <Sheet open={open} onClose={onClose} title={`Swap ${getExercise(exerciseId).name}`}>
      <p className="mb-3 text-body text-text-2">Alternatives that train the same muscles with your equipment.</p>
      <div className="space-y-2">
        {alts.map((id) => {
          const e = getExercise(id);
          return (
            <button
              key={id}
              onClick={() => {
                swap(exIndex, id);
                onClose();
              }}
              className="flex w-full items-center justify-between gap-3 rounded-2xl bg-surface-2 p-4 text-left hover:bg-surface-3"
            >
              <div>
                <div className="text-[15px] font-medium">{e.name}</div>
                <div className="text-caption capitalize text-text-3">
                  {e.primary.join(", ")} · {e.equipment.filter((x) => x !== "bodyweight").join(", ") || "no equipment"}
                </div>
              </div>
              <ChevronRight size={18} className="text-text-3" />
            </button>
          );
        })}
        {!alts.length && <p className="text-body text-text-3">No suitable alternatives with your equipment. You can skip this one.</p>}
      </div>
    </Sheet>
  );
}

function FinishSheet({ open, onClose, remaining }: { open: boolean; onClose: () => void; remaining: number }) {
  const router = useRouter();
  const finish = useApp((s) => s.finishWorkout);
  const discard = useApp((s) => s.discardWorkout);
  const [rpe, setRpe] = useState(7);
  return (
    <Sheet open={open} onClose={onClose} title="Finish workout">
      <div className="space-y-5">
        {remaining > 0 && <p className="rounded-xl bg-caution-soft p-3 text-[14px] text-caution">{remaining} set{remaining === 1 ? "" : "s"} not logged. Only completed sets are saved.</p>}
        <div>
          <div className="mb-1 text-headline">How hard was it overall?</div>
          <p className="mb-3 text-caption text-text-3">1 is very easy, 10 is maximal. This helps plan your recovery.</p>
          <div className="rounded-2xl bg-surface-2 py-4">
            <Stepper label="Session effort" value={rpe} step={1} min={1} max={10} onChange={(v) => setRpe(Math.round(v))} size="md" />
          </div>
        </div>
        <Button
          size="lg"
          block
          onClick={() => {
            leaving.current = true;
            router.replace("/workout/summary");
            finish(rpe);
          }}
        >
          Save workout
        </Button>
        <Button
          size="md"
          block
          variant="plain"
          onClick={() => {
            leaving.current = true;
            router.replace("/today");
            discard();
          }}
        >
          Discard without saving
        </Button>
      </div>
    </Sheet>
  );
}
