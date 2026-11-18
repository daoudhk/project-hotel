import type {
  DayEmphasis,
  Equipment,
  Exercise,
  Experience,
  FocusId,
  Limitation,
  Muscle,
  Pattern,
  PlanDay,
  PlanSlot,
  Prescription,
  SlotRole,
  TrainingPlan,
} from "../types";
import { EXERCISES, getExercise, isAvailable } from "../data/exercises";
import { blendFocus, describeTradeoffs, FOCUS, type FocusProfile } from "./focus";

/**
 * Deterministic plan generator. Given the same inputs it always produces the
 * same plan, so every recommendation can be explained and audited.
 */

export interface PlanInput {
  primaryFocus: FocusId;
  secondaryFocus: FocusId[];
  aestheticWeight?: number;
  daysPerWeek: number;
  sessionMinutes: number;
  equipment: Equipment[];
  experience: Experience;
  limitations: Limitation[];
  trainingDays?: number[];
  /** Muscles to give extra attention (e.g. relative weaknesses). */
  bringUp?: Muscle[];
  /** Exercises the user prefers to avoid. */
  avoid?: string[];
}

interface SlotSpec {
  role: SlotRole;
  patterns: Pattern[];
  muscle?: Muscle;
}

type TemplateId = "fullA" | "fullB" | "fullC" | "upperA" | "upperB" | "lowerA" | "lowerB" | "push" | "pull" | "legs" | "cond";

const TEMPLATES: Record<TemplateId, { emphasis: DayEmphasis; slots: SlotSpec[] }> = {
  fullA: {
    emphasis: "full",
    slots: [
      { role: "power", patterns: ["jump", "throw"] },
      { role: "main", patterns: ["squat", "lunge"] },
      { role: "main", patterns: ["h_push"] },
      { role: "secondary", patterns: ["h_pull"] },
      { role: "secondary", patterns: ["hinge"] },
      { role: "accessory", patterns: ["iso_shoulders", "v_push"] },
      { role: "core", patterns: ["core_anti"] },
    ],
  },
  fullB: {
    emphasis: "full",
    slots: [
      { role: "power", patterns: ["throw", "jump"] },
      { role: "main", patterns: ["hinge"] },
      { role: "main", patterns: ["v_pull", "h_pull"] },
      { role: "secondary", patterns: ["v_push", "h_push"] },
      { role: "secondary", patterns: ["lunge", "squat"] },
      { role: "accessory", patterns: ["iso_arms"], muscle: "biceps" },
      { role: "core", patterns: ["rotation", "core_anti"] },
    ],
  },
  fullC: {
    emphasis: "full",
    slots: [
      { role: "power", patterns: ["jump"] },
      { role: "main", patterns: ["lunge", "squat"] },
      { role: "main", patterns: ["h_push", "v_push"] },
      { role: "secondary", patterns: ["v_pull", "h_pull"] },
      { role: "secondary", patterns: ["hinge"] },
      { role: "accessory", patterns: ["iso_arms"], muscle: "triceps" },
      { role: "core", patterns: ["carry", "core_anti"] },
    ],
  },
  upperA: {
    emphasis: "upper",
    slots: [
      { role: "power", patterns: ["throw"] },
      { role: "main", patterns: ["h_push"] },
      { role: "main", patterns: ["h_pull"] },
      { role: "secondary", patterns: ["v_push"] },
      { role: "secondary", patterns: ["v_pull"] },
      { role: "accessory", patterns: ["iso_arms"], muscle: "biceps" },
      { role: "accessory", patterns: ["iso_shoulders"] },
    ],
  },
  upperB: {
    emphasis: "upper",
    slots: [
      { role: "power", patterns: ["throw"] },
      { role: "main", patterns: ["v_push", "h_push"] },
      { role: "main", patterns: ["v_pull"] },
      { role: "secondary", patterns: ["h_push"] },
      { role: "secondary", patterns: ["h_pull"] },
      { role: "accessory", patterns: ["iso_arms"], muscle: "triceps" },
      { role: "accessory", patterns: ["iso_shoulders"] },
    ],
  },
  lowerA: {
    emphasis: "lower",
    slots: [
      { role: "power", patterns: ["jump"] },
      { role: "main", patterns: ["squat"] },
      { role: "secondary", patterns: ["hinge"] },
      { role: "secondary", patterns: ["lunge"] },
      { role: "accessory", patterns: ["iso_legs"], muscle: "hamstrings" },
      { role: "accessory", patterns: ["calves"] },
      { role: "core", patterns: ["core_anti"] },
    ],
  },
  lowerB: {
    emphasis: "lower",
    slots: [
      { role: "power", patterns: ["jump", "sprint"] },
      { role: "main", patterns: ["hinge"] },
      { role: "secondary", patterns: ["squat", "lunge"] },
      { role: "secondary", patterns: ["lunge"] },
      { role: "accessory", patterns: ["iso_legs"], muscle: "quads" },
      { role: "accessory", patterns: ["adductors", "calves"] },
      { role: "core", patterns: ["rotation", "core_anti"] },
    ],
  },
  push: {
    emphasis: "push",
    slots: [
      { role: "main", patterns: ["h_push"] },
      { role: "secondary", patterns: ["v_push"] },
      { role: "secondary", patterns: ["h_push"] },
      { role: "accessory", patterns: ["iso_shoulders"] },
      { role: "accessory", patterns: ["iso_arms"], muscle: "triceps" },
      { role: "core", patterns: ["core_anti"] },
    ],
  },
  pull: {
    emphasis: "pull",
    slots: [
      { role: "main", patterns: ["v_pull"] },
      { role: "secondary", patterns: ["h_pull"] },
      { role: "secondary", patterns: ["h_pull"] },
      { role: "accessory", patterns: ["iso_shoulders"], muscle: "back" },
      { role: "accessory", patterns: ["iso_arms"], muscle: "biceps" },
      { role: "core", patterns: ["carry"] },
    ],
  },
  legs: {
    emphasis: "legs",
    slots: [
      { role: "main", patterns: ["squat"] },
      { role: "secondary", patterns: ["hinge"] },
      { role: "secondary", patterns: ["lunge"] },
      { role: "accessory", patterns: ["iso_legs"], muscle: "quads" },
      { role: "accessory", patterns: ["iso_legs"], muscle: "hamstrings" },
      { role: "accessory", patterns: ["calves"] },
    ],
  },
  cond: {
    emphasis: "conditioning",
    slots: [
      { role: "power", patterns: ["sprint", "jump"] },
      { role: "conditioning", patterns: ["conditioning"] },
      { role: "core", patterns: ["rotation", "core_anti"] },
      { role: "accessory", patterns: ["carry", "core_anti"] },
      { role: "mobility", patterns: ["mobility"] },
    ],
  },
};

const DEFAULT_WEEKDAYS: Record<number, number[]> = {
  1: [2],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
};

export function chooseSplit(days: number, f: FocusProfile): { name: string; templates: TemplateId[] } {
  const n = Math.max(1, Math.min(6, Math.round(days)));
  const physique = f.id === "hypertrophy";
  const condHeavy = f.conditioning >= 0.7;
  switch (n) {
    case 1:
      return { name: "Full body", templates: ["fullA"] };
    case 2:
      return { name: "Full body A/B", templates: ["fullA", "fullB"] };
    case 3:
      if (condHeavy && !physique) return { name: "Full body + conditioning", templates: ["fullA", "cond", "fullB"] };
      return { name: "Full body A/B/C", templates: ["fullA", "fullB", "fullC"] };
    case 4:
      if (f.id === "endurance") return { name: "Strength + aerobic", templates: ["fullA", "cond", "fullB", "cond"] };
      return { name: "Upper / Lower", templates: ["upperA", "lowerA", "upperB", "lowerB"] };
    case 5:
      if (physique) return { name: "Upper / Lower + Push / Pull / Legs", templates: ["upperA", "lowerA", "push", "pull", "legs"] };
      return { name: "Upper / Lower + conditioning", templates: ["lowerA", "upperA", "cond", "lowerB", "upperB"] };
    default:
      if (physique) return { name: "Push / Pull / Legs ×2", templates: ["push", "pull", "legs", "push", "pull", "legs"] };
      return { name: "Upper / Lower ×2 + conditioning", templates: ["lowerA", "upperA", "cond", "lowerB", "upperB", "cond"] };
  }
}

const LOWER_PATTERNS: Pattern[] = ["squat", "hinge", "lunge", "iso_legs", "calves", "adductors", "jump", "sprint"];
const UPPER_PATTERNS: Pattern[] = ["h_push", "v_push", "h_pull", "v_pull", "iso_arms", "iso_shoulders", "throw"];

function patternFitsDay(p: Pattern, e: DayEmphasis): boolean {
  if (e === "conditioning" || e === "full" || e === "recovery") return true;
  if (e === "upper" || e === "push" || e === "pull") return !LOWER_PATTERNS.includes(p);
  if (e === "lower" || e === "legs" || e === "power") return !UPPER_PATTERNS.includes(p);
  return true;
}

/** Score how well an exercise suits a slot for this athlete. Higher is better. */
export function scoreExercise(ex: Exercise, role: SlotRole, f: FocusProfile, experience: Experience, bringUp: Muscle[] = []): number {
  let s = 0;
  for (const q of ex.qualities) s += f.qualities[q] ?? 0;
  if (role === "main" || role === "secondary") {
    if (ex.kind === "compound") s += 1;
    if (role === "main" && ex.benchmark && ex.loadType === "barbell") s += f.qualities.max_strength ? 0.8 : 0.2;
    if (role === "main" && ex.loadType === "bodyweight" && ex.increment === 0) s -= 1; // hard to load progressively
  }
  if (role === "main" && ex.loadType === "barbell") s += 0.7;
  if (role === "accessory" && ex.fatigue >= 2) s -= 0.5;
  // Sport-specific drills only for the sports they belong to.
  if (ex.id === "shadow_boxing" && f.id !== "mma" && f.id !== "boxing") s -= 4;
  if (ex.id === "neck_iso" && f.id !== "mma") s -= 4;
  if (role === "power" && ex.kind === "power") s += 1;
  if (experience === "new" && ex.complexity === 3) s -= 2;
  if (experience === "some" && ex.complexity === 3) s -= 0.5;
  for (const m of bringUp) if (ex.primary.includes(m)) s += 0.6;
  for (const m of f.emphasisMuscles) if (ex.primary.includes(m)) s += 0.2;
  return s;
}

function candidates(spec: SlotSpec, input: PlanInput): Exercise[] {
  const avoid = new Set(input.avoid ?? []);
  const lim = new Set(input.limitations);
  const hasBetter = input.equipment.some((e) => e === "cable" || e === "machine" || e === "dumbbell");
  return EXERCISES.filter(
    (e) => !(hasBetter && e.equipment.includes("bands")),
  ).filter(
    (e) =>
      spec.patterns.includes(e.pattern) &&
      isAvailable(e, input.equipment) &&
      !avoid.has(e.id) &&
      !e.stresses.some((s) => lim.has(s)) &&
      (!spec.muscle || e.primary.includes(spec.muscle)) &&
      !(input.experience === "new" && spec.role === "power" && e.complexity === 3),
  );
}

export function prescribe(ex: Exercise, role: SlotRole, f: FocusProfile, experience: Experience): Prescription {
  const novice = experience === "new";
  const [mLo, mHi] = f.mainReps;
  const [aLo, aHi] = f.accessoryReps;
  const restFor = (reps: number) => (reps <= 5 ? 180 : reps <= 8 ? 150 : 120);

  if (ex.loadType === "timed" || ex.pattern === "carry") {
    if (ex.kind === "mobility") return { sets: 2, repsMin: 1, repsMax: 1, rpe: 3, restSec: 15, workSec: 60 };
    if (ex.pattern === "sprint") return { sets: 6, repsMin: 1, repsMax: 1, rpe: 9, restSec: 90, workSec: 5 };
    if (ex.kind === "conditioning") {
      if (ex.id === "zone2_bike" || ex.id === "brisk_walk" || ex.id === "tempo_run")
        return { sets: 1, repsMin: 1, repsMax: 1, rpe: 5, restSec: 0, workSec: Math.round(15 + 15 * f.conditioning) * 60 };
      const rounds = Math.round(5 + 5 * f.conditioning);
      const work = f.id === "mma" || f.id === "boxing" ? 60 : 30;
      return { sets: rounds, repsMin: 1, repsMax: 1, rpe: 8, restSec: work === 60 ? 60 : 60, workSec: work };
    }
    if (ex.pattern === "carry") return { sets: 3, repsMin: 1, repsMax: 1, rpe: 8, restSec: 75, workSec: 40 };
    if (ex.pattern === "calves") return { sets: 3, repsMin: 1, repsMax: 1, rpe: 7, restSec: 60, workSec: 20 };
    return { sets: 3, repsMin: 1, repsMax: 1, rpe: 7, restSec: 45, workSec: novice ? 25 : 40 };
  }

  if (ex.id === "nordic_curl") return { sets: 3, repsMin: 3, repsMax: 6, rpe: 8, restSec: 90 };
  switch (role) {
    case "power":
      return { sets: f.power >= 0.8 ? 4 : 3, repsMin: 3, repsMax: 5, rpe: 7, restSec: 90 };
    case "main":
      return { sets: novice ? 3 : f.id === "strength" ? 5 : 4, repsMin: mLo, repsMax: mHi, rpe: 8, restSec: restFor(mHi) };
    case "secondary": {
      const lo = Math.max(5, mLo + 2);
      const hi = Math.max(lo + 2, mHi + 2);
      return { sets: 3, repsMin: lo, repsMax: hi, rpe: 8, restSec: restFor(hi) - 30 };
    }
    case "core":
      return { sets: 3, repsMin: 8, repsMax: 12, rpe: 7, restSec: 45 };
    case "conditioning":
      return { sets: 6, repsMin: 10, repsMax: 15, rpe: 8, restSec: 45 };
    case "mobility":
      return { sets: 2, repsMin: 6, repsMax: 8, rpe: 3, restSec: 15 };
    default:
      return { sets: 3, repsMin: aLo, repsMax: aHi, rpe: 8.5, restSec: 75 };
  }
}

/** Rough time (minutes) for a slot: work + rest + setup. */
export function slotMinutes(p: Prescription): number {
  const work = p.workSec ?? Math.max(20, ((p.repsMin + p.repsMax) / 2) * 4);
  return (p.sets * work + Math.max(0, p.sets - 1) * p.restSec + 75) / 60;
}

const ROLE_DROP_ORDER: SlotRole[] = ["mobility", "accessory", "core", "conditioning", "power", "secondary"];

/** Trim a day to the available time without touching main lifts first. */
export function fitToTime(slots: PlanSlot[], minutes: number): { slots: PlanSlot[]; minutes: number } {
  const warmup = 6;
  let out = slots.map((s) => ({ ...s, prescription: { ...s.prescription } }));
  const total = () => warmup + out.reduce((a, s) => a + slotMinutes(s.prescription), 0);
  // 1. Shave a set from accessories / secondaries.
  for (const role of ["accessory", "secondary"] as SlotRole[]) {
    for (const s of out) {
      if (total() <= minutes) break;
      if (s.role === role && s.prescription.sets > 2) s.prescription.sets -= 1;
    }
  }
  // 2. Shorten conditioning.
  for (const s of out) {
    if (total() <= minutes) break;
    if (s.role === "conditioning" && s.prescription.sets > 4) s.prescription.sets = Math.max(4, s.prescription.sets - 3);
  }
  // 3. Drop low-priority slots, last first.
  for (const role of ROLE_DROP_ORDER) {
    for (let i = out.length - 1; i >= 0 && total() > minutes; i--) {
      if (out[i].role === role && out.filter((s) => s.role !== "mobility").length > 2) out.splice(i, 1);
    }
  }
  // 4. Keep sessions focused: at most 8 exercises.
  for (const role of ROLE_DROP_ORDER) {
    for (let i = out.length - 1; i >= 0 && out.length > 8; i--) if (out[i].role === role) out.splice(i, 1);
  }
  // 5. Main lifts down to 3 sets.
  for (const s of out) {
    if (total() <= minutes) break;
    if (s.role === "main" && s.prescription.sets > 3) s.prescription.sets -= 1;
  }
  out = out.filter(Boolean);
  return { slots: out, minutes: Math.round(total()) };
}

const EMPHASIS_TITLE: Record<DayEmphasis, string> = {
  full: "Full Body",
  upper: "Upper Body",
  lower: "Lower Body",
  push: "Push",
  pull: "Pull",
  legs: "Legs",
  power: "Power",
  conditioning: "Conditioning",
  recovery: "Recovery",
};

function dayFlavour(slots: PlanSlot[], f: FocusProfile): string {
  const roles = new Set(slots.map((s) => s.role));
  if (roles.has("power") && f.power >= 0.45) return "Power";
  if (f.id === "hypertrophy" || f.qualities.hypertrophy && f.qualities.hypertrophy >= 1.5) return "Hypertrophy";
  return "Strength";
}

function summarize(emphasis: DayEmphasis, slots: PlanSlot[], f: FocusProfile): string {
  const main = slots.filter((s) => s.role === "main").map((s) => getExercise(s.exerciseId).name);
  const power = slots.find((s) => s.role === "power");
  const parts: string[] = [];
  if (power) parts.push(`${getExercise(power.exerciseId).name.toLowerCase()} while you're fresh`);
  if (main.length) parts.push(`${main.join(" and ")} as the main work`);
  if (emphasis === "conditioning") return `Speed, ${f.id === "mma" || f.id === "boxing" ? "fight-style rounds" : "intervals"}, trunk work and mobility.`;
  const s = parts.join(", then ");
  return s ? s.charAt(0).toUpperCase() + s.slice(1) + "." : "Balanced session.";
}

export function generatePlan(input: PlanInput, now = new Date()): TrainingPlan {
  const f = blendFocus(input.primaryFocus, input.secondaryFocus, input.aestheticWeight);
  const split = chooseSplit(input.daysPerWeek, f);
  const weekdays = normalizeWeekdays(input.trainingDays, split.templates.length);
  const usedWeek = new Map<string, number>();

  // Distribute sport-specific accessories across lifting days.
  const special = f.specialPatterns.slice();
  const extrasByDay: SlotSpec[][] = split.templates.map(() => []);
  const perPattern = split.templates.length >= 4 ? 2 : 1;
  for (const p of special) {
    let placed = 0;
    for (let k = 0; k < split.templates.length && placed < perPattern; k++) {
      const idx = (special.indexOf(p) + k) % split.templates.length;
      const t = TEMPLATES[split.templates[idx]];
      if (!patternFitsDay(p, t.emphasis)) continue;
      if (t.slots.some((s) => s.patterns[0] === p) || extrasByDay[idx].some((s) => s.patterns[0] === p)) continue;
      const role: SlotRole = p === "sprint" || p === "jump" || p === "throw" ? "power" : p === "mobility" ? "mobility" : p === "rotation" || p === "core_anti" || p === "neck" ? "core" : "accessory";
      extrasByDay[idx].push({ role, patterns: [p] });
      placed++;
    }
  }

  // Conditioning finishers when the split has no dedicated day.
  const hasCondDay = split.templates.includes("cond");
  const finisherDays = !hasCondDay && f.conditioning >= 0.4 ? (f.conditioning >= 0.7 ? 2 : 1) : 0;
  if (finisherDays) {
    const order = split.templates
      .map((t, i) => ({ t, i }))
      .sort((a, b) => Number(TEMPLATES[a.t].emphasis !== "upper") - Number(TEMPLATES[b.t].emphasis !== "upper"));
    order.slice(0, finisherDays).forEach(({ i }) => extrasByDay[i].push({ role: "conditioning", patterns: ["conditioning"] }));
  }

  const days: PlanDay[] = split.templates.map((tid, di) => {
    const t = TEMPLATES[tid];
    let specs = t.slots.filter((s) => !(s.role === "power" && f.power < 0.3 && t.emphasis !== "conditioning"));
    // Insert extras before conditioning/mobility at the end.
    specs = [...specs, ...extrasByDay[di]];
    specs.sort((a, b) => roleOrder(a.role) - roleOrder(b.role));

    const usedDay = new Set<string>();
    const slots: PlanSlot[] = [];
    specs.forEach((spec, si) => {
      const cands = candidates(spec, input);
      if (!cands.length) return;
      const ranked = cands
        .map((e) => ({
          e,
          s:
            scoreExercise(e, spec.role, f, input.experience, input.bringUp) -
            (usedDay.has(e.id) ? 100 : 0) -
            (usedWeek.get(e.id) ?? 0) * (spec.role === "main" ? 0.4 : 1.2) -
            (spec.role === "conditioning" && f.conditioning < 0.5 && e.fatigue > 1 ? 1 : 0),
        }))
        .sort((a, b) => b.s - a.s || a.e.id.localeCompare(b.e.id));
      const pick = ranked[0];
      if (!pick || pick.s < -50) return;
      usedDay.add(pick.e.id);
      usedWeek.set(pick.e.id, (usedWeek.get(pick.e.id) ?? 0) + 1);
      slots.push({
        id: `${tid}-${di}-${si}`,
        role: spec.role,
        exerciseId: pick.e.id,
        prescription: prescribe(pick.e, spec.role, f, input.experience),
      });
    });

    const fitted = fitToTime(slots, input.sessionMinutes);
    const flavour = dayFlavour(fitted.slots, f);
    const title = t.emphasis === "conditioning" ? "Speed & Conditioning" : `${EMPHASIS_TITLE[t.emphasis]} · ${flavour}`;
    return {
      id: `d${di}-${tid}`,
      weekday: weekdays[di],
      title,
      emphasis: t.emphasis,
      summary: summarize(t.emphasis, fitted.slots, f),
      slots: fitted.slots,
      estMinutes: fitted.minutes,
    };
  });

  return {
    id: `plan-${now.getTime()}`,
    createdAt: now.toISOString(),
    focus: input.primaryFocus,
    secondary: input.secondaryFocus.filter((s) => s !== input.primaryFocus),
    splitName: split.name,
    rationale: buildRationale(input, f, split.name),
    tradeoffs: describeTradeoffs(input.primaryFocus, input.secondaryFocus),
    days,
    weeklySets: weeklySets(days),
  };
}

function roleOrder(r: SlotRole): number {
  return ["power", "main", "secondary", "accessory", "core", "conditioning", "mobility"].indexOf(r);
}

function normalizeWeekdays(chosen: number[] | undefined, n: number): number[] {
  const valid = Array.from(new Set((chosen ?? []).filter((d) => d >= 0 && d <= 6))).sort((a, b) => a - b);
  if (valid.length === n) return valid;
  return DEFAULT_WEEKDAYS[Math.max(1, Math.min(6, n))];
}

export function weeklySets(days: PlanDay[]): Partial<Record<Muscle, number>> {
  const out: Partial<Record<Muscle, number>> = {};
  for (const d of days)
    for (const s of d.slots) {
      const ex = getExercise(s.exerciseId);
      if (ex.kind === "mobility" || ex.kind === "conditioning") continue;
      for (const m of ex.primary) out[m] = (out[m] ?? 0) + s.prescription.sets;
      for (const m of ex.secondary) out[m] = (out[m] ?? 0) + s.prescription.sets * 0.5;
    }
  for (const k of Object.keys(out) as Muscle[]) out[k] = Math.round((out[k] as number) * 2) / 2;
  return out;
}

function buildRationale(input: PlanInput, f: FocusProfile, splitName: string): string[] {
  const r: string[] = [];
  const p = FOCUS[input.primaryFocus];
  r.push(`${input.daysPerWeek} days a week → ${splitName}. Every major muscle group is trained at least twice a week where the schedule allows.`);
  if (f.power >= 0.6) r.push(`${p.short} focus: sessions open with explosive work while you're fresh, because power output drops quickly with fatigue.`);
  if (f.id === "hypertrophy") r.push("Volume is spread across the week to keep most muscles in a productive range of sets.");
  if (f.id === "strength") r.push("Main lifts use heavy sets of 3–5 with long rests. Accessories build the muscles that move those lifts.");
  if (f.conditioning >= 0.7) r.push("Conditioning is programmed deliberately, separate from or after heavy lifting, so it builds your engine without blunting strength.");
  if (input.limitations.length) r.push(`Movements that load your ${input.limitations.map((l) => l.replace("_", " ")).join(", ")} have been left out. Swap anything that doesn't feel right.`);
  if (input.experience === "new") r.push("You're new to structured training, so technical lifts are replaced with simpler variations and main lifts start at 3 sets.");
  r.push(`Sessions are built to fit about ${input.sessionMinutes} minutes, including a short warm-up.`);
  return r;
}
