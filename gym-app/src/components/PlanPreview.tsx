"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import type { PlanDay, TrainingPlan } from "@/lib/types";
import { getExercise } from "@/lib/data/exercises";
import { WEEKDAYS_SHORT, fmtDuration } from "@/lib/format";
import { Card, cx } from "./ui/primitives";

export function WeekStrip({ plan, today, onPick }: { plan: TrainingPlan; today?: number; onPick?: (d: PlanDay) => void }) {
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {WEEKDAYS_SHORT.map((w, i) => {
        const d = plan.days.find((x) => x.weekday === i);
        return (
          <button
            key={w}
            disabled={!d || !onPick}
            onClick={() => d && onPick?.(d)}
            className={cx("flex flex-col items-center gap-1.5 rounded-xl py-2 transition-colors", today === i ? "bg-surface" : "", d && onPick && "hover:bg-surface")}
            aria-label={`${w}: ${d ? d.title : "Rest"}`}
          >
            <span className={cx("text-[11px] font-medium", today === i ? "text-text" : "text-text-3")}>{w}</span>
            <span className={cx("h-1.5 w-1.5 rounded-full", d ? (d.emphasis === "conditioning" ? "bg-positive" : d.emphasis === "recovery" ? "bg-text-3" : "bg-accent") : "bg-surface-3")} />
          </button>
        );
      })}
    </div>
  );
}

export function SlotLine({ exerciseId, sets, reps, workSec, role }: { exerciseId: string; sets: number; reps: [number, number]; workSec?: number; role: string }) {
  const ex = getExercise(exerciseId);
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-[14px] font-medium">{ex.name}</div>
        <div className="text-[12px] capitalize text-text-3">{role === "main" ? "Main lift" : role}</div>
      </div>
      <div className="tnum shrink-0 text-[13px] text-text-2">
        {sets} × {workSec ? fmtDuration(workSec) : reps[0] === reps[1] ? reps[0] : `${reps[0]}–${reps[1]}`}
      </div>
    </div>
  );
}

export function DayCard({ day, defaultOpen = false }: { day: PlanDay; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="overflow-hidden">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 p-4 text-left" aria-expanded={open}>
        <span className="tnum w-9 shrink-0 text-[13px] font-semibold text-text-3">{WEEKDAYS_SHORT[day.weekday]}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold">{day.title}</div>
          <div className="text-caption text-text-3">
            {day.slots.length} exercises · ~{day.estMinutes} min
          </div>
        </div>
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="text-text-3">
          <ChevronDown size={18} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
            <div className="divide-y divide-line border-t border-line px-4 pb-2">
              <p className="py-3 text-caption text-text-2">{day.summary}</p>
              {day.slots.map((s) => (
                <SlotLine key={s.id} exerciseId={s.exerciseId} sets={s.prescription.sets} reps={[s.prescription.repsMin, s.prescription.repsMax]} workSec={s.prescription.workSec} role={s.role} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
