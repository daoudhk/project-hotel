import type { BenchmarkLift, Muscle, Sex, StartingLift, WorkoutSession } from "../types";
import { findExercise } from "../data/exercises";

/**
 * Strength benchmarking.
 *
 * 1RM estimation uses the Epley formula (1RM = w × (1 + reps / 30)), which is
 * well documented and reasonably accurate up to ~10 reps. Confidence drops as
 * reps rise and estimates are not produced beyond 15 reps.
 *
 * Levels compare an estimated 1RM to body weight using reference ratios in
 * line with widely published strength-standard tables (e.g. ExRx-style
 * bodyweight ratios). They describe training status, not population
 * percentiles: we do not have representative population data and never claim
 * a percentile.
 */

export const LEVELS = ["Beginner", "Novice", "Intermediate", "Advanced", "Elite"] as const;
export type Level = (typeof LEVELS)[number];

export type Confidence = "high" | "medium" | "low";

export function estimate1RM(weight: number, reps: number): number | null {
  if (reps <= 0 || weight <= 0) return null;
  if (reps === 1) return weight;
  if (reps > 15) return null;
  return weight * (1 + reps / 30);
}

export function repsConfidence(reps: number): Confidence {
  if (reps <= 5) return "high";
  if (reps <= 10) return "medium";
  return "low";
}

/** Load you could lift for `reps` with `rir` reps in reserve, from a 1RM. */
export function loadForReps(oneRm: number, reps: number, rir = 2): number {
  return oneRm / (1 + (reps + rir) / 30);
}

export function roundTo(value: number, step: number): number {
  if (step <= 0) return Math.round(value * 10) / 10;
  return Math.round(value / step) * step;
}

export function floorTo(value: number, step: number): number {
  if (step <= 0) return Math.floor(value * 10) / 10;
  return Math.floor(value / step + 1e-9) * step;
}

/**
 * Thresholds marking the START of Novice, Intermediate, Advanced and Elite.
 * Anything below the first threshold is Beginner.
 * Loaded lifts: estimated 1RM ÷ body weight. Bodyweight lifts: strict reps.
 */
type Thresholds = [number, number, number, number];

export const STANDARDS: Record<BenchmarkLift, { label: string; unit: "ratio" | "reps"; male: Thresholds; female: Thresholds }> = {
  back_squat: { label: "Back Squat", unit: "ratio", male: [0.75, 1.25, 1.75, 2.5], female: [0.5, 0.9, 1.3, 1.8] },
  bench_press: { label: "Bench Press", unit: "ratio", male: [0.6, 1.0, 1.5, 2.0], female: [0.35, 0.6, 0.85, 1.15] },
  deadlift: { label: "Deadlift", unit: "ratio", male: [1.0, 1.5, 2.0, 2.75], female: [0.75, 1.1, 1.6, 2.2] },
  overhead_press: { label: "Overhead Press", unit: "ratio", male: [0.4, 0.6, 0.85, 1.1], female: [0.25, 0.4, 0.55, 0.75] },
  barbell_row: { label: "Barbell Row", unit: "ratio", male: [0.5, 0.75, 1.1, 1.4], female: [0.35, 0.5, 0.75, 1.0] },
  pull_up: { label: "Pull-Up", unit: "reps", male: [1, 6, 13, 20], female: [1, 3, 8, 14] },
  push_up: { label: "Push-Up", unit: "reps", male: [10, 25, 40, 60], female: [3, 12, 25, 40] },
};

export const BENCHMARK_ORDER: BenchmarkLift[] = ["back_squat", "bench_press", "deadlift", "overhead_press", "barbell_row", "pull_up", "push_up"];

/**
 * Masters adjustment: thresholds ease by 1% per year after 40 (max 30%).
 * This mirrors the age coefficients used in masters lifting, simplified.
 */
export function ageFactor(age: number): number {
  if (age <= 40) return 1;
  return Math.max(0.7, 1 - (age - 40) * 0.01);
}

function thresholdsFor(lift: BenchmarkLift, sex: Sex, age: number): Thresholds {
  const s = STANDARDS[lift];
  const base: Thresholds =
    sex === "male" ? s.male : sex === "female" ? s.female : (s.male.map((m, i) => (m + s.female[i]) / 2) as Thresholds);
  const f = ageFactor(age);
  return base.map((t) => (s.unit === "reps" ? Math.max(1, Math.round(t * f)) : t * f)) as Thresholds;
}

export interface Classification {
  level: Level;
  levelIndex: number; // 0..4
  /** Continuous score: levelIndex + progress toward next level (0..1). */
  score: number;
  value: number;
  nextLevel: Level | null;
  /** Value needed (ratio or reps) for the next level. */
  nextThreshold: number | null;
}

export function classify(lift: BenchmarkLift, value: number, sex: Sex, age: number): Classification {
  const t = thresholdsFor(lift, sex, age);
  let idx = 0;
  for (let i = 0; i < t.length; i++) if (value >= t[i]) idx = i + 1;
  const lower = idx === 0 ? 0 : t[idx - 1];
  const upper = idx < t.length ? t[idx] : null;
  const progress = upper === null ? 1 : Math.min(1, Math.max(0, (value - lower) / (upper - lower)));
  return {
    level: LEVELS[idx],
    levelIndex: idx,
    score: idx + (idx === 4 ? 0 : progress),
    value,
    nextLevel: idx < 4 ? LEVELS[idx + 1] : null,
    nextThreshold: upper,
  };
}

export interface LiftBenchmark {
  lift: BenchmarkLift;
  label: string;
  /** Estimated 1RM in kg (loaded lifts) or best strict reps (bodyweight lifts). */
  best: number;
  bestSet: { weight: number; reps: number; date: string };
  confidence: Confidence;
  classification: Classification;
  /** Next practical target: kg for loaded lifts, reps for bodyweight lifts. */
  milestone: number;
  milestoneLabel: string;
  source: "logged" | "starting point";
}

/** Gather the best performance per benchmark lift within the window. */
export function computeBenchmarks(opts: {
  sessions: WorkoutSession[];
  startingLifts: StartingLift[];
  bodyweightKg: number;
  sex: Sex;
  age: number;
  now?: Date;
  windowDays?: number;
}): LiftBenchmark[] {
  const { sessions, startingLifts, bodyweightKg, sex, age } = opts;
  const now = opts.now ?? new Date();
  const windowMs = (opts.windowDays ?? 70) * 86400000;

  type Cand = { lift: BenchmarkLift; value: number; weight: number; reps: number; date: string; source: LiftBenchmark["source"] };
  const best = new Map<BenchmarkLift, Cand>();

  const consider = (c: Cand) => {
    const cur = best.get(c.lift);
    if (!cur || c.value > cur.value) best.set(c.lift, c);
  };

  for (const s of sessions) {
    if (!s.finishedAt) continue;
    if (now.getTime() - new Date(s.startedAt).getTime() > windowMs) continue;
    for (const ex of s.exercises) {
      const def = findExercise(ex.exerciseId);
      if (!def?.benchmark) continue;
      for (const set of ex.sets) {
        if (!set.done || set.reps <= 0) continue;
        const v = benchmarkValue(def.benchmark, set.weight, set.reps, bodyweightKg);
        if (v !== null) consider({ lift: def.benchmark, value: v, weight: set.weight, reps: set.reps, date: s.startedAt, source: "logged" });
      }
    }
  }
  for (const sl of startingLifts) {
    if (best.has(sl.lift)) continue; // logged data is more current
    const v = benchmarkValue(sl.lift, sl.weight, sl.reps, bodyweightKg);
    if (v !== null) consider({ lift: sl.lift, value: v, weight: sl.weight, reps: sl.reps, date: sl.date, source: "starting point" });
  }

  const out: LiftBenchmark[] = [];
  for (const lift of BENCHMARK_ORDER) {
    const c = best.get(lift);
    if (!c) continue;
    const std = STANDARDS[lift];
    const value = std.unit === "ratio" ? c.value / bodyweightKg : c.value;
    const cls = classify(lift, value, sex, age);
    const ms = milestone(lift, c.value, cls, bodyweightKg);
    out.push({
      lift,
      label: std.label,
      best: c.value,
      bestSet: { weight: c.weight, reps: c.reps, date: c.date },
      confidence: std.unit === "reps" ? "high" : repsConfidence(c.reps),
      classification: cls,
      milestone: ms,
      milestoneLabel: std.unit === "reps" ? `${ms} reps` : `${ms} kg estimated max`,
      source: c.source,
    });
  }
  return out;
}

/**
 * Value used for benchmarking: e1RM (kg) for loaded lifts. For pull-ups and
 * push-ups, strict reps; weighted pull-ups are converted to equivalent
 * bodyweight reps through the same Epley relationship.
 */
export function benchmarkValue(lift: BenchmarkLift, weight: number, reps: number, bodyweightKg: number): number | null {
  if (STANDARDS[lift].unit === "reps") {
    if (lift === "pull_up" && weight > 0) {
      const total = estimate1RM(bodyweightKg + weight, reps);
      if (!total) return null;
      return Math.round(30 * (total / bodyweightKg - 1));
    }
    return reps;
  }
  const e = estimate1RM(weight, reps);
  return e === null ? null : Math.round(e * 10) / 10;
}

/** A near-term, motivating target: ~5% above current, rounded to 5 kg (or +2 reps). */
export function milestone(lift: BenchmarkLift, value: number, cls: Classification, bodyweightKg: number): number {
  if (STANDARDS[lift].unit === "reps") {
    const next = Math.ceil(value) + 2;
    return cls.nextThreshold !== null && cls.nextThreshold > value ? Math.min(next, cls.nextThreshold) : next;
  }
  const step = Math.ceil((value * 1.05) / 5) * 5;
  if (cls.nextThreshold !== null) {
    const levelKg = Math.ceil((cls.nextThreshold * bodyweightKg) / 2.5) * 2.5;
    if (levelKg > value && levelKg <= step) return levelKg;
  }
  return step <= value ? step + 5 : step;
}

/** Which benchmark lifts inform which muscle group, and how strongly. */
export const MUSCLE_EVIDENCE: Record<Muscle, Partial<Record<BenchmarkLift, number>>> = {
  chest: { bench_press: 1, push_up: 0.6 },
  back: { barbell_row: 1, pull_up: 1, deadlift: 0.5 },
  shoulders: { overhead_press: 1, bench_press: 0.3, push_up: 0.2 },
  biceps: { pull_up: 0.8, barbell_row: 0.6 },
  triceps: { bench_press: 0.7, overhead_press: 0.7, push_up: 0.4 },
  forearms: { deadlift: 0.6, pull_up: 0.5 },
  core: { deadlift: 0.4, back_squat: 0.4, overhead_press: 0.3 },
  glutes: { back_squat: 0.8, deadlift: 0.9 },
  quads: { back_squat: 1 },
  hamstrings: { deadlift: 1 },
  calves: {},
};

export interface MuscleAssessment {
  muscle: Muscle;
  level: Level | null;
  score: number | null;
  confidence: Confidence | null;
  evidence: BenchmarkLift[];
}

export function assessMuscles(benchmarks: LiftBenchmark[]): MuscleAssessment[] {
  const byLift = new Map(benchmarks.map((b) => [b.lift, b]));
  return (Object.keys(MUSCLE_EVIDENCE) as Muscle[]).map((muscle) => {
    const sources = Object.entries(MUSCLE_EVIDENCE[muscle]) as [BenchmarkLift, number][];
    let wsum = 0;
    let ssum = 0;
    const evidence: BenchmarkLift[] = [];
    for (const [lift, w] of sources) {
      const b = byLift.get(lift);
      if (!b) continue;
      const cw = w * (b.confidence === "high" ? 1 : b.confidence === "medium" ? 0.8 : 0.5);
      wsum += cw;
      ssum += cw * b.classification.score;
      evidence.push(lift);
    }
    if (wsum === 0) return { muscle, level: null, score: null, confidence: null, evidence };
    const score = ssum / wsum;
    const confidence: Confidence = wsum >= 1.4 ? "high" : wsum >= 0.7 ? "medium" : "low";
    return { muscle, level: LEVELS[Math.min(4, Math.floor(score))], score, confidence, evidence };
  });
}

/** Weakest muscles relative to the athlete's own average (only with evidence). */
export function relativeWeaknesses(assessments: MuscleAssessment[]): MuscleAssessment[] {
  const scored = assessments.filter((a) => a.score !== null && a.confidence !== "low");
  if (scored.length < 3) return [];
  const avg = scored.reduce((s, a) => s + (a.score as number), 0) / scored.length;
  return scored.filter((a) => (a.score as number) < avg - 0.4).sort((a, b) => (a.score as number) - (b.score as number));
}
