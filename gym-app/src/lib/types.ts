/**
 * Domain types shared by the UI, the deterministic training engine and the
 * persistence layer. Everything is stored in metric units (kg, cm, seconds);
 * conversion happens only at the edges (see lib/format.ts).
 */

export type Sex = "male" | "female" | "unspecified";

export type Experience = "new" | "some" | "experienced" | "veteran";

export type FocusId =
  | "general"
  | "hypertrophy"
  | "strength"
  | "mma"
  | "boxing"
  | "soccer"
  | "polo"
  | "basketball"
  | "endurance"
  | "explosive"
  | "hybrid";

export type Muscle =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "forearms"
  | "core"
  | "glutes"
  | "quads"
  | "hamstrings"
  | "calves";

export const MUSCLES: Muscle[] = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "forearms",
  "core",
  "glutes",
  "quads",
  "hamstrings",
  "calves",
];

export const LOWER_MUSCLES: Muscle[] = ["glutes", "quads", "hamstrings", "calves"];
export const UPPER_MUSCLES: Muscle[] = ["chest", "back", "shoulders", "biceps", "triceps", "forearms"];

export type Equipment =
  | "barbell"
  | "dumbbell"
  | "kettlebell"
  | "machine"
  | "cable"
  | "bench"
  | "pullup_bar"
  | "bands"
  | "medball"
  | "box"
  | "bike"
  | "rower"
  | "bodyweight";

export type EquipmentPreset = "full_gym" | "home_gym" | "minimal";

export type Pattern =
  | "squat"
  | "hinge"
  | "lunge"
  | "h_push"
  | "v_push"
  | "h_pull"
  | "v_pull"
  | "carry"
  | "core_anti"
  | "rotation"
  | "jump"
  | "throw"
  | "sprint"
  | "conditioning"
  | "iso_arms"
  | "iso_shoulders"
  | "iso_legs"
  | "calves"
  | "adductors"
  | "neck"
  | "mobility";

export type Quality =
  | "max_strength"
  | "hypertrophy"
  | "power"
  | "rotational_power"
  | "speed"
  | "conditioning"
  | "core_stability"
  | "grip"
  | "unilateral"
  | "mobility"
  | "resilience";

export type LoadType = "barbell" | "dumbbell" | "machine" | "bodyweight" | "timed";

export type Limitation =
  | "shoulder"
  | "elbow"
  | "wrist"
  | "lower_back"
  | "hip"
  | "knee"
  | "ankle"
  | "neck";

export type BenchmarkLift =
  | "back_squat"
  | "bench_press"
  | "deadlift"
  | "overhead_press"
  | "barbell_row"
  | "pull_up"
  | "push_up";

export interface Exercise {
  id: string;
  name: string;
  pattern: Pattern;
  primary: Muscle[];
  secondary: Muscle[];
  equipment: Equipment[]; // every item is required
  qualities: Quality[];
  kind: "compound" | "isolation" | "power" | "conditioning" | "mobility";
  loadType: LoadType;
  /** Smallest sensible load jump, kg (per dumbbell for dumbbell work). */
  increment: number;
  /** 1 = low systemic fatigue, 3 = high. */
  fatigue: 1 | 2 | 3;
  /** 1 = simple to learn, 3 = technical. */
  complexity: 1 | 2 | 3;
  stresses: Limitation[];
  benchmark?: BenchmarkLift;
  cue: string;
}

export type Goal = "strength" | "muscle" | "athleticism" | "conditioning" | "body_composition";
export type WeightDirection = "lose" | "maintain" | "gain";
export type ActivityLevel = "sedentary" | "light" | "active" | "very_active";
export type DietPreference = "none" | "vegetarian" | "vegan" | "pescatarian" | "halal";
export type Units = "metric" | "imperial";
export type ThemePref = "system" | "light" | "dark";

export interface Profile {
  name: string;
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  experience: Experience;
  primaryFocus: FocusId;
  secondaryFocus: FocusId[];
  /** 0 = purely athletic function, 1 = purely physique. */
  aestheticWeight: number;
  goals: Goal[];
  daysPerWeek: number;
  sessionMinutes: number;
  equipmentPreset: EquipmentPreset;
  equipment: Equipment[];
  /** 0 = Monday ... 6 = Sunday */
  trainingDays: number[];
  limitations: Limitation[];
  activityLevel: ActivityLevel;
  weightDirection: WeightDirection;
  diet: DietPreference;
  units: Units;
  theme: ThemePref;
  createdAt: string;
}

export type SlotRole = "power" | "main" | "secondary" | "accessory" | "core" | "conditioning" | "mobility";

export interface Prescription {
  sets: number;
  repsMin: number;
  repsMax: number;
  /** Target rate of perceived exertion (1–10) for the top sets. */
  rpe: number;
  restSec: number;
  /** For timed work: seconds of work per set (reps are ignored). */
  workSec?: number;
}

export interface PlanSlot {
  id: string;
  role: SlotRole;
  exerciseId: string;
  prescription: Prescription;
  note?: string;
}

export type DayEmphasis =
  | "full"
  | "upper"
  | "lower"
  | "push"
  | "pull"
  | "legs"
  | "power"
  | "conditioning"
  | "recovery";

export interface PlanDay {
  id: string;
  weekday: number;
  title: string;
  emphasis: DayEmphasis;
  summary: string;
  slots: PlanSlot[];
  estMinutes: number;
}

export interface TrainingPlan {
  id: string;
  createdAt: string;
  focus: FocusId;
  secondary: FocusId[];
  splitName: string;
  rationale: string[];
  tradeoffs: string[];
  days: PlanDay[];
  weeklySets: Partial<Record<Muscle, number>>;
}

export interface LoggedSet {
  weight: number; // kg (0 for bodyweight)
  reps: number;
  rpe?: number;
  done: boolean;
  /** For timed work. */
  seconds?: number;
}

export interface SessionExercise {
  slotId: string;
  exerciseId: string;
  role: SlotRole;
  prescription: Prescription;
  recommendedWeight: number | null;
  recommendationReason: string;
  sets: LoggedSet[];
  skipped?: boolean;
  substitutedFrom?: string;
}

export interface WorkoutSession {
  id: string;
  dayId: string;
  title: string;
  startedAt: string;
  finishedAt?: string;
  exercises: SessionExercise[];
  adjustments: string[];
  /** 1–10 overall session effort, captured at the end. */
  sessionRpe?: number;
  isDemo?: boolean;
}

export type SorenessLevel = 0 | 1 | 2 | 3; // none, mild, moderate, severe

export interface CheckIn {
  id: string;
  date: string; // YYYY-MM-DD
  soreness: Partial<Record<Muscle, SorenessLevel>>;
  sleepHours?: number;
  sleepQuality?: 1 | 2 | 3; // poor, ok, good
  energy?: 1 | 2 | 3 | 4 | 5;
  pain?: { area: string; severity: "mild" | "sharp"; persistent: boolean };
}

export interface BodyWeightEntry {
  date: string;
  kg: number;
}

export type AthleticTest =
  | "vertical_jump"
  | "broad_jump"
  | "sprint_10m"
  | "pull_up_max"
  | "push_up_max"
  | "row_1k";

export interface TestResult {
  id: string;
  test: AthleticTest;
  date: string;
  value: number;
}

export interface StartingLift {
  lift: BenchmarkLift;
  weight: number;
  reps: number;
  date: string;
}

export interface FoodItem {
  id: string;
  name: string;
  serving: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  tags?: string[];
}

export interface MealEntry {
  id: string;
  date: string;
  meal: "breakfast" | "lunch" | "dinner" | "snack";
  name: string;
  servings: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  foodId?: string;
  source: "database" | "manual" | "estimate" | "saved";
}

export interface SavedMeal {
  id: string;
  name: string;
  items: Omit<MealEntry, "id" | "date" | "meal">[];
}

export interface FocusChange {
  date: string;
  from: FocusId;
  to: FocusId;
}
