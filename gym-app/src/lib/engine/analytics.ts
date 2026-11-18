import type { BodyWeightEntry, Muscle, TestResult, WorkoutSession } from "../types";
import { findExercise, getExercise } from "../data/exercises";
import { estimate1RM } from "./strength";
import { testTrend } from "./performance";

/** Training analytics derived only from logged data. */

export interface Point {
  date: string;
  value: number;
}

export function finished(sessions: WorkoutSession[]): WorkoutSession[] {
  return sessions.filter((s) => s.finishedAt).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

/** Best estimated 1RM per session for an exercise. */
export function e1rmSeries(sessions: WorkoutSession[], exerciseId: string): Point[] {
  const out: Point[] = [];
  for (const s of finished(sessions)) {
    const ex = s.exercises.find((e) => e.exerciseId === exerciseId);
    if (!ex) continue;
    let best = 0;
    for (const set of ex.sets) if (set.done && set.weight > 0) best = Math.max(best, estimate1RM(set.weight, set.reps) ?? 0);
    if (best > 0) out.push({ date: s.startedAt, value: Math.round(best * 10) / 10 });
  }
  return out;
}

export function trackedExercises(sessions: WorkoutSession[]): string[] {
  const count = new Map<string, number>();
  for (const s of finished(sessions))
    for (const e of s.exercises) {
      const def = findExercise(e.exerciseId);
      if (!def || def.loadType === "timed" || def.loadType === "bodyweight" || e.sets.every((x) => !x.done || x.weight <= 0)) continue;
      count.set(e.exerciseId, (count.get(e.exerciseId) ?? 0) + (def.benchmark ? 3 : 1));
    }
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

export interface Change {
  exerciseId: string;
  from: number;
  to: number;
  pct: number;
  weeks: number;
}

/** Compare the best of the most recent 2 weeks to the best of the first 2 weeks in the window. */
export function strengthChange(sessions: WorkoutSession[], exerciseId: string, now = new Date(), weeks = 6): Change | null {
  const series = e1rmSeries(sessions, exerciseId).filter((p) => now.getTime() - new Date(p.date).getTime() <= weeks * 7 * 86400000);
  if (series.length < 3) return null;
  const t0 = new Date(series[0].date).getTime();
  const tN = new Date(series[series.length - 1].date).getTime();
  const spanWeeks = (tN - t0) / (7 * 86400000);
  if (spanWeeks < 2) return null;
  const early = series.filter((p) => new Date(p.date).getTime() - t0 <= 14 * 86400000);
  const late = series.filter((p) => tN - new Date(p.date).getTime() <= 14 * 86400000);
  const from = Math.max(...early.map((p) => p.value));
  const to = Math.max(...late.map((p) => p.value));
  return { exerciseId, from, to, pct: Math.round(((to - from) / from) * 1000) / 10, weeks: Math.round(spanWeeks) };
}

/** Sessions per ISO week for the last n weeks (oldest first). */
export function weeklyCounts(sessions: WorkoutSession[], now = new Date(), n = 8): { weekStart: string; count: number }[] {
  const monday = startOfWeek(now);
  const out: { weekStart: string; count: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const start = new Date(monday.getTime() - i * 7 * 86400000);
    const end = new Date(start.getTime() + 7 * 86400000);
    const count = finished(sessions).filter((s) => {
      const t = new Date(s.startedAt).getTime();
      return t >= start.getTime() && t < end.getTime();
    }).length;
    out.push({ weekStart: start.toISOString().slice(0, 10), count });
  }
  return out;
}

/** Consecutive weeks (ending last complete week or this week) meeting the target. */
export function consistencyStreak(sessions: WorkoutSession[], target: number, now = new Date()): number {
  const weeks = weeklyCounts(sessions, now, 52);
  const goal = Math.max(1, target - 1);
  let streak = 0;
  // This week counts if already met; otherwise start from last week.
  let i = weeks.length - 1;
  if (weeks[i].count < goal) i--;
  for (; i >= 0; i--) {
    if (weeks[i].count >= goal) streak++;
    else break;
  }
  return streak;
}

export function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - day);
  return x;
}

/** Hard sets per muscle in the last `days` days (primary = 1, secondary = 0.5). */
export function recentSetsByMuscle(sessions: WorkoutSession[], days = 7, now = new Date()): Partial<Record<Muscle, number>> {
  const since = now.getTime() - days * 86400000;
  const out: Partial<Record<Muscle, number>> = {};
  for (const s of finished(sessions)) {
    if (new Date(s.startedAt).getTime() < since) continue;
    for (const e of s.exercises) {
      const def = findExercise(e.exerciseId);
      if (!def || def.kind === "mobility") continue;
      const n = e.sets.filter((x) => x.done).length;
      for (const m of def.primary) out[m] = (out[m] ?? 0) + n;
      for (const m of def.secondary) out[m] = (out[m] ?? 0) + n * 0.5;
    }
  }
  return out;
}

/** Hours since each muscle was last trained as a primary mover. */
export function hoursSinceTrained(sessions: WorkoutSession[], now = new Date()): Partial<Record<Muscle, number>> {
  const out: Partial<Record<Muscle, number>> = {};
  for (const s of finished(sessions).reverse()) {
    const h = (now.getTime() - new Date(s.startedAt).getTime()) / 3600000;
    for (const e of s.exercises) {
      const def = findExercise(e.exerciseId);
      if (!def || !e.sets.some((x) => x.done)) continue;
      for (const m of def.primary) if (out[m] === undefined) out[m] = Math.round(h);
    }
  }
  return out;
}

export interface Milestone {
  id: string;
  date: string;
  title: string;
  detail: string;
  kind: "pr" | "round" | "consistency" | "test" | "start";
}

const ROUND_NUMBERS = [40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 250];

/** Personal records and meaningful firsts, detected from history. */
export function milestones(sessions: WorkoutSession[], tests: TestResult[], weights: BodyWeightEntry[], weeklyTarget: number, now = new Date()): Milestone[] {
  const out: Milestone[] = [];
  const bestE1rm = new Map<string, number>();
  const bestLoad = new Map<string, number>();
  for (const s of finished(sessions)) {
    for (const e of s.exercises) {
      const def = findExercise(e.exerciseId);
      if (!def || def.loadType === "timed" || def.loadType === "bodyweight") continue;
      const done = e.sets.filter((x) => x.done && x.weight > 0);
      if (!done.length) continue;
      const top = Math.max(...done.map((x) => estimate1RM(x.weight, x.reps) ?? 0));
      const heaviest = Math.max(...done.map((x) => x.weight));
      const prevE = bestE1rm.get(e.exerciseId);
      if (prevE !== undefined && top > prevE * 1.01 && def.benchmark)
        out.push({ id: `pr-${s.id}-${e.exerciseId}`, date: s.startedAt, title: `${def.name} PR`, detail: `New best estimated max: ${Math.round(top)} kg`, kind: "pr" });
      const prevL = bestLoad.get(e.exerciseId) ?? 0;
      if (def.loadType === "barbell")
        for (const r of ROUND_NUMBERS)
          if (heaviest >= r && prevL < r && r >= 60)
            out.push({ id: `round-${s.id}-${e.exerciseId}-${r}`, date: s.startedAt, title: `First ${r} kg ${def.name.toLowerCase()}`, detail: "A new round-number milestone.", kind: "round" });
      bestE1rm.set(e.exerciseId, Math.max(prevE ?? 0, top));
      bestLoad.set(e.exerciseId, Math.max(prevL, heaviest));
    }
  }
  const streak = consistencyStreak(sessions, weeklyTarget, now);
  for (const n of [4, 8, 10, 12, 16, 26, 52])
    if (streak >= n) out.push({ id: `streak-${n}`, date: now.toISOString(), title: `${n} consistent weeks`, detail: `${n} weeks in a row at or near your planned frequency.`, kind: "consistency" });
  const testIds = Array.from(new Set(tests.map((t) => t.test)));
  for (const t of testIds) {
    const tr = testTrend(tests, t);
    if (tr && tr.direction === "improved" && tr.best.id === tr.latest.id)
      out.push({ id: `test-${tr.latest.id}`, date: tr.latest.date, title: "New test personal best", detail: tr.sentence, kind: "test" });
  }
  const firstW = [...weights].sort((a, b) => a.date.localeCompare(b.date))[0];
  if (firstW) out.push({ id: "start", date: firstW.date, title: "Journey started", detail: `Starting weight ${firstW.kg} kg`, kind: "start" });
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Conservative projection: continues the recent weekly rate of e1RM change,
 * halved (gains slow down), with a ±range from the scatter. Clearly an estimate.
 */
export function forecast(series: Point[], weeksAhead = 6): { low: number; mid: number; high: number } | null {
  if (series.length < 5) return null;
  const t0 = new Date(series[0].date).getTime();
  const xs = series.map((p) => (new Date(p.date).getTime() - t0) / (7 * 86400000));
  const ys = series.map((p) => p.value);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (!den) return null;
  const slope = Math.max(0, num / den) * 0.5;
  const resid = Math.sqrt(ys.reduce((a, y, i) => a + (y - (my + (num / den) * (xs[i] - mx))) ** 2, 0) / ys.length);
  const last = ys[ys.length - 1];
  const mid = last + slope * weeksAhead;
  const spread = Math.max(resid * 1.5, last * 0.02);
  return { low: Math.round(Math.max(last - spread / 2, mid - spread)), mid: Math.round(mid), high: Math.round(mid + spread) };
}

export function sessionVolume(s: WorkoutSession): number {
  return s.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).reduce((b, x) => b + x.weight * x.reps, 0), 0);
}

export function sessionSummary(s: WorkoutSession, previous: WorkoutSession[]): { sets: number; volume: number; minutes: number; prs: string[] } {
  const sets = s.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0);
  const volume = Math.round(sessionVolume(s));
  const minutes = s.finishedAt ? Math.max(1, Math.round((new Date(s.finishedAt).getTime() - new Date(s.startedAt).getTime()) / 60000)) : 0;
  const prs: string[] = [];
  for (const e of s.exercises) {
    const def = getExercise(e.exerciseId);
    if (def.loadType === "timed") continue;
    const best = Math.max(0, ...e.sets.filter((x) => x.done && x.weight > 0).map((x) => estimate1RM(x.weight, x.reps) ?? 0));
    if (!best) continue;
    const prev = Math.max(0, ...previous.flatMap((p) => p.exercises.filter((pe) => pe.exerciseId === e.exerciseId).flatMap((pe) => pe.sets.filter((x) => x.done).map((x) => estimate1RM(x.weight, x.reps) ?? 0))));
    if (prev > 0 && best > prev * 1.005) prs.push(`${def.name}: new best (${Math.round(best)} kg est. max)`);
  }
  return { sets, volume, minutes, prs };
}
