import type { Exercise, LoggedSet, Prescription, SessionExercise, WorkoutSession } from "../types";
import { floorTo, loadForReps, roundTo } from "./strength";

/**
 * Progressive overload: conservative double progression with effort checks.
 *
 *   1. All working sets hit the top of the rep range at a manageable effort
 *      (RPE ≤ 8.5, or not reported) → add the smallest sensible increment.
 *   2. Top of range hit but effort was very high (RPE ≥ 9.5) → keep the weight.
 *   3. Inside the range → keep the weight and add reps.
 *   4. Below the range once → keep the weight. Twice in a row → reduce ~7.5%.
 *
 * Weight never goes up two sessions in a row unless the previous jump was
 * also completed cleanly, and the user can always override.
 */

export type ProgressionDecision = "start" | "increase" | "hold" | "add_reps" | "reduce" | "bodyweight";

export interface Recommendation {
  weight: number | null;
  repsMin: number;
  repsMax: number;
  decision: ProgressionDecision;
  reason: string;
  previous?: { weight: number; reps: number[]; date: string };
}

export interface ExerciseHistoryEntry {
  date: string;
  sets: LoggedSet[];
  prescription: Prescription;
}

/** Most-recent-first history for one exercise across finished sessions. */
export function exerciseHistory(sessions: WorkoutSession[], exerciseId: string, limit = 6): ExerciseHistoryEntry[] {
  const out: ExerciseHistoryEntry[] = [];
  const sorted = [...sessions].filter((s) => s.finishedAt).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  for (const s of sorted) {
    const ex = s.exercises.find((e: SessionExercise) => e.exerciseId === exerciseId && !e.skipped);
    if (!ex) continue;
    const done = ex.sets.filter((x) => x.done);
    if (!done.length) continue;
    out.push({ date: s.startedAt, sets: done, prescription: ex.prescription });
    if (out.length >= limit) break;
  }
  return out;
}

function workingWeight(sets: LoggedSet[]): number {
  // The weight used for most sets (ties → heaviest).
  const counts = new Map<number, number>();
  for (const s of sets) counts.set(s.weight, (counts.get(s.weight) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
}

function outcome(entry: ExerciseHistoryEntry, rx: Prescription) {
  const w = workingWeight(entry.sets);
  const working = entry.sets.filter((s) => s.weight === w);
  const reps = working.map((s) => s.reps);
  const allTop = working.length >= Math.min(rx.sets, entry.prescription.sets) && reps.every((r) => r >= rx.repsMax);
  const anyBelow = reps.some((r) => r < rx.repsMin);
  const rpes = working.map((s) => s.rpe).filter((x): x is number => typeof x === "number");
  const maxRpe = rpes.length ? Math.max(...rpes) : undefined;
  return { w, reps, allTop, anyBelow, maxRpe };
}

export function recommend(opts: {
  exercise: Exercise;
  prescription: Prescription;
  history: ExerciseHistoryEntry[];
  /** Estimated 1RM if known (from benchmarks/onboarding). */
  e1rm?: number | null;
  unitStep?: number;
}): Recommendation {
  const { exercise: ex, prescription: rx, history } = opts;
  const step = opts.unitStep ?? ex.increment;

  if (ex.loadType === "bodyweight" && ex.increment === 0) {
    const last = history[0];
    const best = last ? Math.max(...last.sets.map((s) => s.reps)) : null;
    return {
      weight: 0,
      repsMin: rx.repsMin,
      repsMax: rx.repsMax,
      decision: "bodyweight",
      reason: best !== null ? `Last time your best set was ${best} reps. Aim to match or beat it with clean form.` : "Bodyweight movement. Focus on controlled, full-range reps.",
      previous: last ? { weight: 0, reps: last.sets.map((s) => s.reps), date: last.date } : undefined,
    };
  }

  if (ex.loadType === "timed" && ex.pattern !== "carry") {
    return { weight: null, repsMin: rx.repsMin, repsMax: rx.repsMax, decision: "bodyweight", reason: "Timed work. Hold the quality for the whole interval." };
  }

  const last = history[0];
  if (!last) {
    if (opts.e1rm && opts.e1rm > 0) {
      const rir = Math.max(2, Math.round(10 - rx.rpe) + 1);
      const w = floorTo(loadForReps(opts.e1rm, rx.repsMax, rir), step);
      return {
        weight: Math.max(step, w),
        repsMin: rx.repsMin,
        repsMax: rx.repsMax,
        decision: "start",
        reason: `Based on your estimated max of ${Math.round(opts.e1rm)} kg, this should leave about ${rir} reps in reserve. A conservative start.`,
      };
    }
    return {
      weight: null,
      repsMin: rx.repsMin,
      repsMax: rx.repsMax,
      decision: "start",
      reason: "No history yet. Choose a weight you could lift for 2–3 more reps than prescribed. Your next session will be calibrated from it.",
    };
  }

  const o = outcome(last, rx);
  const previous = { weight: o.w, reps: o.reps, date: last.date };

  if (o.allTop && (o.maxRpe === undefined || o.maxRpe <= 8.5)) {
    const next = roundTo(o.w + step, step);
    return {
      weight: next,
      repsMin: rx.repsMin,
      repsMax: rx.repsMax,
      decision: "increase",
      previous,
      reason: `You completed all prescribed reps last session${o.maxRpe !== undefined ? ` at RPE ${o.maxRpe}` : ""}. Let's increase the weight slightly.`,
    };
  }
  if (o.allTop) {
    return {
      weight: o.w,
      repsMin: rx.repsMin,
      repsMax: rx.repsMax,
      decision: "hold",
      previous,
      reason: `You hit every rep, but it was close to your limit (RPE ${o.maxRpe}). Same weight today. When it feels smoother, it goes up.`,
    };
  }
  if (o.anyBelow) {
    const prev = history[1];
    const prevMissed = prev ? outcome(prev, rx).anyBelow && workingWeight(prev.sets) === o.w : false;
    if (prevMissed) {
      const reduced = Math.max(step, floorTo(o.w * 0.925, step));
      return {
        weight: reduced,
        repsMin: rx.repsMin,
        repsMax: rx.repsMax,
        decision: "reduce",
        previous,
        reason: `You've come up short of ${rx.repsMin} reps two sessions running at ${o.w} kg. A small reset to ${reduced} kg lets you rebuild momentum.`,
      };
    }
    return {
      weight: o.w,
      repsMin: rx.repsMin,
      repsMax: rx.repsMax,
      decision: "hold",
      previous,
      reason: `Some sets fell short of ${rx.repsMin} reps last time. Same weight today. Aim for at least ${rx.repsMin} on every set.`,
    };
  }
  return {
    weight: o.w,
    repsMin: rx.repsMin,
    repsMax: rx.repsMax,
    decision: "add_reps",
    previous,
    reason: `Same weight as last time. Try to add a rep to a set or two, working toward ${rx.repsMax} on every set.`,
  };
}

/** Apply a readiness-based adjustment on top of the progression decision. */
export function adjustForReadiness(rec: Recommendation, status: "ready" | "moderate" | "low", step: number): Recommendation {
  if (rec.weight === null || rec.weight === 0 || status === "ready") return rec;
  if (status === "moderate" && rec.decision === "increase" && rec.previous) {
    return { ...rec, weight: rec.previous.weight, decision: "hold", reason: `${rec.reason} Holding at ${rec.previous.weight} kg today because your recovery is reduced.` };
  }
  if (status === "low") {
    const w = Math.max(step, floorTo(rec.weight * 0.9, step));
    return { ...rec, weight: w, decision: "reduce", reason: `Recovery is low today, so the load is about 10% lighter (${w} kg). Keep every rep crisp.` };
  }
  return rec;
}
