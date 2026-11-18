import type { AthleticTest, TestResult } from "../types";

/**
 * Athletic qualities are tracked individually. We deliberately do NOT merge
 * jumps, sprints and strength into one "athletic score": no validated model
 * supports that, so each quality is reported on its own terms.
 */
export const TESTS: Record<AthleticTest, { label: string; unit: string; quality: string; lowerIsBetter: boolean; step: number; how: string }> = {
  vertical_jump: { label: "Vertical jump", unit: "cm", quality: "Lower-body power", lowerIsBetter: false, step: 1, how: "Stand side-on to a wall, reach, then jump and touch as high as you can. Best of 3." },
  broad_jump: { label: "Broad jump", unit: "cm", quality: "Horizontal power", lowerIsBetter: false, step: 1, how: "Two-foot take-off, stick the landing, measure to the back heel. Best of 3." },
  sprint_10m: { label: "10 m sprint", unit: "s", quality: "Acceleration", lowerIsBetter: true, step: 0.01, how: "Standing start, timed by a partner or a phone video. Best of 3, full rest between." },
  pull_up_max: { label: "Max pull-ups", unit: "reps", quality: "Relative upper-body strength", lowerIsBetter: false, step: 1, how: "Dead hang to chin over bar, no kipping. One all-out set." },
  push_up_max: { label: "Max push-ups", unit: "reps", quality: "Muscular endurance", lowerIsBetter: false, step: 1, how: "Chest to fist height, full lockout. One continuous set." },
  row_1k: { label: "1 km row", unit: "s", quality: "Anaerobic conditioning", lowerIsBetter: true, step: 1, how: "Damper 4–6, all-out 1000 m on a rowing machine." },
};

export const TEST_ORDER: AthleticTest[] = ["vertical_jump", "broad_jump", "sprint_10m", "pull_up_max", "push_up_max", "row_1k"];

export interface TestTrend {
  test: AthleticTest;
  latest: TestResult;
  first: TestResult;
  best: TestResult;
  changePct: number | null;
  direction: "improved" | "stable" | "declined" | "new";
  sentence: string;
}

export function testTrend(results: TestResult[], test: AthleticTest): TestTrend | null {
  const rs = results.filter((r) => r.test === test).sort((a, b) => a.date.localeCompare(b.date));
  if (!rs.length) return null;
  const def = TESTS[test];
  const first = rs[0];
  const latest = rs[rs.length - 1];
  const best = rs.reduce((b, r) => ((def.lowerIsBetter ? r.value < b.value : r.value > b.value) ? r : b), rs[0]);
  if (rs.length === 1)
    return { test, latest, first, best, changePct: null, direction: "new", sentence: `Baseline recorded. Re-test in 4–6 weeks to see how your ${def.quality.toLowerCase()} responds.` };
  const raw = ((latest.value - first.value) / first.value) * 100;
  const changePct = def.lowerIsBetter ? -raw : raw;
  const threshold = test === "sprint_10m" ? 1.5 : 3; // below typical test noise = stable
  const direction = changePct > threshold ? "improved" : changePct < -threshold ? "declined" : "stable";
  const sentence =
    direction === "improved"
      ? `${def.quality} is up ${changePct.toFixed(0)}% since your first test.`
      : direction === "declined"
        ? `${def.quality} is down ${Math.abs(changePct).toFixed(0)}%. Fatigue on test day, or less explosive work recently, can both explain it.`
        : `${def.quality} has held steady. Changes this small are within normal test-to-test variation.`;
  return { test, latest, first, best, changePct: Math.round(changePct * 10) / 10, direction, sentence };
}
