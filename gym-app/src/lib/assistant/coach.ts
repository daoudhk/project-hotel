import type { FocusId, PlanDay, TrainingPlan } from "../types";
import type { AppState } from "../store/store";
import { computeToday } from "../store/derived";
import { EXERCISES, getExercise } from "../data/exercises";
import { FOCUS, FOCUS_ORDER, describeFocusChange, describeTradeoffs } from "../engine/focus";
import { fitToTime } from "../engine/planner";
import { alternatives } from "../engine/recovery";
import { assessMuscles, computeBenchmarks, STANDARDS, relativeWeaknesses } from "../engine/strength";
import { exerciseHistory, recommend } from "../engine/progression";
import { nutritionTargets } from "../engine/nutrition";
import { recentSetsByMuscle, strengthChange } from "../engine/analytics";
import { MUSCLE_LABEL } from "../format";

/**
 * The coach's reasoning layer. Every answer is derived from the deterministic
 * engine and the user's own data, and labelled with what kind of claim it is.
 * A language model (server-side, see app/api/coach) can rephrase these answers
 * conversationally, but the facts and any proposed changes come from here.
 */

export type Basis = "rule" | "estimate" | "uncertain" | "data";

export type Proposal =
  | { kind: "shorten"; minutes: number; day: PlanDay; summary: string[] }
  | { kind: "swap"; dayId: string; slotId: string; from: string; to: string }
  | { kind: "focus"; primary: FocusId; secondary: FocusId[]; summary: string[] }
  | { kind: "calories"; kcal: number };

export interface CoachAnswer {
  text: string;
  basis: Basis;
  proposal?: Proposal;
  followUps?: string[];
}

export const STARTER_QUESTIONS: Record<string, string[]> = {
  today: ["Why am I training this today?", "Can you make today's workout 30 minutes?", "Should I train or recover today?"],
  train: ["Can I replace deadlifts?", "Should I increase my squat weight?", "Why this weight?"],
  progress: ["How strong is my bench compared to people my size?", "Why haven't my shoulders improved?", "What's my weakest area?"],
  nutrition: ["How much protein should I eat?", "Am I eating enough?", "What should I eat before training?"],
  you: ["Can I focus more on boxing this month?", "What does my plan prioritise?", "How do I change my training days?"],
};

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9\s-]/g, " ");

function mentionedExercise(q: string, pool?: string[]): string | null {
  const candidates = (pool ?? EXERCISES.map((e) => e.id)).map(getExercise);
  let best: { id: string; s: number } | null = null;
  for (const e of candidates) {
    const name = norm(e.name);
    const words = name.split(/\s+/).filter((w) => w.length > 3);
    let s = q.includes(name) ? 10 : 0;
    for (const w of words) if (q.includes(w.replace(/s$/, ""))) s += 2;
    if (e.id.includes("deadlift") && q.includes("deadlift")) s += 3;
    if (s > 0 && (!best || s > best.s)) best = { id: e.id, s };
  }
  return best && best.s >= 2 ? best.id : null;
}

function mentionedFocus(q: string): FocusId | null {
  const map: [RegExp, FocusId][] = [
    [/\bmma\b|mixed martial/, "mma"],
    [/box(ing)?\b/, "boxing"],
    [/football|soccer/, "soccer"],
    [/\bpolo\b/, "polo"],
    [/basketball/, "basketball"],
    [/running|endurance|marathon|\brun\b/, "endurance"],
    [/hypertroph|muscle growth|bodybuild|physique/, "hypertrophy"],
    [/explosive|athletic perf/, "explosive"],
    [/powerlift|\bstrength\b/, "strength"],
    [/hybrid/, "hybrid"],
    [/general fitness/, "general"],
  ];
  for (const [re, f] of map) if (re.test(q)) return f;
  return null;
}

export function answer(question: string, s: AppState, now = new Date()): CoachAnswer {
  const q = norm(question);
  const p = s.profile;
  if (!p || !s.plan) return { text: "Finish setting up your profile first and I'll have a plan and answers ready.", basis: "rule" };
  const t = computeToday(s, now);
  const today = t.adapted?.day ?? null;
  const benchmarks = computeBenchmarks({ sessions: s.sessions, startingLifts: s.startingLifts, bodyweightKg: p.weightKg, sex: p.sex, age: p.age, now });

  // ── Shorten the session ─────────────────────────────────────────
  const minutes = q.match(/(\d{2,3})\s*(min|minute)/);
  if ((minutes || /shorter|less time|short on time|quick/.test(q)) && today) {
    const m = minutes ? Math.max(15, Math.min(120, Number(minutes[1]))) : 30;
    const fitted = fitToTime(today.slots, m);
    const removed = today.slots.filter((x) => !fitted.slots.some((y) => y.id === x.id)).map((x) => getExercise(x.exerciseId).name);
    const summary = [
      `Main lifts stay: ${fitted.slots.filter((x) => x.role === "main").map((x) => getExercise(x.exerciseId).name).join(", ") || "the key movements"}.`,
      removed.length ? `Removed: ${removed.join(", ")}.` : "Accessory sets trimmed.",
      `Estimated time about ${fitted.minutes} minutes.`,
    ];
    return {
      text: `Here's today's ${today.title} cut to about ${m} minutes. I kept the work that drives progress and trimmed the lower-priority pieces.`,
      basis: "rule",
      proposal: { kind: "shorten", minutes: m, day: { ...today, slots: fitted.slots, estMinutes: fitted.minutes }, summary },
    };
  }

  // ── Replace / swap an exercise ──────────────────────────────────
  if (/replace|swap|substitut|instead of|alternative|can i skip|dont like|hate/.test(q)) {
    const todayIds = today?.slots.map((x) => x.exerciseId);
    const id = mentionedExercise(q, todayIds) ?? mentionedExercise(q);
    if (id) {
      const alts = alternatives(id, p.equipment, p.limitations, 3);
      const ex = getExercise(id);
      if (!alts.length) return { text: `I couldn't find a good substitute for ${ex.name} with your equipment. You can skip it today without losing much.`, basis: "rule" };
      const slot = today?.slots.find((x) => x.exerciseId === id);
      const planDay = s.plan.days.find((d) => d.slots.some((x) => x.exerciseId === id));
      const targetDay = slot ? today! : planDay;
      const targetSlot = slot ?? planDay?.slots.find((x) => x.exerciseId === id);
      return {
        text: `Yes. ${getExercise(alts[0]).name} trains the same ${ex.primary.map((m) => MUSCLE_LABEL[m].toLowerCase()).join(" and ")} with ${getExercise(alts[0]).equipment.filter((e) => e !== "bodyweight").join(", ") || "no equipment"}. Other good options: ${alts.slice(1).map((a) => getExercise(a).name).join(", ")}.`,
        basis: "rule",
        proposal: targetDay && targetSlot ? { kind: "swap", dayId: targetDay.id, slotId: targetSlot.id, from: id, to: alts[0] } : undefined,
      };
    }
    return { text: "Which exercise would you like to replace? Name it and I'll suggest options that fit your equipment.", basis: "rule" };
  }

  // ── Strength comparison ─────────────────────────────────────────
  if (/how strong|compare|compared|strength level|people my size|benchmark|level/.test(q)) {
    const id = mentionedExercise(q);
    const lift = id ? getExercise(id).benchmark : undefined;
    const b = lift ? benchmarks.find((x) => x.lift === lift) : benchmarks[0];
    if (!b)
      return {
        text: `I don't have enough data for ${lift ? STANDARDS[lift].label.toLowerCase() : "a benchmark"} yet. Log a working set (or add a starting point in Progress) and I'll estimate it.`,
        basis: "uncertain",
      };
    const unit = STANDARDS[b.lift].unit;
    const ratio = unit === "ratio" ? ` That's ${(b.best / p.weightKg).toFixed(2)}× your body weight.` : "";
    return {
      text: `${b.label}: ${unit === "ratio" ? `estimated max about ${Math.round(b.best)} kg` : `${b.best} strict reps`}, which puts you at ${b.classification.level} level for your body weight${p.age > 40 ? " and age" : ""}.${ratio} Next milestone: ${b.milestoneLabel}. Levels come from published bodyweight-ratio standards and aren't population percentiles. Confidence: ${b.confidence}.`,
      basis: "estimate",
    };
  }

  // ── Muscle not improving ───────────────────────────────────────
  const muscleHit = (Object.keys(MUSCLE_LABEL) as (keyof typeof MUSCLE_LABEL)[]).find((m) => q.includes(m) || q.includes(MUSCLE_LABEL[m].toLowerCase()) || (m === "quads" && q.includes("leg")));
  if (muscleHit && /improv|progress|behind|weak|lagging|grow|not getting/.test(q)) {
    const sets = recentSetsByMuscle(s.sessions, 7, now)[muscleHit as keyof ReturnType<typeof recentSetsByMuscle>] ?? 0;
    const planned = s.plan.weeklySets[muscleHit as keyof TrainingPlan["weeklySets"]] ?? 0;
    const assess = assessMuscles(benchmarks).find((a) => a.muscle === muscleHit);
    const keyEx = EXERCISES.find((e) => e.benchmark && e.primary.includes(muscleHit as never));
    const change = keyEx ? strengthChange(s.sessions, keyEx.id, now) : null;
    const parts: string[] = [];
    parts.push(`Your ${MUSCLE_LABEL[muscleHit].toLowerCase()} got about ${Math.round(sets)} hard sets in the last 7 days (plan: ${planned}).`);
    if (change) parts.push(`${getExercise(change.exerciseId).name} estimated max went from ${Math.round(change.from)} to ${Math.round(change.to)} kg over ${change.weeks} weeks (${change.pct > 0 ? "+" : ""}${change.pct}%).`);
    if (sets < 8) parts.push("That's on the low side for growth. Most people respond best to roughly 10–20 sets per week.");
    else parts.push("Volume looks reasonable, so the next levers are effort (finishing sets 1–2 reps from failure), sleep, and enough protein.");
    if (assess?.level) parts.push(`Relative to your other lifts, it rates ${assess.level} (${assess.confidence} confidence).`);
    else parts.push("I don't have a benchmark lift for it yet, so this is based on training volume only.");
    return { text: parts.join(" "), basis: change ? "data" : "uncertain" };
  }

  // ── Should I increase weight? ──────────────────────────────────
  if (/increase|go up|add weight|heavier|why this weight|weight today/.test(q)) {
    const id = mentionedExercise(q, today?.slots.map((x) => x.exerciseId)) ?? mentionedExercise(q) ?? today?.slots.find((x) => x.role === "main")?.exerciseId;
    if (id) {
      const ex = getExercise(id);
      const slot = s.plan.days.flatMap((d) => d.slots).find((x) => x.exerciseId === id);
      const rx = slot?.prescription ?? { sets: 3, repsMin: 6, repsMax: 10, rpe: 8, restSec: 120 };
      const rec = recommend({ exercise: ex, prescription: rx, history: exerciseHistory(s.sessions, id) });
      return {
        text: `${ex.name}: ${rec.weight ? `${rec.weight} kg for ${rx.repsMin}–${rx.repsMax} reps` : "pick a weight with 2–3 reps in reserve"}. ${rec.reason} You can always override it in the session.`,
        basis: rec.previous ? "data" : "rule",
      };
    }
  }

  // ── Focus change ───────────────────────────────────────────────
  const f = mentionedFocus(q);
  if (f && /focus|switch|change|more|train for|prioriti|month/.test(q)) {
    const asSecondary = /more|also|bit|month|add/.test(q) && f !== p.primaryFocus;
    const primary = asSecondary ? p.primaryFocus : f;
    const secondary = asSecondary ? Array.from(new Set([f, ...p.secondaryFocus])).slice(0, 2) : p.secondaryFocus.filter((x) => x !== f);
    const change = describeFocusChange(p.primaryFocus, f);
    const summary = asSecondary
      ? [`${FOCUS[f].label} becomes a secondary focus alongside ${FOCUS[p.primaryFocus].label}.`, ...describeTradeoffs(primary, [f])]
      : [`New priorities: ${change.gained.join(", ")}.`, change.reduced.length ? `Less emphasis on: ${change.reduced.join(", ")}.` : "", "Your history, records and benchmarks are kept."].filter(Boolean);
    return {
      text: asSecondary
        ? `Sure. I can add ${FOCUS[f].label} as a secondary focus. Your plan stays built around ${FOCUS[p.primaryFocus].short} but adds ${FOCUS[f].priorities.slice(0, 2).join(" and ").toLowerCase()} work.`
        : `Switching your main focus to ${FOCUS[f].label} would reshape your week around ${FOCUS[f].priorities.slice(0, 3).join(", ").toLowerCase()}.`,
      basis: "rule",
      proposal: { kind: "focus", primary, secondary, summary },
    };
  }

  // ── Why this session / train or recover ────────────────────────
  if (/why|today|train or recover|should i train|rest day|recover/.test(q)) {
    if (!t.isTrainingDay || !today)
      return {
        text: `Today is a planned rest day. Recovery is when adaptation happens. Your next session is ${t.nextDay?.title ?? "coming up"}${t.daysUntilNext === 1 ? " tomorrow" : ""}. A walk or light mobility is a good idea.`,
        basis: "rule",
      };
    const changes = t.adapted?.changes ?? [];
    const lead = changes.length ? changes.join(" ") : `${today.title} is next in your ${s.plan.splitName} rotation.`;
    const why =
      today.emphasis === "lower" || today.emphasis === "legs"
        ? "Spacing leg sessions about 72 hours apart lets them recover between hard days."
        : today.emphasis === "upper" || today.emphasis === "push" || today.emphasis === "pull"
          ? "Upper and lower days alternate so each half of your body recovers while the other trains."
          : today.emphasis === "recovery"
            ? ""
            : `It fits your ${FOCUS[p.primaryFocus].short} priorities: ${FOCUS[p.primaryFocus].priorities.slice(0, 2).join(" and ").toLowerCase()}.`;
    const ready = t.readiness.status === "ready" ? (t.checkIn ? " Your check-in looks good." : " Log a quick check-in and I'll adjust if anything is sore.") : ` ${t.readiness.headline}`;
    return { text: `${lead} ${why}${ready}`.replace(/\s+/g, " ").trim(), basis: "rule" };
  }

  // ── Nutrition ──────────────────────────────────────────────────
  if (/protein|calorie|eat|carb|fat|nutrition|diet|food|hungry|meal/.test(q)) {
    const n = nutritionTargets({ sex: p.sex, weightKg: p.weightKg, heightCm: p.heightCm, age: p.age, activityLevel: p.activityLevel, trainingDays: p.daysPerWeek, sessionMinutes: p.sessionMinutes, focus: p.primaryFocus, direction: p.weightDirection, adjustmentKcal: s.calorieAdjustment });
    if (/protein/.test(q))
      return { text: `About ${n.average.protein} g a day, roughly ${(n.average.protein / p.weightKg).toFixed(1)} g per kg of body weight. Spread it over 3–5 meals of 25–50 g each to support repair and growth.`, basis: "rule" };
    if (/before|pre/.test(q))
      return { text: "2–3 hours before training: a normal meal with carbohydrate and some protein, like rice, chicken and vegetables. Within an hour: something light and carb-based, like a banana or toast with honey.", basis: "rule" };
    return {
      text: `Your estimated targets: about ${n.trainingDay.kcal} kcal on training days and ${n.restDay.kcal} on rest days, with ${n.average.protein} g protein. These are estimates from your size and activity. I'll refine them once a few weeks of weigh-ins show your real trend.`,
      basis: "estimate",
    };
  }

  // ── Weakest area ───────────────────────────────────────────────
  if (/weak|behind|imbalance|lagging/.test(q)) {
    const w = relativeWeaknesses(assessMuscles(benchmarks));
    if (!w.length) return { text: "I need benchmarks from at least three areas to compare them fairly. Log squat, bench and a pull (row or pull-up) and I'll show where you're relatively behind.", basis: "uncertain" };
    return { text: `Relative to your other lifts, your ${w.map((x) => MUSCLE_LABEL[x.muscle].toLowerCase()).join(" and ")} ${w.length > 1 ? "are" : "is"} behind. These are estimates from lift performance, not measurements of muscle size.`, basis: "estimate" };
  }

  if (/priorit|what does my plan/.test(q)) {
    return { text: `Your plan is built for ${FOCUS[p.primaryFocus].label}${p.secondaryFocus.length ? ` with ${p.secondaryFocus.map((x) => FOCUS[x].short).join(" and ")}` : ""}: ${FOCUS[p.primaryFocus].priorities.slice(0, 4).join(", ").toLowerCase()}. ${s.plan.rationale[0]}`, basis: "rule" };
  }
  if (/training days|schedule|days per week/.test(q)) {
    return { text: "Go to You → Training to change your days or session length. I'll rebuild the plan and keep all your history.", basis: "rule" };
  }

  return {
    text: "I can help with today's session, swapping exercises, strength comparisons, progress, recovery and nutrition. Try one of these:",
    basis: "uncertain",
    followUps: ["Why am I training this today?", "How strong is my bench compared to people my size?", "How much protein should I eat?"],
  };
}

export const FOCUS_OPTIONS = FOCUS_ORDER;
