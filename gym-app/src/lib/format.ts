import type { Units } from "./types";

export const KG_PER_LB = 0.45359237;

export function toDisplayWeight(kg: number, units: Units): number {
  return units === "imperial" ? Math.round((kg / KG_PER_LB) * 2) / 2 : Math.round(kg * 100) / 100;
}

export function fromDisplayWeight(v: number, units: Units): number {
  return units === "imperial" ? Math.round(v * KG_PER_LB * 1000) / 1000 : v;
}

export function weightUnit(units: Units) {
  return units === "imperial" ? "lb" : "kg";
}

export function fmtWeight(kg: number | null | undefined, units: Units, opts: { unit?: boolean } = {}): string {
  if (kg === null || kg === undefined) return "—";
  const v = toDisplayWeight(kg, units);
  const s = Number.isInteger(v) ? String(v) : v.toFixed(v * 10 === Math.round(v * 10) ? 1 : 2);
  return opts.unit === false ? s : `${s} ${weightUnit(units)}`;
}

/** Load step for steppers in display units. */
export function displayStep(kgIncrement: number, units: Units): number {
  if (units === "imperial") return kgIncrement >= 2.5 ? 5 : kgIncrement > 0 ? 2.5 : 5;
  return kgIncrement > 0 ? kgIncrement : 2.5;
}

export function fmtHeight(cm: number, units: Units): string {
  if (units === "metric") return `${Math.round(cm)} cm`;
  const inches = cm / 2.54;
  return `${Math.floor(inches / 12)}′${Math.round(inches % 12)}″`;
}

export function fmtDuration(sec: number): string {
  if (sec >= 3600) return `${Math.floor(sec / 3600)} h ${Math.round((sec % 3600) / 60)} min`;
  if (sec >= 90) return `${Math.round(sec / 60)} min`;
  if (sec >= 60) return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  return `${sec} s`;
}

export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function localDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Monday = 0 … Sunday = 6 */
export function weekdayIndex(d = new Date()): number {
  return (d.getDay() + 6) % 7;
}

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const WEEKDAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function relativeDay(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const days = Math.round((startOfDay(now).getTime() - startOfDay(d).getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return WEEKDAYS[weekdayIndex(d)];
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

export function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const MUSCLE_LABEL: Record<string, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  core: "Core",
  glutes: "Glutes",
  quads: "Quadriceps",
  hamstrings: "Hamstrings",
  calves: "Calves",
};
