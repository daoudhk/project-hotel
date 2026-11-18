import type { ActivityLevel, BodyWeightEntry, FocusId, MealEntry, Sex, WeightDirection } from "../types";

/**
 * Energy and macronutrient targets.
 *  - Resting energy: Mifflin–St Jeor equation.
 *  - Total energy: resting energy × activity factor (lifestyle + training).
 *  - Protein: 1.6–2.2 g/kg depending on goal (ISSN position stand range).
 *  - Fat: ~25% of energy, never below 0.6 g/kg.
 *  - Carbohydrate: the remainder, shifted toward training days.
 * Targets are estimates. They're refined using the athlete's real weight trend.
 */

export function bmr(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const s = sex === "male" ? 5 : sex === "female" ? -161 : -78;
  return base + s;
}

const LIFESTYLE: Record<ActivityLevel, number> = { sedentary: 1.2, light: 1.3, active: 1.4, very_active: 1.5 };

export function activityFactor(level: ActivityLevel, trainingDays: number, sessionMinutes: number): number {
  // ~0.035 per 60-minute session per week, capped.
  const training = Math.min(0.35, trainingDays * (sessionMinutes / 60) * 0.035);
  return LIFESTYLE[level] + training;
}

export function proteinPerKg(focus: FocusId, direction: WeightDirection): number {
  if (direction === "lose") return 2.2;
  if (focus === "hypertrophy" || focus === "strength" || focus === "hybrid") return 2.0;
  if (focus === "endurance") return 1.6;
  return 1.8;
}

export interface MacroTargets {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface NutritionPlan {
  bmr: number;
  tdee: number;
  average: MacroTargets;
  trainingDay: MacroTargets;
  restDay: MacroTargets;
  hydrationMl: number;
  explanation: string[];
}

export function nutritionTargets(p: {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  age: number;
  activityLevel: ActivityLevel;
  trainingDays: number;
  sessionMinutes: number;
  focus: FocusId;
  direction: WeightDirection;
  /** Manual calorie adjustment from trend-based review. */
  adjustmentKcal?: number;
}): NutritionPlan {
  const b = bmr(p.sex, p.weightKg, p.heightCm, p.age);
  const tdee = b * activityFactor(p.activityLevel, p.trainingDays, p.sessionMinutes);
  const dirDelta = p.direction === "lose" ? -Math.min(500, tdee * 0.15) : p.direction === "gain" ? Math.min(350, tdee * 0.1) : 0;
  const avgKcal = round10(tdee + dirDelta + (p.adjustmentKcal ?? 0));

  const protein = Math.round(proteinPerKg(p.focus, p.direction) * p.weightKg);
  const fat = Math.round(Math.max(0.6 * p.weightKg, (avgKcal * 0.25) / 9));
  const carbs = Math.max(0, Math.round((avgKcal - protein * 4 - fat * 9) / 4));
  const average = { kcal: avgKcal, protein, carbs, fat };

  // Shift carbohydrate toward training days, keeping the weekly average.
  const d = Math.max(0, Math.min(7, p.trainingDays));
  const shiftKcal = d > 0 && d < 7 ? Math.min(250, avgKcal * 0.08) : 0;
  const trainKcal = avgKcal + shiftKcal;
  const restKcal = d > 0 && d < 7 ? avgKcal - (shiftKcal * d) / (7 - d) : avgKcal;
  const trainingDay = { ...average, kcal: round10(trainKcal), carbs: Math.round(carbs + shiftKcal / 4) };
  const restDay = { ...average, kcal: round10(restKcal), carbs: Math.max(0, Math.round(carbs - (shiftKcal * d) / (7 - d || 1) / 4)) };

  const hydrationMl = Math.round((p.weightKg * 35 + (p.trainingDays / 7) * (p.sessionMinutes / 60) * 600) / 50) * 50;

  const explanation = [
    `Estimated resting energy is about ${Math.round(b)} kcal (Mifflin–St Jeor), rising to roughly ${Math.round(tdee)} kcal with your activity and ${p.trainingDays} training days.`,
    p.direction === "lose"
      ? `A moderate deficit of about ${Math.round(-dirDelta)} kcal supports fat loss while protecting training quality.`
      : p.direction === "gain"
        ? `A small surplus of about ${Math.round(dirDelta)} kcal supports muscle gain while limiting fat gain.`
        : "Calories are set to maintain your weight.",
    `Protein at ${proteinPerKg(p.focus, p.direction)} g per kg supports muscle repair and growth.`,
    "Training days carry more carbohydrate to fuel the session. Rest days carry a little less.",
  ];
  if (p.adjustmentKcal) explanation.push(`Includes a ${p.adjustmentKcal > 0 ? "+" : ""}${p.adjustmentKcal} kcal adjustment from your weight trend.`);

  return { bmr: Math.round(b), tdee: Math.round(tdee), average, trainingDay, restDay, hydrationMl, explanation };
}

function round10(x: number) {
  return Math.round(x / 10) * 10;
}

export function sumMeals(meals: MealEntry[]): MacroTargets {
  return meals.reduce(
    (a, m) => ({ kcal: a.kcal + m.kcal, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export interface WeightTrend {
  /** kg per week, from a least-squares fit. */
  ratePerWeek: number;
  /** Smoothed current weight (7-day average). */
  current: number;
  days: number;
  entries: number;
}

export function weightTrend(entries: BodyWeightEntry[], now = new Date(), windowDays = 21): WeightTrend | null {
  const since = now.getTime() - windowDays * 86400000;
  const pts = entries
    .map((e) => ({ t: new Date(e.date).getTime(), kg: e.kg }))
    .filter((p) => p.t >= since && p.t <= now.getTime())
    .sort((a, b) => a.t - b.t);
  if (pts.length < 4) return null;
  const span = (pts[pts.length - 1].t - pts[0].t) / 86400000;
  if (span < 7) return null;
  const xs = pts.map((p) => (p.t - pts[0].t) / 86400000);
  const ys = pts.map((p) => p.kg);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const slopePerDay = den ? num / den : 0;
  const last7 = pts.filter((p) => p.t >= now.getTime() - 7 * 86400000);
  const current = (last7.length ? last7 : pts.slice(-3)).reduce((a, p) => a + p.kg, 0) / (last7.length || Math.min(3, pts.length));
  return { ratePerWeek: Math.round(slopePerDay * 7 * 100) / 100, current: Math.round(current * 10) / 10, days: Math.round(span), entries: pts.length };
}

/** Suggest a calorie adjustment by comparing the real trend to the goal. */
export function trendAdjustment(trend: WeightTrend | null, direction: WeightDirection, weightKg: number): { kcal: number; message: string } | null {
  if (!trend) return null;
  const pct = (trend.ratePerWeek / weightKg) * 100; // % body weight per week
  if (direction === "lose") {
    if (pct > -0.2) return { kcal: -150, message: `Your weight has been roughly stable (${fmtRate(trend.ratePerWeek)}/week). A 150 kcal reduction should restart gradual loss.` };
    if (pct < -1.0) return { kcal: 150, message: `You're losing quickly (${fmtRate(trend.ratePerWeek)}/week). Adding 150 kcal helps protect muscle and training quality.` };
  }
  if (direction === "gain") {
    if (pct < 0.1) return { kcal: 150, message: `Your weight isn't rising (${fmtRate(trend.ratePerWeek)}/week). Adding 150 kcal should support muscle gain.` };
    if (pct > 0.5) return { kcal: -100, message: `You're gaining faster than needed (${fmtRate(trend.ratePerWeek)}/week). Trimming 100 kcal keeps it lean.` };
  }
  if (direction === "maintain" && Math.abs(pct) > 0.35) {
    const k = pct > 0 ? -100 : 100;
    return { kcal: k, message: `Your weight is drifting (${fmtRate(trend.ratePerWeek)}/week). A ${k > 0 ? "+" : ""}${k} kcal tweak keeps it steady.` };
  }
  return null;
}

function fmtRate(r: number) {
  return `${r > 0 ? "+" : ""}${r.toFixed(2)} kg`;
}
