import type { CheckIn, Equipment, Limitation, Muscle, PlanDay, PlanSlot, SorenessLevel, WorkoutSession } from "../types";
import { LOWER_MUSCLES, UPPER_MUSCLES } from "../types";
import { EXERCISES, getExercise, isAvailable } from "../data/exercises";

/**
 * Recovery logic. Soreness and sleep are self-reported and imperfect signals,
 * so readiness is expressed as one of three plain states with the reasons
 * behind it, never as a precise physiological score.
 */

export type ReadinessStatus = "ready" | "moderate" | "low";

export interface Readiness {
  status: ReadinessStatus;
  headline: string;
  factors: { label: string; effect: "positive" | "neutral" | "negative"; source: "self-reported" | "training log" }[];
  painWarning?: string;
}

export function hardSessionsInDays(sessions: WorkoutSession[], days: number, now = new Date()): number {
  const since = now.getTime() - days * 86400000;
  return sessions.filter((s) => s.finishedAt && new Date(s.startedAt).getTime() >= since && (s.sessionRpe ?? 7) >= 7).length;
}

export function assessReadiness(checkIn: CheckIn | undefined, sessions: WorkoutSession[], now = new Date()): Readiness {
  const factors: Readiness["factors"] = [];
  let points = 0;

  if (checkIn?.sleepHours !== undefined) {
    const h = checkIn.sleepHours;
    if (h < 6) {
      points -= 2;
      factors.push({ label: `${h} h sleep, below what most athletes need`, effect: "negative", source: "self-reported" });
    } else if (h < 7) {
      points -= 1;
      factors.push({ label: `${h} h sleep, a little short`, effect: "negative", source: "self-reported" });
    } else factors.push({ label: `${h} h sleep`, effect: "positive", source: "self-reported" });
  }
  if (checkIn?.sleepQuality === 1) {
    points -= 1;
    factors.push({ label: "Poor sleep quality", effect: "negative", source: "self-reported" });
  }
  if (checkIn?.energy !== undefined) {
    if (checkIn.energy <= 2) {
      points -= checkIn.energy === 1 ? 2 : 1;
      factors.push({ label: "Low energy", effect: "negative", source: "self-reported" });
    } else if (checkIn.energy >= 4) factors.push({ label: "Good energy", effect: "positive", source: "self-reported" });
  }
  const sore = Object.values(checkIn?.soreness ?? {}) as SorenessLevel[];
  const severe = sore.filter((s) => s === 3).length;
  const moderate = sore.filter((s) => s === 2).length;
  if (severe) {
    points -= 1;
    factors.push({ label: `Severe soreness in ${severe} area${severe > 1 ? "s" : ""}`, effect: "negative", source: "self-reported" });
  } else if (moderate >= 3) {
    points -= 1;
    factors.push({ label: "Moderate soreness in several areas", effect: "negative", source: "self-reported" });
  }
  const hard = hardSessionsInDays(sessions, 4, now);
  if (hard >= 3) {
    points -= 1;
    factors.push({ label: `${hard} demanding sessions in the last 4 days`, effect: "negative", source: "training log" });
  }

  let painWarning: string | undefined;
  if (checkIn?.pain) {
    const { severity, persistent, area } = checkIn.pain;
    points -= severity === "sharp" ? 2 : 1;
    factors.push({ label: `Pain reported: ${area}`, effect: "negative", source: "self-reported" });
    painWarning =
      severity === "sharp" || persistent
        ? `Sharp or persistent pain (${area}) isn't normal training soreness. Avoid loading that area, and get it checked by a physiotherapist or doctor before training it again.`
        : `Pain is different from muscle soreness. Avoid movements that reproduce it. If it sharpens or lasts more than a few days, have it assessed.`;
  }

  const status: ReadinessStatus = points >= -1 ? "ready" : points >= -3 ? "moderate" : "low";
  const headline =
    status === "ready"
      ? factors.length
        ? "You're ready to train."
        : "No check-in yet. Planning as normal."
      : status === "moderate"
        ? "Recovery is reduced today. We'll keep the intensity in check."
        : "Your body needs a lighter day.";
  return { status, headline, factors, painWarning };
}

export interface AdaptedWorkout {
  day: PlanDay;
  changes: string[];
  swappedFromDayId?: string;
}

function soreOf(ci: CheckIn | undefined, m: Muscle): SorenessLevel {
  return (ci?.soreness?.[m] ?? 0) as SorenessLevel;
}

function regionLoad(ci: CheckIn | undefined, muscles: Muscle[]): number {
  return muscles.reduce((a, m) => a + soreOf(ci, m), 0);
}

function dayMuscles(day: PlanDay): Muscle[] {
  return Array.from(new Set(day.slots.filter((s) => s.role !== "mobility").flatMap((s) => getExercise(s.exerciseId).primary)));
}

/** A day is blocked if its main work targets severely sore muscles. */
function dayBlocked(day: PlanDay, ci: CheckIn | undefined): Muscle[] {
  const mains = day.slots.filter((s) => s.role === "main" || s.role === "power");
  const hit = new Set<Muscle>();
  for (const s of mains) for (const m of getExercise(s.exerciseId).primary) if (soreOf(ci, m) === 3) hit.add(m);
  return [...hit];
}

export function recoveryDay(weekday: number, equipment: Equipment[]): PlanDay {
  const pick = (ids: string[]) => ids.filter((id) => isAvailable(getExercise(id), equipment));
  const cardio = pick(["zone2_bike", "brisk_walk"])[0] ?? "brisk_walk";
  const ids = [cardio, "hip_flow", "thoracic_rotation", "worlds_greatest", "dead_bug"];
  const slots: PlanSlot[] = ids.map((id, i) => ({
    id: `recovery-${i}`,
    role: i === 0 ? "conditioning" : id === "dead_bug" ? "core" : "mobility",
    exerciseId: id,
    prescription:
      i === 0
        ? { sets: 1, repsMin: 1, repsMax: 1, rpe: 4, restSec: 0, workSec: 20 * 60 }
        : id === "dead_bug"
          ? { sets: 2, repsMin: 8, repsMax: 10, rpe: 5, restSec: 45 }
          : { sets: 2, repsMin: 1, repsMax: 1, rpe: 3, restSec: 15, workSec: 60 },
  }));
  return {
    id: "recovery",
    weekday,
    title: "Recovery · Move & Restore",
    emphasis: "recovery",
    summary: "Easy aerobic work and mobility to help you feel better tomorrow.",
    slots,
    estMinutes: 35,
  };
}

/** Find a sensible substitute that doesn't load the excluded muscles. */
export function substitute(slot: PlanSlot, opts: { equipment: Equipment[]; limitations: Limitation[]; excludeMuscles?: Muscle[]; excludeIds?: string[] }): string | null {
  const cur = getExercise(slot.exerciseId);
  const lim = new Set(opts.limitations);
  const exM = new Set(opts.excludeMuscles ?? []);
  const exI = new Set([cur.id, ...(opts.excludeIds ?? [])]);
  const pool = EXERCISES.filter(
    (e) =>
      !exI.has(e.id) &&
      isAvailable(e, opts.equipment) &&
      !e.stresses.some((s) => lim.has(s)) &&
      !e.primary.some((m) => exM.has(m)),
  );
  const score = (e: (typeof EXERCISES)[number]) =>
    (e.pattern === cur.pattern ? 5 : 0) +
    e.primary.filter((m) => cur.primary.includes(m)).length * 2 +
    (e.kind === cur.kind ? 1 : 0) +
    e.qualities.filter((q) => cur.qualities.includes(q)).length * 0.5 -
    Math.abs(e.fatigue - cur.fatigue) * 0.3;
  const best = pool.map((e) => ({ e, s: score(e) })).sort((a, b) => b.s - a.s || a.e.id.localeCompare(b.e.id))[0];
  return best && best.s >= 2 ? best.e.id : null;
}

/** Alternatives list for the "Swap exercise" sheet. */
export function alternatives(exerciseId: string, equipment: Equipment[], limitations: Limitation[], n = 5): string[] {
  const cur = getExercise(exerciseId);
  const lim = new Set(limitations);
  return EXERCISES.filter((e) => e.id !== cur.id && isAvailable(e, equipment) && !e.stresses.some((s) => lim.has(s)))
    .map((e) => ({
      e,
      s:
        (e.pattern === cur.pattern ? 5 : 0) +
        e.primary.filter((m) => cur.primary.includes(m)).length * 2 +
        (e.kind === cur.kind ? 1 : 0),
    }))
    .filter((x) => x.s >= 3)
    .sort((a, b) => b.s - a.s || a.e.name.localeCompare(b.e.name))
    .slice(0, n)
    .map((x) => x.e.id);
}

/**
 * Adapt today's planned day to the check-in (Flow E).
 *  - Severe soreness in the muscles a day is built around → swap to another
 *    plan day that avoids them, or to a recovery session.
 *  - Remaining slots that hit severely sore muscles are substituted.
 *  - Moderate soreness → one fewer set on that slot.
 *  - Reduced readiness → one fewer set on main/secondary lifts and an RPE cap.
 *  - Low readiness → recovery session suggested.
 */
export function adaptDay(opts: {
  day: PlanDay;
  allDays: PlanDay[];
  checkIn?: CheckIn;
  readiness: Readiness;
  equipment: Equipment[];
  limitations: Limitation[];
  forceTrain?: boolean;
}): AdaptedWorkout {
  const { checkIn: ci, readiness, equipment, limitations } = opts;
  const changes: string[] = [];
  let day = opts.day;
  let swappedFromDayId: string | undefined;

  if (readiness.status === "low" && !opts.forceTrain) {
    return {
      day: recoveryDay(day.weekday, equipment),
      changes: [
        `${readiness.factors.filter((f) => f.effect === "negative").map((f) => f.label).join(", ") || "Your check-in"}: today becomes a recovery session instead of ${day.title}.`,
        "Easy movement and mobility support recovery better than a hard session would right now.",
      ],
      swappedFromDayId: day.id,
    };
  }

  const blocked = dayBlocked(day, ci);
  if (blocked.length) {
    const lowerSore = regionLoad(ci, LOWER_MUSCLES);
    const upperSore = regionLoad(ci, UPPER_MUSCLES);
    const alt = opts.allDays
      .filter((d) => d.id !== day.id && d.emphasis !== "recovery" && dayBlocked(d, ci).length === 0)
      .map((d) => ({ d, load: dayMuscles(d).reduce((a, m) => a + soreOf(ci, m), 0) }))
      .sort((a, b) => a.load - b.load)[0];
    const what = blocked.length > 2 ? (lowerSore > upperSore ? "legs" : "upper body") : blocked.join(" and ");
    if (alt) {
      swappedFromDayId = day.id;
      changes.push(`Your ${what} ${blocked.length > 1 || what === "legs" ? "are" : "is"} still very sore, so today's ${day.title} is swapped for ${alt.d.title}.`);
      day = { ...alt.d, weekday: day.weekday };
    } else {
      return {
        day: recoveryDay(day.weekday, equipment),
        changes: [`Your ${what} ${blocked.length > 1 ? "are" : "is"} too sore for any planned session today, so we've switched to recovery work.`],
        swappedFromDayId: day.id,
      };
    }
  }

  const used = new Set(day.slots.map((s) => s.exerciseId));
  const severeMuscles = (Object.entries(ci?.soreness ?? {}) as [Muscle, SorenessLevel][]).filter(([, v]) => v === 3).map(([m]) => m);
  const slots: PlanSlot[] = [];
  for (const s of day.slots) {
    const ex = getExercise(s.exerciseId);
    const hitSevere = ex.primary.filter((m) => soreOf(ci, m) === 3);
    if (hitSevere.length && s.role !== "mobility") {
      const sub = substitute(s, { equipment, limitations, excludeMuscles: severeMuscles, excludeIds: [...used] });
      if (sub) {
        used.add(sub);
        changes.push(`${ex.name} → ${getExercise(sub).name} (${hitSevere.join(", ")} still very sore).`);
        slots.push({ ...s, exerciseId: sub });
      } else changes.push(`${ex.name} removed (${hitSevere.join(", ")} still very sore).`);
      continue;
    }
    const hitModerate = ex.primary.some((m) => soreOf(ci, m) === 2);
    if (hitModerate && s.prescription.sets > 2 && s.role !== "mobility") {
      changes.push(`${ex.name}: one fewer set while ${ex.primary.filter((m) => soreOf(ci, m) === 2).join(", ")} recover.`);
      slots.push({ ...s, prescription: { ...s.prescription, sets: s.prescription.sets - 1 } });
      continue;
    }
    slots.push(s);
  }

  let out = slots;
  if (readiness.status === "moderate" || (readiness.status === "low" && opts.forceTrain)) {
    const low = readiness.status === "low";
    out = out.map((s) =>
      s.role === "main" || s.role === "secondary" || s.role === "power"
        ? { ...s, prescription: { ...s.prescription, sets: Math.max(2, s.prescription.sets - 1), rpe: Math.min(s.prescription.rpe, low ? 6.5 : 7.5) } }
        : s.role === "conditioning"
          ? { ...s, prescription: { ...s.prescription, sets: Math.max(1, Math.ceil(s.prescription.sets * 0.6)) } }
          : s,
    );
    changes.push(
      low
        ? "Training anyway: every main lift is one set shorter, capped at RPE 6–7, and conditioning is trimmed."
        : "Recovery is reduced, so main lifts are one set shorter and capped around RPE 7–8.",
    );
  }

  return { day: { ...day, slots: out }, changes, swappedFromDayId };
}
