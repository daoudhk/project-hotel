import { describe, expect, it } from "vitest";
import { EXERCISES, getExercise, EQUIPMENT_PRESETS } from "../data/exercises";
import type { CheckIn, WorkoutSession } from "../types";
import { generatePlan, type PlanInput } from "./planner";
import { recommend, adjustForReadiness, exerciseHistory } from "./progression";
import { classify, computeBenchmarks, estimate1RM, assessMuscles, benchmarkValue } from "./strength";
import { adaptDay, assessReadiness, alternatives } from "./recovery";
import { bmr, nutritionTargets, weightTrend, trendAdjustment } from "./nutrition";
import { parseMealDescription } from "./mealParser";
import { testTrend } from "./performance";
import { strengthChange, consistencyStreak } from "./analytics";
import { blendFocus, describeFocusChange } from "./focus";

const base: PlanInput = {
  primaryFocus: "general",
  secondaryFocus: [],
  daysPerWeek: 4,
  sessionMinutes: 60,
  equipment: EQUIPMENT_PRESETS.full_gym.equipment,
  experience: "experienced",
  limitations: [],
};

const NOW = new Date("2026-06-01T09:00:00Z");

function session(id: string, daysAgo: number, exerciseId: string, sets: [number, number, number?][], extra: Partial<WorkoutSession> = {}): WorkoutSession {
  const d = new Date(NOW.getTime() - daysAgo * 86400000).toISOString();
  return {
    id,
    dayId: "d",
    title: "T",
    startedAt: d,
    finishedAt: d,
    adjustments: [],
    exercises: [
      {
        slotId: "s",
        exerciseId,
        role: "main",
        prescription: { sets: sets.length, repsMin: 8, repsMax: 10, rpe: 8, restSec: 120 },
        recommendedWeight: null,
        recommendationReason: "",
        sets: sets.map(([weight, reps, rpe]) => ({ weight, reps, rpe, done: true })),
      },
    ],
    ...extra,
  };
}

describe("exercise database", () => {
  it("has unique ids and valid references", () => {
    const ids = new Set(EXERCISES.map((e) => e.id));
    expect(ids.size).toBe(EXERCISES.length);
    expect(EXERCISES.length).toBeGreaterThan(70);
  });
});

describe("1RM and benchmarks", () => {
  it("matches the bench example: 70 kg × 8 at 75 kg body weight", () => {
    const e = estimate1RM(70, 8)!;
    expect(Math.round(e)).toBe(89);
    const c = classify("bench_press", e / 75, "male", 30);
    expect(c.level).toBe("Intermediate");
    const [b] = computeBenchmarks({
      sessions: [],
      startingLifts: [{ lift: "bench_press", weight: 70, reps: 8, date: NOW.toISOString() }],
      bodyweightKg: 75,
      sex: "male",
      age: 30,
      now: NOW,
    });
    expect(b.milestone).toBe(95);
    expect(b.confidence).toBe("medium");
  });

  it("does not estimate beyond 15 reps", () => {
    expect(estimate1RM(40, 20)).toBeNull();
    expect(estimate1RM(100, 1)).toBe(100);
  });

  it("converts weighted pull-ups into equivalent bodyweight reps", () => {
    expect(benchmarkValue("pull_up", 0, 8, 80)).toBe(8);
    expect(benchmarkValue("pull_up", 20, 5, 80)!).toBeGreaterThan(10);
  });

  it("eases thresholds for masters athletes", () => {
    expect(classify("back_squat", 1.2, "male", 30).level).toBe("Novice");
    expect(classify("back_squat", 1.2, "male", 50).level).toBe("Intermediate");
  });

  it("marks muscles without evidence as unknown, never invented", () => {
    const m = assessMuscles([]);
    expect(m.every((x) => x.level === null)).toBe(true);
    const calves = assessMuscles(
      computeBenchmarks({ sessions: [], startingLifts: [{ lift: "back_squat", weight: 100, reps: 5, date: NOW.toISOString() }], bodyweightKg: 80, sex: "male", age: 30, now: NOW }),
    ).find((x) => x.muscle === "calves");
    expect(calves?.level).toBeNull();
  });
});

describe("plan generation", () => {
  it("is deterministic", () => {
    const a = generatePlan(base, NOW);
    const b = generatePlan(base, NOW);
    expect(a).toEqual(b);
  });

  it.each([1, 2, 3, 4, 5, 6])("builds %i training days that fit the session length", (days) => {
    const p = generatePlan({ ...base, daysPerWeek: days, sessionMinutes: 45 }, NOW);
    expect(p.days).toHaveLength(days);
    for (const d of p.days) {
      expect(d.slots.length).toBeGreaterThanOrEqual(2);
      expect(d.estMinutes).toBeLessThanOrEqual(50);
    }
  });

  it("only uses available equipment", () => {
    const p = generatePlan({ ...base, equipment: EQUIPMENT_PRESETS.minimal.equipment }, NOW);
    for (const d of p.days)
      for (const s of d.slots) {
        const ex = getExercise(s.exerciseId);
        expect(ex.equipment.every((e) => ["bodyweight", "bands"].includes(e))).toBe(true);
      }
  });

  it("respects limitations", () => {
    const p = generatePlan({ ...base, limitations: ["shoulder", "knee"] }, NOW);
    for (const d of p.days)
      for (const s of d.slots) {
        const ex = getExercise(s.exerciseId);
        expect(ex.stresses).not.toContain("shoulder");
        expect(ex.stresses).not.toContain("knee");
      }
  });

  it("makes MMA meaningfully different from hypertrophy", () => {
    const mma = generatePlan({ ...base, primaryFocus: "mma" }, NOW);
    const hyp = generatePlan({ ...base, primaryFocus: "hypertrophy" }, NOW);
    const ids = (p: typeof mma) => p.days.flatMap((d) => d.slots.map((s) => getExercise(s.exerciseId)));
    const mmaEx = ids(mma);
    const hypEx = ids(hyp);
    expect(mmaEx.some((e) => e.pattern === "rotation" || e.pattern === "throw")).toBe(true);
    expect(mmaEx.some((e) => e.pattern === "neck")).toBe(true);
    expect(mmaEx.some((e) => e.kind === "conditioning")).toBe(true);
    expect(hypEx.filter((e) => e.kind === "isolation").length).toBeGreaterThan(mmaEx.filter((e) => e.kind === "isolation" && e.pattern.startsWith("iso")).length);
    expect(hyp.days.every((d) => d.slots.every((s) => s.role !== "power"))).toBe(true);
  });

  it("strength focus prescribes low reps on main lifts", () => {
    const p = generatePlan({ ...base, primaryFocus: "strength" }, NOW);
    const mains = p.days.flatMap((d) => d.slots.filter((s) => s.role === "main"));
    expect(mains.every((s) => s.prescription.repsMax <= 5)).toBe(true);
  });

  it("football plans include sprinting and hamstring resilience", () => {
    const p = generatePlan({ ...base, primaryFocus: "soccer" }, NOW);
    const ex = p.days.flatMap((d) => d.slots.map((s) => getExercise(s.exerciseId)));
    expect(ex.some((e) => e.pattern === "sprint")).toBe(true);
    expect(ex.some((e) => e.primary.includes("hamstrings") && e.qualities.includes("resilience"))).toBe(true);
  });

  it("hybrid blends keep the primary dominant and explain tradeoffs", () => {
    const p = generatePlan({ ...base, primaryFocus: "mma", secondaryFocus: ["hypertrophy"] }, NOW);
    expect(p.tradeoffs.length).toBe(1);
    const f = blendFocus("mma", ["hypertrophy"]);
    expect(f.power).toBeGreaterThan(0.5);
  });

  it("avoids technical lifts for new lifters", () => {
    const p = generatePlan({ ...base, experience: "new", primaryFocus: "explosive" }, NOW);
    const ex = p.days.flatMap((d) => d.slots.map((s) => getExercise(s.exerciseId)));
    expect(ex.some((e) => e.id === "hang_power_clean")).toBe(false);
  });
});

describe("progressive overload", () => {
  const bench = getExercise("bench_press");
  const rx = { sets: 3, repsMin: 8, repsMax: 10, rpe: 8, restSec: 120 };

  it("increases after all reps are completed at manageable effort (60×10,10,10 → 62.5)", () => {
    const hist = exerciseHistory([session("a", 3, "bench_press", [[60, 10, 8], [60, 10, 8], [60, 10, 8.5]])], "bench_press");
    const r = recommend({ exercise: bench, prescription: rx, history: hist });
    expect(r.decision).toBe("increase");
    expect(r.weight).toBe(62.5);
    expect(r.repsMin).toBe(8);
    expect(r.repsMax).toBe(10);
  });

  it("holds when the reps were hit but effort was maximal", () => {
    const hist = exerciseHistory([session("a", 3, "bench_press", [[60, 10, 9.5], [60, 10, 10], [60, 10, 10]])], "bench_press");
    expect(recommend({ exercise: bench, prescription: rx, history: hist }).decision).toBe("hold");
  });

  it("asks for more reps inside the range", () => {
    const hist = exerciseHistory([session("a", 3, "bench_press", [[60, 10], [60, 9], [60, 8]])], "bench_press");
    const r = recommend({ exercise: bench, prescription: rx, history: hist });
    expect(r.decision).toBe("add_reps");
    expect(r.weight).toBe(60);
  });

  it("reduces only after two consecutive misses", () => {
    const one = exerciseHistory([session("a", 3, "bench_press", [[60, 7], [60, 6], [60, 6]])], "bench_press");
    expect(recommend({ exercise: bench, prescription: rx, history: one }).decision).toBe("hold");
    const two = exerciseHistory(
      [session("a", 3, "bench_press", [[60, 7], [60, 6], [60, 6]]), session("b", 7, "bench_press", [[60, 7], [60, 7], [60, 6]])],
      "bench_press",
    );
    const r = recommend({ exercise: bench, prescription: rx, history: two });
    expect(r.decision).toBe("reduce");
    expect(r.weight).toBe(55);
  });

  it("starts conservatively from an estimated max, or asks the user to pick", () => {
    const r = recommend({ exercise: bench, prescription: rx, history: [], e1rm: 100 });
    expect(r.weight).toBeLessThan(70);
    expect(r.weight! % 2.5).toBe(0);
    expect(recommend({ exercise: bench, prescription: rx, history: [] }).weight).toBeNull();
  });

  it("does not increase on reduced-readiness days", () => {
    const hist = exerciseHistory([session("a", 3, "bench_press", [[60, 10], [60, 10], [60, 10]])], "bench_press");
    const r = recommend({ exercise: bench, prescription: rx, history: hist });
    expect(adjustForReadiness(r, "moderate", 2.5).weight).toBe(60);
    expect(adjustForReadiness(r, "low", 2.5).weight).toBe(55);
  });
});

describe("recovery", () => {
  const plan = generatePlan(base, NOW);
  const lower = plan.days.find((d) => d.emphasis === "lower")!;

  it("Flow E: severe leg soreness + poor sleep → lighter day with explanation", () => {
    const ci: CheckIn = { id: "c", date: "2026-06-01", soreness: { quads: 3, hamstrings: 3, glutes: 3 }, sleepHours: 5, sleepQuality: 1 };
    const r = assessReadiness(ci, [], NOW);
    expect(r.status).toBe("low");
    const a = adaptDay({ day: lower, allDays: plan.days, checkIn: ci, readiness: r, equipment: base.equipment, limitations: [] });
    expect(a.day.emphasis).toBe("recovery");
    expect(a.changes.join(" ")).toMatch(/recovery/i);
  });

  it("swaps a leg day for an upper day when only legs are very sore", () => {
    const ci: CheckIn = { id: "c", date: "2026-06-01", soreness: { quads: 3, glutes: 3 }, sleepHours: 8, energy: 4 };
    const r = assessReadiness(ci, [], NOW);
    expect(r.status).toBe("ready");
    const a = adaptDay({ day: lower, allDays: plan.days, checkIn: ci, readiness: r, equipment: base.equipment, limitations: [] });
    expect(a.day.emphasis).toBe("upper");
    expect(a.swappedFromDayId).toBe(lower.id);
    expect(a.changes[0]).toMatch(/swapped/);
  });

  it("flags sharp pain for professional assessment without diagnosing", () => {
    const r = assessReadiness({ id: "c", date: "x", soreness: {}, pain: { area: "left knee", severity: "sharp", persistent: false } }, [], NOW);
    expect(r.painWarning).toMatch(/physiotherapist|doctor/);
  });

  it("suggests equipment-appropriate alternatives", () => {
    const alts = alternatives("bench_press", EQUIPMENT_PRESETS.home_gym.equipment, []);
    expect(alts.length).toBeGreaterThan(0);
    expect(alts).not.toContain("bench_press");
    for (const id of alts) expect(getExercise(id).equipment).not.toContain("barbell");
  });
});

describe("nutrition", () => {
  it("computes Mifflin–St Jeor", () => {
    expect(bmr("male", 80, 180, 30)).toBe(1780);
    expect(bmr("female", 60, 165, 30)).toBeCloseTo(1320.25, 1);
  });

  it("keeps the weekly average when shifting carbs to training days", () => {
    const n = nutritionTargets({ sex: "male", weightKg: 80, heightCm: 180, age: 30, activityLevel: "light", trainingDays: 4, sessionMinutes: 60, focus: "hypertrophy", direction: "gain" });
    const weekly = n.trainingDay.kcal * 4 + n.restDay.kcal * 3;
    expect(Math.abs(weekly / 7 - n.average.kcal)).toBeLessThan(15);
    expect(n.average.protein).toBe(160);
    const macroKcal = n.average.protein * 4 + n.average.carbs * 4 + n.average.fat * 9;
    expect(Math.abs(macroKcal - n.average.kcal)).toBeLessThan(20);
  });

  it("detects a stalled cut and suggests a small change", () => {
    const entries = Array.from({ length: 15 }, (_, i) => ({ date: new Date(NOW.getTime() - (14 - i) * 86400000).toISOString(), kg: 80 + (i % 2 ? 0.2 : -0.2) }));
    const t = weightTrend(entries, NOW)!;
    expect(Math.abs(t.ratePerWeek)).toBeLessThan(0.2);
    expect(trendAdjustment(t, "lose", 80)?.kcal).toBe(-150);
    expect(weightTrend(entries.slice(0, 2), NOW)).toBeNull();
  });

  it("parses meals into editable matches and never invents unknown foods", () => {
    const r = parseMealDescription("2 eggs, 2 slices of toast and a banana with some unicorn stew");
    expect(r.items.map((i) => i.food.id)).toEqual(["egg", "bread", "banana"]);
    expect(r.items[0].servings).toBe(2);
    expect(r.unrecognised).toEqual(["some unicorn stew"]);
  });
});

describe("analytics & performance", () => {
  it("reports strength change over the window", () => {
    const ss = [0, 7, 14, 21, 28, 35].map((d, i) => session(`s${i}`, d, "back_squat", [[100 + (5 - i) * 2.5, 5]]));
    const c = strengthChange(ss, "back_squat", NOW)!;
    expect(c.pct).toBeGreaterThan(5);
  });

  it("treats small test changes as stable", () => {
    const t = testTrend(
      [
        { id: "1", test: "vertical_jump", date: "2026-04-01", value: 50 },
        { id: "2", test: "vertical_jump", date: "2026-05-15", value: 51 },
      ],
      "vertical_jump",
    )!;
    expect(t.direction).toBe("stable");
  });

  it("counts consistency streaks", () => {
    const ss = Array.from({ length: 12 }, (_, i) => session(`c${i}`, i * 3.5 + 7, "bench_press", [[60, 8]]));
    expect(consistencyStreak(ss, 2, NOW)).toBeGreaterThanOrEqual(5);
  });

  it("explains a focus change while keeping history", () => {
    const c = describeFocusChange("hypertrophy", "mma");
    expect(c.gained.length).toBeGreaterThan(0);
    expect(c.kept.join(" ")).toMatch(/history/);
  });
});
