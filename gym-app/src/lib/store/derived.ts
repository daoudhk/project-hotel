"use client";

import { useMemo } from "react";
import type { CheckIn, PlanDay } from "../types";
import { useApp, type AppState } from "./store";
import { adaptDay, assessReadiness, type AdaptedWorkout, type Readiness } from "../engine/recovery";
import { assessMuscles, computeBenchmarks, relativeWeaknesses } from "../engine/strength";
import { nutritionTargets, weightTrend, trendAdjustment } from "../engine/nutrition";
import { localDate, weekdayIndex } from "../format";

export interface TodayInfo {
  isTrainingDay: boolean;
  plannedDay: PlanDay | null;
  nextDay: PlanDay | null;
  daysUntilNext: number;
  checkIn: CheckIn | undefined;
  readiness: Readiness;
  adapted: AdaptedWorkout | null;
  completedToday: boolean;
  chosenByUser: boolean;
}

export function computeToday(s: AppState, now = new Date()): TodayInfo {
  const today = localDate(now);
  const wd = weekdayIndex(now);
  const days = s.plan?.days ?? [];
  const checkIn = s.checkIns.find((c) => c.date === today);
  const readiness = assessReadiness(checkIn, s.sessions, now);
  const completedToday = s.sessions.some((x) => x.finishedAt && localDate(new Date(x.startedAt)) === today);

  let nextDay: PlanDay | null = null;
  let daysUntilNext = 0;
  for (let k = 1; k <= 7 && days.length; k++) {
    const d = days.find((x) => x.weekday === (wd + k) % 7);
    if (d) {
      nextDay = d;
      daysUntilNext = k;
      break;
    }
  }

  const choice = s.todayChoice && s.todayChoice.date === today ? s.todayChoice : null;
  let planned = days.find((d) => d.weekday === wd) ?? null;
  if (choice?.dayId) planned = days.find((d) => d.id === choice.dayId) ?? planned;

  const adapted =
    planned && s.profile
      ? adaptDay({
          day: planned,
          allDays: days,
          checkIn,
          readiness,
          equipment: s.profile.equipment,
          limitations: s.profile.limitations,
          forceTrain: choice?.forceTrain,
        })
      : null;

  const custom = s.customToday && s.customToday.date === today ? s.customToday : null;
  const finalAdapted = custom ? { day: custom.day, changes: [custom.note, ...(adapted?.changes ?? [])].filter(Boolean) } : adapted;

  return {
    isTrainingDay: !!planned,
    plannedDay: planned,
    nextDay,
    daysUntilNext,
    checkIn,
    readiness,
    adapted: finalAdapted,
    completedToday,
    chosenByUser: !!choice?.dayId,
  };
}

export function useToday(): TodayInfo {
  const s = useApp();
  // Recompute when the relevant slices change.
  return useMemo(() => computeToday(s), [s.plan, s.checkIns, s.sessions, s.todayChoice, s.profile, s.customToday]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function useBenchmarks() {
  const { sessions, startingLifts, profile } = useApp();
  return useMemo(() => {
    if (!profile) return { benchmarks: [], muscles: [], weaknesses: [] };
    const benchmarks = computeBenchmarks({ sessions, startingLifts, bodyweightKg: profile.weightKg, sex: profile.sex, age: profile.age });
    const muscles = assessMuscles(benchmarks);
    return { benchmarks, muscles, weaknesses: relativeWeaknesses(muscles) };
  }, [sessions, startingLifts, profile]);
}

export function useNutrition() {
  const { profile, calorieAdjustment, weights } = useApp();
  return useMemo(() => {
    if (!profile) return null;
    const plan = nutritionTargets({
      sex: profile.sex,
      weightKg: profile.weightKg,
      heightCm: profile.heightCm,
      age: profile.age,
      activityLevel: profile.activityLevel,
      trainingDays: profile.daysPerWeek,
      sessionMinutes: profile.sessionMinutes,
      focus: profile.primaryFocus,
      direction: profile.weightDirection,
      adjustmentKcal: calorieAdjustment,
    });
    const trend = weightTrend(weights);
    const suggestion = trendAdjustment(trend, profile.weightDirection, profile.weightKg);
    return { plan, trend, suggestion };
  }, [profile, calorieAdjustment, weights]);
}
