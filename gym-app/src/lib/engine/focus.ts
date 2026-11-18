import type { FocusId, Muscle, Pattern, Quality } from "../types";

/**
 * Athletic focus profiles. These are the levers the planner pulls: which
 * qualities to favour when choosing exercises, how much power and
 * conditioning work to add, which sport-specific accessories to include and
 * how reps are prescribed. Everything here is plain data so it can be
 * reviewed by a coach without reading engine code.
 */
export interface FocusProfile {
  id: FocusId;
  label: string;
  short: string;
  tagline: string;
  priorities: string[];
  qualities: Partial<Record<Quality, number>>;
  /** Muscles that get extra weekly attention. */
  emphasisMuscles: Muscle[];
  /** Patterns this focus adds as accessories across the week. */
  specialPatterns: Pattern[];
  /** 0–1: how much of a session leans to explosive work. */
  power: number;
  /** 0–1: how much conditioning to include. */
  conditioning: number;
  /** Main-lift rep range. */
  mainReps: [number, number];
  accessoryReps: [number, number];
  /** Rough share of training that is aesthetic / hypertrophy-oriented. */
  defaultAestheticWeight: number;
  metrics: string[];
}

export const FOCUS: Record<FocusId, FocusProfile> = {
  general: {
    id: "general",
    label: "General Fitness",
    short: "General",
    tagline: "Stronger, fitter and healthier, week after week.",
    priorities: ["Full-body strength", "Aerobic fitness", "Mobility", "Consistency"],
    qualities: { max_strength: 1, hypertrophy: 1, conditioning: 1, mobility: 0.8, core_stability: 0.8 },
    emphasisMuscles: [],
    specialPatterns: ["carry"],
    power: 0.1,
    conditioning: 0.4,
    mainReps: [6, 10],
    accessoryReps: [10, 15],
    defaultAestheticWeight: 0.5,
    metrics: ["Consistency", "Strength", "Conditioning"],
  },
  hypertrophy: {
    id: "hypertrophy",
    label: "Muscle Growth",
    short: "Hypertrophy",
    tagline: "Build a balanced, muscular physique.",
    priorities: ["Progressive overload", "Weekly volume per muscle", "Balanced physique", "Recovery and nutrition"],
    qualities: { hypertrophy: 2, max_strength: 0.8 },
    emphasisMuscles: ["shoulders", "back", "chest", "quads"],
    specialPatterns: ["iso_arms", "iso_shoulders", "iso_legs", "calves"],
    power: 0,
    conditioning: 0.1,
    mainReps: [6, 10],
    accessoryReps: [10, 15],
    defaultAestheticWeight: 0.9,
    metrics: ["Weekly sets per muscle", "Strength", "Body weight"],
  },
  strength: {
    id: "strength",
    label: "Strength",
    short: "Strength",
    tagline: "Move more weight on the lifts that matter.",
    priorities: ["Squat, bench, deadlift and press", "Heavy, low-rep work", "Technical practice", "Recovery between heavy days"],
    qualities: { max_strength: 2, hypertrophy: 0.6, core_stability: 0.5 },
    emphasisMuscles: ["back", "quads", "hamstrings"],
    specialPatterns: ["carry", "core_anti"],
    power: 0.15,
    conditioning: 0.1,
    mainReps: [3, 5],
    accessoryReps: [6, 10],
    defaultAestheticWeight: 0.3,
    metrics: ["Estimated 1RM", "Relative strength", "Benchmark levels"],
  },
  mma: {
    id: "mma",
    label: "MMA",
    short: "MMA",
    tagline: "Powerful, durable and conditioned for every round.",
    priorities: ["Rotational power", "Explosive hip extension", "Core stability", "Grip strength", "Neck conditioning", "Conditioning", "Strength relative to body weight", "Mobility and injury prevention"],
    qualities: { power: 1.5, rotational_power: 1.6, core_stability: 1.3, grip: 1.3, conditioning: 1.3, max_strength: 1, resilience: 1, mobility: 0.8 },
    emphasisMuscles: ["core", "forearms", "back"],
    specialPatterns: ["rotation", "neck", "carry", "core_anti"],
    power: 0.8,
    conditioning: 0.8,
    mainReps: [4, 6],
    accessoryReps: [8, 12],
    defaultAestheticWeight: 0.25,
    metrics: ["Relative strength", "Power", "Conditioning", "Grip"],
  },
  boxing: {
    id: "boxing",
    label: "Boxing",
    short: "Boxing",
    tagline: "Transfer power from the floor to the fist.",
    priorities: ["Lower-body power transfer", "Rotational explosiveness", "Shoulder endurance", "Core stability", "Footwork-supporting strength", "Aerobic and anaerobic conditioning"],
    qualities: { rotational_power: 1.7, power: 1.3, conditioning: 1.5, core_stability: 1.2, unilateral: 1, resilience: 0.8 },
    emphasisMuscles: ["shoulders", "core", "calves"],
    specialPatterns: ["rotation", "calves", "iso_shoulders", "core_anti"],
    power: 0.8,
    conditioning: 0.9,
    mainReps: [4, 6],
    accessoryReps: [10, 15],
    defaultAestheticWeight: 0.25,
    metrics: ["Power", "Conditioning", "Relative strength"],
  },
  soccer: {
    id: "soccer",
    label: "Football / Soccer",
    short: "Football",
    tagline: "Faster first steps and legs that last 90 minutes.",
    priorities: ["Acceleration and sprinting", "Lower-body power", "Unilateral strength", "Hamstring resilience", "Change of direction", "Conditioning"],
    qualities: { speed: 1.8, power: 1.5, unilateral: 1.5, resilience: 1.4, conditioning: 1.2, max_strength: 0.8 },
    emphasisMuscles: ["hamstrings", "glutes", "calves"],
    specialPatterns: ["sprint", "adductors", "calves"],
    power: 0.8,
    conditioning: 0.7,
    mainReps: [4, 6],
    accessoryReps: [6, 10],
    defaultAestheticWeight: 0.2,
    metrics: ["Sprint", "Jump", "Unilateral strength"],
  },
  polo: {
    id: "polo",
    label: "Polo",
    short: "Polo",
    tagline: "A stable trunk and strong hips in the saddle.",
    priorities: ["Rotational strength", "Trunk stability", "Hip mobility", "Adductor strength", "Lower-body endurance", "Shoulder stability", "Balance and coordination"],
    qualities: { rotational_power: 1.5, core_stability: 1.6, mobility: 1.3, resilience: 1.2, unilateral: 1.1, conditioning: 0.9 },
    emphasisMuscles: ["core", "glutes", "shoulders"],
    specialPatterns: ["adductors", "rotation", "core_anti", "mobility"],
    power: 0.4,
    conditioning: 0.5,
    mainReps: [6, 8],
    accessoryReps: [10, 15],
    defaultAestheticWeight: 0.25,
    metrics: ["Trunk strength", "Mobility", "Conditioning"],
  },
  basketball: {
    id: "basketball",
    label: "Basketball",
    short: "Basketball",
    tagline: "Jump higher, land safer, cut faster.",
    priorities: ["Vertical jump", "Landing mechanics", "Unilateral strength", "Change of direction", "Repeated-sprint conditioning"],
    qualities: { power: 1.8, speed: 1.4, unilateral: 1.3, resilience: 1.2, conditioning: 1 },
    emphasisMuscles: ["quads", "glutes", "calves"],
    specialPatterns: ["jump", "calves", "adductors"],
    power: 0.9,
    conditioning: 0.6,
    mainReps: [4, 6],
    accessoryReps: [8, 12],
    defaultAestheticWeight: 0.25,
    metrics: ["Vertical jump", "Relative strength", "Conditioning"],
  },
  endurance: {
    id: "endurance",
    label: "Running / Endurance",
    short: "Endurance",
    tagline: "Strength that makes every kilometre easier.",
    priorities: ["Aerobic base", "Running economy through strength", "Calf and hip resilience", "Low interference with run volume"],
    qualities: { conditioning: 2, resilience: 1.4, unilateral: 1.2, max_strength: 0.7 },
    emphasisMuscles: ["calves", "glutes", "hamstrings"],
    specialPatterns: ["calves", "core_anti", "mobility"],
    power: 0.3,
    conditioning: 1,
    mainReps: [5, 8],
    accessoryReps: [10, 15],
    defaultAestheticWeight: 0.15,
    metrics: ["Conditioning", "Single-leg strength", "Consistency"],
  },
  explosive: {
    id: "explosive",
    label: "Explosive Athletic Performance",
    short: "Explosive",
    tagline: "Turn strength into speed.",
    priorities: ["Jumps and throws", "Heavy strength base", "Sprint mechanics", "Rate of force development"],
    qualities: { power: 2, speed: 1.6, max_strength: 1.2, rotational_power: 0.8 },
    emphasisMuscles: ["glutes", "quads", "hamstrings"],
    specialPatterns: ["jump", "throw", "sprint"],
    power: 1,
    conditioning: 0.3,
    mainReps: [3, 5],
    accessoryReps: [6, 10],
    defaultAestheticWeight: 0.3,
    metrics: ["Jump", "Sprint", "Relative strength"],
  },
  hybrid: {
    id: "hybrid",
    label: "Custom / Hybrid Athlete",
    short: "Hybrid",
    tagline: "Strong, muscular and fit. All at once.",
    priorities: ["Strength", "Muscle", "Conditioning", "Managing fatigue between them"],
    qualities: { max_strength: 1.3, hypertrophy: 1.3, conditioning: 1.3, power: 0.8 },
    emphasisMuscles: ["back", "shoulders"],
    specialPatterns: ["carry", "iso_arms"],
    power: 0.4,
    conditioning: 0.7,
    mainReps: [5, 8],
    accessoryReps: [10, 15],
    defaultAestheticWeight: 0.5,
    metrics: ["Strength", "Conditioning", "Body composition"],
  },
};

export const FOCUS_ORDER: FocusId[] = [
  "general",
  "hypertrophy",
  "strength",
  "mma",
  "boxing",
  "soccer",
  "polo",
  "basketball",
  "endurance",
  "explosive",
  "hybrid",
];

/**
 * Blend the primary focus with secondary focuses. The primary always carries
 * at least 65% of the weight so it stays the clear priority.
 */
export function blendFocus(primary: FocusId, secondary: FocusId[], aestheticWeight?: number): FocusProfile {
  const base = FOCUS[primary];
  const secs = secondary.filter((s) => s !== primary).map((s) => FOCUS[s]);
  const wPrimary = secs.length ? 0.65 : 1;
  const wEach = secs.length ? 0.35 / secs.length : 0;

  const qualities: Partial<Record<Quality, number>> = {};
  const add = (p: FocusProfile, w: number) => {
    for (const [q, v] of Object.entries(p.qualities) as [Quality, number][]) {
      qualities[q] = (qualities[q] ?? 0) + v * w;
    }
  };
  add(base, wPrimary);
  secs.forEach((s) => add(s, wEach));

  // Aesthetic preference nudges hypertrophy up or down.
  const aw = aestheticWeight ?? base.defaultAestheticWeight;
  const aestheticDelta = aw - base.defaultAestheticWeight;
  qualities.hypertrophy = Math.max(0, (qualities.hypertrophy ?? 0) + aestheticDelta * 1.5);

  const lerp = (k: "power" | "conditioning") => base[k] * wPrimary + secs.reduce((a, s) => a + s[k] * wEach, 0);

  return {
    ...base,
    qualities,
    emphasisMuscles: unique([...base.emphasisMuscles, ...secs.flatMap((s) => s.emphasisMuscles.slice(0, 2))]),
    specialPatterns: unique([...base.specialPatterns, ...secs.flatMap((s) => s.specialPatterns.slice(0, 2))]),
    power: lerp("power"),
    conditioning: lerp("conditioning"),
    defaultAestheticWeight: aw,
  };
}

/** Plain-language explanation of what changes when combining focuses. */
export function describeTradeoffs(primary: FocusId, secondary: FocusId[]): string[] {
  const out: string[] = [];
  const p = FOCUS[primary];
  for (const s of secondary) {
    if (s === primary) continue;
    const f = FOCUS[s];
    const conflict =
      (p.conditioning >= 0.7 && f.id === "hypertrophy") || (f.conditioning >= 0.7 && p.id === "hypertrophy")
        ? "Heavy conditioning competes with muscle growth for recovery, so conditioning is kept short and placed after lifting."
        : (p.id === "strength" && f.conditioning >= 0.7) || (f.id === "strength" && p.conditioning >= 0.7)
          ? "Hard conditioning can blunt top-end strength, so it's kept away from heavy lower-body days."
          : p.power >= 0.7 && f.id === "hypertrophy"
            ? "Explosive work comes first while you're fresh. Hypertrophy work follows with moderate volume, so growth is a bit slower than a pure physique plan."
            : `${f.short} work is added as secondary priority. ${p.short} still decides the structure of each session.`;
    out.push(`${p.short} + ${f.short}: ${conflict}`);
  }
  return out;
}

/** Explain how changing focus will change training (Flow D). */
export function describeFocusChange(from: FocusId, to: FocusId): { gained: string[]; reduced: string[]; kept: string[] } {
  const a = FOCUS[from];
  const b = FOCUS[to];
  const gained = b.priorities.filter((x) => !a.priorities.includes(x)).slice(0, 4);
  const reduced = a.priorities.filter((x) => !b.priorities.includes(x)).slice(0, 3);
  const kept = [
    "All workout history and personal records",
    "Strength benchmarks and muscle map",
    "Body weight and nutrition logs",
  ];
  return { gained, reduced, kept };
}

function unique<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}
