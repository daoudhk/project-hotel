import type { CheckIn, MealEntry, Profile, StartingLift, TestResult, WorkoutSession } from "../types";
import { EQUIPMENT_PRESETS, getExercise } from "../data/exercises";
import { FOODS } from "../data/foods";
import { generatePlan } from "../engine/planner";
import { exerciseHistory, recommend } from "../engine/progression";
import { localDate, uid } from "../format";
import { initialState, type AppState } from "./store";

/**
 * Builds a clearly-labelled demo athlete with eight weeks of simulated
 * training so every screen can be explored. The simulation runs the real
 * progression engine, so the history behaves the way a real one would.
 * The UI shows a "Demo data" badge whenever this is loaded.
 */

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const DEFAULT_START: Record<string, number> = { barbell: 40, dumbbell: 14, machine: 40 };

export function buildDemoState(now = new Date()): AppState {
  const r = rng(42);
  const weeks = 8;
  const start = new Date(now.getTime() - weeks * 7 * 86400000);
  const profile: Profile = {
    name: "Sam",
    age: 29,
    sex: "male",
    heightCm: 181,
    weightKg: 80.4,
    experience: "experienced",
    primaryFocus: "hypertrophy",
    secondaryFocus: ["strength"],
    aestheticWeight: 0.8,
    goals: ["muscle", "strength"],
    daysPerWeek: 4,
    sessionMinutes: 60,
    equipmentPreset: "full_gym",
    equipment: EQUIPMENT_PRESETS.full_gym.equipment,
    trainingDays: [0, 1, 3, 4],
    limitations: [],
    activityLevel: "light",
    weightDirection: "gain",
    diet: "none",
    units: "metric",
    theme: "system",
    createdAt: start.toISOString(),
  };
  const plan = generatePlan(
    {
      primaryFocus: profile.primaryFocus,
      secondaryFocus: profile.secondaryFocus,
      aestheticWeight: profile.aestheticWeight,
      daysPerWeek: profile.daysPerWeek,
      sessionMinutes: profile.sessionMinutes,
      equipment: profile.equipment,
      experience: profile.experience,
      limitations: [],
      trainingDays: profile.trainingDays,
    },
    start,
  );

  const startingLifts: StartingLift[] = [
    { lift: "bench_press", weight: 72.5, reps: 8, date: start.toISOString() },
    { lift: "back_squat", weight: 95, reps: 6, date: start.toISOString() },
    { lift: "deadlift", weight: 130, reps: 5, date: start.toISOString() },
    { lift: "overhead_press", weight: 45, reps: 6, date: start.toISOString() },
    { lift: "pull_up", weight: 0, reps: 8, date: start.toISOString() },
  ];
  const e1 = (lift: string) => {
    const s = startingLifts.find((x) => x.lift === lift);
    return s ? s.weight * (1 + s.reps / 30) : null;
  };

  const sessions: WorkoutSession[] = [];
  const startMonday = new Date(start);
  startMonday.setHours(18, 0, 0, 0);
  startMonday.setDate(startMonday.getDate() - ((startMonday.getDay() + 6) % 7));

  for (let w = 0; w < weeks; w++) {
    for (const day of plan.days) {
      const date = new Date(startMonday.getTime() + (w * 7 + day.weekday) * 86400000);
      if (date.getTime() >= now.getTime() - 86400000 * 0.5) continue;
      if (r() < 0.08) continue; // the occasional missed session
      const exercises = day.slots.map((slot) => {
        const ex = getExercise(slot.exerciseId);
        const history = exerciseHistory(sessions, ex.id);
        const rec = recommend({ exercise: ex, prescription: slot.prescription, history, e1rm: ex.benchmark ? e1(ex.benchmark) : null });
        const timed = slot.prescription.workSec !== undefined;
        const weight = rec.weight ?? (ex.loadType === "bodyweight" || ex.loadType === "timed" ? 0 : DEFAULT_START[ex.loadType] ?? 20);
        const sets = Array.from({ length: slot.prescription.sets }, (_, i) => {
          const fatigue = i >= 2 ? 1 : 0;
          const reps = timed
            ? 1
            : Math.max(slot.prescription.repsMin - 1, slot.prescription.repsMax - Math.floor(r() * 2.2) - fatigue + (rec.decision === "add_reps" ? 1 : 0));
          return { weight, reps: Math.min(reps, slot.prescription.repsMax), rpe: timed ? undefined : Math.round((7.5 + r() * 1.5) * 2) / 2, done: true, seconds: slot.prescription.workSec };
        });
        return {
          slotId: slot.id,
          exerciseId: ex.id,
          role: slot.role,
          prescription: slot.prescription,
          recommendedWeight: rec.weight,
          recommendationReason: rec.reason,
          sets,
        };
      });
      const mins = day.estMinutes + Math.round(r() * 8 - 3);
      sessions.push({
        id: uid("w"),
        dayId: day.id,
        title: day.title,
        startedAt: date.toISOString(),
        finishedAt: new Date(date.getTime() + mins * 60000).toISOString(),
        exercises,
        adjustments: [],
        sessionRpe: Math.round(7 + r() * 2),
        isDemo: true,
      });
    }
  }

  const weights = Array.from({ length: weeks * 7 }, (_, i) => {
    const d = new Date(start.getTime() + i * 86400000);
    d.setHours(7, 30, 0, 0);
    return { date: d.toISOString(), kg: Math.round((78.6 + (i / (weeks * 7)) * 1.8 + (r() - 0.5) * 0.8) * 10) / 10 };
  }).filter((_, i) => i % 2 === 0 || r() > 0.5);

  const tests: TestResult[] = [
    { id: uid("t"), test: "vertical_jump", date: new Date(start.getTime() + 86400000).toISOString(), value: 48 },
    { id: uid("t"), test: "vertical_jump", date: new Date(now.getTime() - 9 * 86400000).toISOString(), value: 49 },
    { id: uid("t"), test: "pull_up_max", date: new Date(start.getTime() + 86400000).toISOString(), value: 8 },
    { id: uid("t"), test: "pull_up_max", date: new Date(now.getTime() - 9 * 86400000).toISOString(), value: 11 },
    { id: uid("t"), test: "broad_jump", date: new Date(start.getTime() + 86400000).toISOString(), value: 228 },
  ];

  const today = localDate(now);
  const checkIns: CheckIn[] = [];
  for (let i = 1; i < 10; i++) {
    const d = new Date(now.getTime() - i * 86400000);
    checkIns.push({ id: uid("ci"), date: localDate(d), soreness: i % 3 === 0 ? { quads: 1, glutes: 1 } : { chest: 1 }, sleepHours: 7 + Math.round(r() * 3) / 2, sleepQuality: 3, energy: 4 });
  }

  const food = (id: string) => FOODS.find((f) => f.id === id)!;
  const meal = (meal: MealEntry["meal"], id: string, servings: number): MealEntry => {
    const f = food(id);
    return { id: uid("m"), date: today, meal, name: f.name, servings, kcal: Math.round(f.kcal * servings), protein: f.protein * servings, carbs: f.carbs * servings, fat: f.fat * servings, foodId: f.id, source: "database" };
  };
  const meals: MealEntry[] = now.getHours() >= 9 ? [meal("breakfast", "oats", 1.5), meal("breakfast", "greek_yogurt", 1), meal("breakfast", "banana", 1)] : [];
  if (now.getHours() >= 14) meals.push(meal("lunch", "chicken_breast", 1), meal("lunch", "rice", 1.5), meal("lunch", "broccoli", 1));

  return {
    ...initialState,
    profile: { ...profile, weightKg: weights[weights.length - 1].kg },
    plan,
    sessions,
    startingLifts,
    tests,
    weights,
    checkIns,
    meals,
    savedMeals: [
      {
        id: uid("sm"),
        name: "Usual breakfast",
        items: [meal("breakfast", "oats", 1.5), meal("breakfast", "greek_yogurt", 1), meal("breakfast", "banana", 1)].map(({ id, date, meal: _m, ...rest }) => rest),
      },
    ],
    water: { [today]: now.getHours() >= 12 ? 1250 : 500 },
    isDemo: true,
  };
}
