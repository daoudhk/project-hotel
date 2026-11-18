"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  AthleticTest,
  BodyWeightEntry,
  CheckIn,
  FocusChange,
  FocusId,
  LoggedSet,
  MealEntry,
  Muscle,
  PlanDay,
  Profile,
  SavedMeal,
  SessionExercise,
  StartingLift,
  TestResult,
  TrainingPlan,
  WorkoutSession,
} from "../types";
import { generatePlan } from "../engine/planner";
import { adjustForReadiness, exerciseHistory, recommend } from "../engine/progression";
import { computeBenchmarks } from "../engine/strength";
import type { ReadinessStatus } from "../engine/recovery";
import { getExercise } from "../data/exercises";
import { localDate, uid } from "../format";

/**
 * Client-side persistence (localStorage). Every write goes through these
 * actions, so swapping in a server-backed repository (e.g. Supabase/Postgres
 * with row-level security) means re-implementing this module only.
 */

export interface AppState {
  version: number;
  profile: Profile | null;
  plan: TrainingPlan | null;
  sessions: WorkoutSession[];
  active: WorkoutSession | null;
  activeIndex: number;
  restEndsAt: number | null;
  checkIns: CheckIn[];
  weights: BodyWeightEntry[];
  tests: TestResult[];
  startingLifts: StartingLift[];
  meals: MealEntry[];
  savedMeals: SavedMeal[];
  water: Record<string, number>;
  calorieAdjustment: number;
  focusChanges: FocusChange[];
  isDemo: boolean;
  consents: { assistantCloud: boolean; healthIntegrations: boolean };
  /** User override of which plan day to do today. */
  todayChoice: { date: string; dayId: string | null; forceTrain?: boolean } | null;
  lastSummaryId: string | null;
  /** A one-off version of today's session (e.g. shortened by the coach). */
  customToday: { date: string; day: PlanDay; note: string } | null;
}

export interface AppActions {
  completeOnboarding: (p: Profile, startingLifts: StartingLift[], tests: TestResult[]) => void;
  updateProfile: (patch: Partial<Profile>, opts?: { regenerate?: boolean }) => void;
  regeneratePlan: () => void;
  changeFocus: (primary: FocusId, secondary: FocusId[]) => void;
  applyPlan: (plan: TrainingPlan) => void;
  swapInPlan: (dayId: string, slotId: string, exerciseId: string) => void;
  setCustomToday: (day: PlanDay | null, note?: string) => void;

  startWorkout: (day: PlanDay, readiness: ReadinessStatus, adjustments: string[]) => void;
  setActiveIndex: (i: number) => void;
  updateSet: (exIndex: number, setIndex: number, patch: Partial<LoggedSet>) => void;
  completeSet: (exIndex: number, setIndex: number) => void;
  addSet: (exIndex: number) => void;
  removeSet: (exIndex: number, setIndex: number) => void;
  skipExercise: (exIndex: number) => void;
  swapExercise: (exIndex: number, exerciseId: string) => void;
  startRest: (seconds: number) => void;
  clearRest: () => void;
  finishWorkout: (sessionRpe?: number) => string | null;
  discardWorkout: () => void;

  saveCheckIn: (c: Omit<CheckIn, "id" | "date">) => void;
  chooseToday: (dayId: string | null, forceTrain?: boolean) => void;
  addWeight: (kg: number, date?: string) => void;
  addTest: (test: AthleticTest, value: number) => void;
  removeTest: (id: string) => void;

  addMeal: (m: Omit<MealEntry, "id">) => void;
  updateMeal: (id: string, patch: Partial<MealEntry>) => void;
  removeMeal: (id: string) => void;
  saveMealTemplate: (name: string, items: SavedMeal["items"]) => void;
  removeSavedMeal: (id: string) => void;
  addWater: (ml: number) => void;
  setCalorieAdjustment: (kcal: number) => void;

  setConsent: (k: keyof AppState["consents"], v: boolean) => void;
  importState: (s: Partial<AppState>) => void;
  resetAll: () => void;
}

export const initialState: AppState = {
  version: 1,
  profile: null,
  plan: null,
  sessions: [],
  active: null,
  activeIndex: 0,
  restEndsAt: null,
  checkIns: [],
  weights: [],
  tests: [],
  startingLifts: [],
  meals: [],
  savedMeals: [],
  water: {},
  calorieAdjustment: 0,
  focusChanges: [],
  isDemo: false,
  consents: { assistantCloud: false, healthIntegrations: false },
  todayChoice: null,
  lastSummaryId: null,
  customToday: null,
};

export function planFromProfile(p: Profile, bringUp?: Muscle[]): TrainingPlan {
  return generatePlan({
    primaryFocus: p.primaryFocus,
    secondaryFocus: p.secondaryFocus,
    aestheticWeight: p.aestheticWeight,
    daysPerWeek: p.daysPerWeek,
    sessionMinutes: p.sessionMinutes,
    equipment: p.equipment,
    experience: p.experience,
    limitations: p.limitations,
    trainingDays: p.trainingDays,
    bringUp,
  });
}

export function buildSessionExercises(day: PlanDay, s: Pick<AppState, "sessions" | "startingLifts" | "profile">, readiness: ReadinessStatus): SessionExercise[] {
  const p = s.profile;
  const bench = p
    ? computeBenchmarks({ sessions: s.sessions, startingLifts: s.startingLifts, bodyweightKg: p.weightKg, sex: p.sex, age: p.age })
    : [];
  return day.slots.map((slot) => {
    const ex = getExercise(slot.exerciseId);
    const history = exerciseHistory(s.sessions, ex.id);
    const e1rm = ex.benchmark ? bench.find((b) => b.lift === ex.benchmark && b.lift !== "pull_up" && b.lift !== "push_up")?.best : null;
    let rec = recommend({ exercise: ex, prescription: slot.prescription, history, e1rm });
    rec = adjustForReadiness(rec, readiness, ex.increment || 2.5);
    const weight = rec.weight ?? history[0]?.sets[0]?.weight ?? 0;
    const timed = slot.prescription.workSec !== undefined;
    return {
      slotId: slot.id,
      exerciseId: ex.id,
      role: slot.role,
      prescription: slot.prescription,
      recommendedWeight: rec.weight,
      recommendationReason: rec.reason,
      sets: Array.from({ length: slot.prescription.sets }, () => ({
        weight,
        reps: timed ? 1 : rec.decision === "add_reps" && rec.previous ? Math.min(slot.prescription.repsMax, Math.max(...rec.previous.reps)) : slot.prescription.repsMax,
        seconds: slot.prescription.workSec,
        done: false,
      })),
    };
  });
}

export const useApp = create<AppState & AppActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      completeOnboarding: (profile, startingLifts, tests) => {
        const plan = planFromProfile(profile);
        set({
          profile,
          plan,
          startingLifts,
          tests,
          weights: [{ date: new Date().toISOString(), kg: profile.weightKg }],
          isDemo: false,
        });
      },

      updateProfile: (patch, opts) => {
        const cur = get().profile;
        if (!cur) return;
        const profile = { ...cur, ...patch };
        set({ profile });
        if (opts?.regenerate) set({ plan: planFromProfile(profile) });
      },

      regeneratePlan: () => {
        const p = get().profile;
        if (p) set({ plan: planFromProfile(p) });
      },

      changeFocus: (primary, secondary) => {
        const p = get().profile;
        if (!p) return;
        const profile = { ...p, primaryFocus: primary, secondaryFocus: secondary.filter((s) => s !== primary) };
        set({
          profile,
          plan: planFromProfile(profile),
          focusChanges: p.primaryFocus !== primary ? [...get().focusChanges, { date: new Date().toISOString(), from: p.primaryFocus, to: primary }] : get().focusChanges,
          todayChoice: null,
          customToday: null,
        });
      },

      applyPlan: (plan) => set({ plan }),

      swapInPlan: (dayId, slotId, exerciseId) => {
        const plan = get().plan;
        if (!plan) return;
        const days = plan.days.map((d) => (d.id === dayId ? { ...d, slots: d.slots.map((x) => (x.id === slotId ? { ...x, exerciseId } : x)) } : d));
        const ct = get().customToday;
        set({
          plan: { ...plan, days },
          customToday: ct ? { ...ct, day: { ...ct.day, slots: ct.day.slots.map((x) => (x.id === slotId ? { ...x, exerciseId } : x)) } } : ct,
        });
      },

      setCustomToday: (day, note) => set({ customToday: day ? { date: localDate(), day, note: note ?? "" } : null }),

      startWorkout: (day, readiness, adjustments) => {
        const s = get();
        const session: WorkoutSession = {
          id: uid("w"),
          dayId: day.id,
          title: day.title,
          startedAt: new Date().toISOString(),
          exercises: buildSessionExercises(day, s, readiness),
          adjustments,
        };
        set({ active: session, activeIndex: 0, restEndsAt: null });
      },

      setActiveIndex: (i) => set({ activeIndex: i }),

      updateSet: (ei, si, patch) =>
        set((s) => {
          if (!s.active) return {};
          const exercises = s.active.exercises.map((e, i) => {
            if (i !== ei) return e;
            const sets = e.sets.map((x, j) => {
              if (j === si) return { ...x, ...patch };
              // Carry a weight change forward to the following, not-yet-done sets.
              if (patch.weight !== undefined && j > si && !x.done) return { ...x, weight: patch.weight };
              return x;
            });
            return { ...e, sets };
          });
          return { active: { ...s.active, exercises } };
        }),

      completeSet: (ei, si) => {
        const s = get();
        if (!s.active) return;
        const ex = s.active.exercises[ei];
        const wasDone = ex.sets[si].done;
        get().updateSet(ei, si, { done: !wasDone });
        if (!wasDone) {
          const remaining = ex.sets.filter((x, j) => j !== si && !x.done).length;
          if (remaining > 0 && ex.prescription.restSec > 0) get().startRest(ex.prescription.restSec);
          else get().clearRest();
        }
      },

      addSet: (ei) =>
        set((s) => {
          if (!s.active) return {};
          const exercises = s.active.exercises.map((e, i) => {
            if (i !== ei) return e;
            const last = e.sets[e.sets.length - 1];
            return { ...e, sets: [...e.sets, { weight: last?.weight ?? 0, reps: last?.reps ?? e.prescription.repsMax, seconds: last?.seconds, done: false }] };
          });
          return { active: { ...s.active, exercises } };
        }),

      removeSet: (ei, si) =>
        set((s) => {
          if (!s.active) return {};
          const exercises = s.active.exercises.map((e, i) => (i === ei && e.sets.length > 1 ? { ...e, sets: e.sets.filter((_, j) => j !== si) } : e));
          return { active: { ...s.active, exercises } };
        }),

      skipExercise: (ei) =>
        set((s) => {
          if (!s.active) return {};
          const exercises = s.active.exercises.map((e, i) => (i === ei ? { ...e, skipped: !e.skipped } : e));
          return { active: { ...s.active, exercises } };
        }),

      swapExercise: (ei, exerciseId) => {
        const s = get();
        if (!s.active) return;
        const cur = s.active.exercises[ei];
        const ex = getExercise(exerciseId);
        const history = exerciseHistory(s.sessions, exerciseId);
        const rec = recommend({ exercise: ex, prescription: cur.prescription, history });
        const weight = rec.weight ?? history[0]?.sets[0]?.weight ?? 0;
        const replaced: SessionExercise = {
          ...cur,
          exerciseId,
          substitutedFrom: cur.substitutedFrom ?? cur.exerciseId,
          recommendedWeight: rec.weight,
          recommendationReason: rec.reason,
          skipped: false,
          sets: cur.sets.map((x) => (x.done ? x : { ...x, weight })),
        };
        set({ active: { ...s.active, exercises: s.active.exercises.map((e, i) => (i === ei ? replaced : e)) } });
      },

      startRest: (seconds) => set({ restEndsAt: Date.now() + seconds * 1000 }),
      clearRest: () => set({ restEndsAt: null }),

      finishWorkout: (sessionRpe) => {
        const s = get();
        if (!s.active) return null;
        const done: WorkoutSession = {
          ...s.active,
          finishedAt: new Date().toISOString(),
          sessionRpe,
          exercises: s.active.exercises.map((e) => ({ ...e, sets: e.sets.filter((x) => x.done) })).filter((e) => e.sets.length > 0),
        };
        set({ sessions: [...s.sessions, done], active: null, activeIndex: 0, restEndsAt: null, lastSummaryId: done.id });
        return done.id;
      },

      discardWorkout: () => set({ active: null, activeIndex: 0, restEndsAt: null }),

      saveCheckIn: (c) => {
        const date = localDate();
        const others = get().checkIns.filter((x) => x.date !== date);
        set({ checkIns: [...others, { ...c, id: uid("ci"), date }], todayChoice: null, customToday: null });
      },

      chooseToday: (dayId, forceTrain) => set({ todayChoice: { date: localDate(), dayId, forceTrain }, customToday: null }),

      addWeight: (kg, date) => {
        const d = date ?? new Date().toISOString();
        const day = d.slice(0, 10);
        const weights = [...get().weights.filter((w) => w.date.slice(0, 10) !== day), { date: d, kg }].sort((a, b) => a.date.localeCompare(b.date));
        const p = get().profile;
        set({ weights, profile: p ? { ...p, weightKg: kg } : p });
      },

      addTest: (test, value) => set({ tests: [...get().tests, { id: uid("t"), test, value, date: new Date().toISOString() }] }),
      removeTest: (id) => set({ tests: get().tests.filter((t) => t.id !== id) }),

      addMeal: (m) => set({ meals: [...get().meals, { ...m, id: uid("m") }] }),
      updateMeal: (id, patch) => set({ meals: get().meals.map((m) => (m.id === id ? { ...m, ...patch } : m)) }),
      removeMeal: (id) => set({ meals: get().meals.filter((m) => m.id !== id) }),
      saveMealTemplate: (name, items) => set({ savedMeals: [...get().savedMeals, { id: uid("sm"), name, items }] }),
      removeSavedMeal: (id) => set({ savedMeals: get().savedMeals.filter((m) => m.id !== id) }),
      addWater: (ml) => {
        const d = localDate();
        set({ water: { ...get().water, [d]: Math.max(0, (get().water[d] ?? 0) + ml) } });
      },
      setCalorieAdjustment: (kcal) => set({ calorieAdjustment: kcal }),

      setConsent: (k, v) => set({ consents: { ...get().consents, [k]: v } }),
      importState: (s) => set({ ...initialState, ...s }),
      resetAll: () => set({ ...initialState }),
    }),
    {
      name: "gymnasio:v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);

/** True once persisted state has been read from storage. */
export function useHydrated(): boolean {
  const [h, setH] = useState(false);
  useEffect(() => {
    const unsub = useApp.persist.onFinishHydration(() => setH(true));
    if (useApp.persist.hasHydrated()) setH(true);
    return unsub;
  }, []);
  return h;
}
