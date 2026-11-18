"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { AlertTriangle, ArrowRight, BedDouble, Check, ChevronRight, Info } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { CheckInSheet } from "@/components/CheckInSheet";
import { Button, Card, Meter, Pill, Ring, Section, cx, type Tone } from "@/components/ui/primitives";
import { useApp } from "@/lib/store/store";
import { useNutrition, useToday } from "@/lib/store/derived";
import { getExercise } from "@/lib/data/exercises";
import { exerciseHistory, recommend } from "@/lib/engine/progression";
import { fmtDuration, fmtWeight, greeting, localDate, relativeDay, WEEKDAYS } from "@/lib/format";
import { sumMeals } from "@/lib/engine/nutrition";
import { finished, sessionSummary, strengthChange, trackedExercises } from "@/lib/engine/analytics";
import { FOCUS } from "@/lib/engine/focus";

const READY_TONE: Record<string, Tone> = { ready: "positive", moderate: "caution", low: "critical" };
const READY_LABEL: Record<string, string> = { ready: "Ready", moderate: "Reduced", low: "Low" };

export default function TodayPage() {
  const router = useRouter();
  const t = useToday();
  const s = useApp();
  const n = useNutrition();
  const [checkIn, setCheckIn] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const p = s.profile!;
  const units = p.units;
  const day = t.adapted?.day ?? null;

  const firstName = p.name ? `, ${p.name}` : "";
  const now = new Date();

  const headline = useMemo(() => {
    if (s.active) return `Your ${s.active.title} session is in progress.`;
    if (t.completedToday) return "Session done. Nice work today.";
    if (!t.isTrainingDay || !day) return "Today is a rest day.";
    if (day.emphasis === "recovery") return "Today is about recovery.";
    if (t.readiness.status === "moderate") return `A lighter ${day.title.split(" · ")[0].toLowerCase()} session today.`;
    return `You're ready for ${articled(day.title)}.`;
  }, [s.active, t, day]);

  const explanation = useMemo(() => {
    if (s.active) return "Pick up where you left off.";
    if (t.completedToday) return t.nextDay ? `Next up: ${t.nextDay.title}, ${t.daysUntilNext === 1 ? "tomorrow" : WEEKDAYS[t.nextDay.weekday]}. Eat well and sleep well tonight.` : "Recovery starts now.";
    if (!t.isTrainingDay || !day) return t.nextDay ? `Recovery is when you adapt. Next session: ${t.nextDay.title}, ${t.daysUntilNext === 1 ? "tomorrow" : WEEKDAYS[t.nextDay.weekday]}.` : "Enjoy the day off.";
    if (t.adapted?.changes.length) return t.adapted.changes[0];
    return day.summary;
  }, [s.active, t, day]);

  // Recommended weights preview
  const preview = useMemo(() => {
    if (!day) return [];
    return day.slots.slice(0, 8).map((slot) => {
      const ex = getExercise(slot.exerciseId);
      const rec = recommend({ exercise: ex, prescription: slot.prescription, history: exerciseHistory(s.sessions, ex.id) });
      return { slot, ex, rec };
    });
  }, [day, s.sessions]);

  const last = finished(s.sessions).slice(-1)[0];
  const lastSummary = last ? sessionSummary(last, finished(s.sessions).slice(0, -1)) : null;
  const highlight = useMemo(() => {
    for (const id of trackedExercises(s.sessions).slice(0, 4)) {
      const c = strengthChange(s.sessions, id);
      if (c && c.pct > 2) return c;
    }
    return null;
  }, [s.sessions]);

  const eaten = sumMeals(s.meals.filter((m) => m.date === localDate()));
  const target = n ? (t.isTrainingDay ? n.plan.trainingDay : n.plan.restDay) : null;

  const start = () => {
    if (!s.active && day) s.startWorkout(day, t.readiness.status, t.adapted?.changes ?? []);
    router.push("/workout");
  };

  return (
    <>
      <PageHeader eyebrow={now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} title={`${greeting(now)}${firstName}.`} context="today" />

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Card className="p-5">
          <div className="flex items-center gap-2">
            {day && !t.completedToday && !s.active && (
              <Pill tone={READY_TONE[t.readiness.status]} dot>
                {t.checkIn ? `Readiness: ${READY_LABEL[t.readiness.status]}` : "No check-in yet"}
              </Pill>
            )}
            {t.completedToday && (
              <Pill tone="positive">
                <Check size={12} /> Completed
              </Pill>
            )}
            {day && <span className="text-caption text-text-3">~{day.estMinutes} min · {day.slots.length} exercises</span>}
          </div>
          <h2 className="mt-3 text-[26px] font-semibold leading-[1.15] tracking-[-0.025em]">{headline}</h2>
          <p className="mt-2 text-body text-text-2">{explanation}</p>

          {t.readiness.painWarning && (
            <div className="mt-4 flex gap-2.5 rounded-xl bg-critical-soft p-3 text-[14px] text-critical">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <span>{t.readiness.painWarning}</span>
            </div>
          )}

          {(t.adapted?.changes.length ?? 0) > 1 && (
            <button onClick={() => setShowWhy(!showWhy)} className="mt-3 inline-flex items-center gap-1 text-[14px] font-medium text-accent">
              <Info size={14} /> {showWhy ? "Hide" : "See"} {t.adapted!.changes.length - 1} more adjustment{t.adapted!.changes.length > 2 ? "s" : ""}
            </button>
          )}
          {showWhy && (
            <ul className="mt-2 space-y-1.5 text-[14px] text-text-2">
              {t.adapted!.changes.slice(1).map((c) => (
                <li key={c} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-text-3" />
                  {c}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            {s.active ? (
              <Button size="lg" block onClick={() => router.push("/workout")} icon={<ArrowRight size={18} />}>
                Resume workout
              </Button>
            ) : day && !t.completedToday ? (
              <Button size="lg" block onClick={start}>
                Start workout
              </Button>
            ) : (
              <Button size="lg" block variant="secondary" onClick={() => router.push("/train")}>
                {t.completedToday ? "View this week" : "Train anyway"}
              </Button>
            )}
          </div>
          {day && !t.completedToday && !s.active && (
            <button onClick={() => setCheckIn(true)} className="mt-3 flex w-full items-center justify-center gap-1.5 py-1 text-[14px] font-medium text-text-2 hover:text-text">
              {t.checkIn ? "Update your check-in" : "How's your body feeling?"} <ChevronRight size={15} />
            </button>
          )}
          {t.readiness.status === "low" && day?.emphasis === "recovery" && !t.completedToday && t.plannedDay && (
            <button onClick={() => s.chooseToday(t.plannedDay!.id, true)} className="mt-1 w-full py-1 text-[13px] text-text-3 hover:text-text-2">
              Train anyway at reduced intensity
            </button>
          )}
        </Card>
      </motion.div>

      {day && !t.completedToday && (
        <Section title="Today's session" action={<Link href="/train" className="text-[14px] font-medium text-accent">Plan</Link>} className="mt-8">
          <Card className="divide-y divide-line">
            {preview.map(({ slot, ex, rec }) => (
              <div key={slot.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-medium">{ex.name}</div>
                  <div className="tnum text-caption text-text-3">
                    {slot.prescription.sets} × {slot.prescription.workSec ? fmtDuration(slot.prescription.workSec) : `${slot.prescription.repsMin}–${slot.prescription.repsMax}`}
                    {rec.previous && ` · last ${fmtWeight(rec.previous.weight, units)}`}
                  </div>
                </div>
                <div className="tnum text-right text-[15px] font-semibold">
                  {rec.weight ? fmtWeight(rec.weight, units) : rec.weight === 0 ? <span className="text-text-3">BW</span> : <span className="text-text-3">—</span>}
                  {rec.decision === "increase" && <div className="text-[11px] font-medium text-positive">+{fmtWeight(ex.increment, units)}</div>}
                </div>
              </div>
            ))}
          </Card>
        </Section>
      )}

      {t.checkIn && (
        <Section title="Readiness" subtitle="Based on your check-in and recent training" className="mt-8">
          <Card className="p-4">
            <ul className="space-y-2.5">
              {t.readiness.factors.map((f) => (
                <li key={f.label} className="flex items-center justify-between gap-3 text-[14px]">
                  <span className="flex items-center gap-2.5">
                    <span className={cx("h-2 w-2 rounded-full", f.effect === "positive" ? "bg-positive" : f.effect === "negative" ? "bg-caution" : "bg-text-3")} />
                    {f.label}
                  </span>
                  <span className="text-[12px] text-text-3">{f.source}</span>
                </li>
              ))}
              {!t.readiness.factors.length && <li className="text-[14px] text-text-2">Nothing in your check-in suggests changing today&apos;s plan.</li>}
            </ul>
            <p className="mt-3 text-caption text-text-3">Soreness and sleep are useful signals, not precise measures of recovery.</p>
          </Card>
        </Section>
      )}

      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {lastSummary && last && (
          <Link href="/progress">
            <Card className="h-full p-4 transition-colors hover:bg-surface-2">
              <div className="text-caption text-text-3">Last session · {relativeDay(last.startedAt)}</div>
              <div className="mt-1 truncate text-[15px] font-semibold">{last.title}</div>
              <div className="tnum mt-2 flex gap-4 text-[13px] text-text-2">
                <span>{lastSummary.sets} sets</span>
                <span>{lastSummary.minutes} min</span>
                {lastSummary.volume > 0 && <span>{Math.round(lastSummary.volume / 100) / 10} t moved</span>}
              </div>
              {highlight && (
                <div className="mt-3 text-[13px] text-positive">
                  {getExercise(highlight.exerciseId).name} est. max +{highlight.pct}% in {highlight.weeks} weeks
                </div>
              )}
            </Card>
          </Link>
        )}
        {target && (
          <Link href="/nutrition">
            <Card className="flex h-full items-center gap-4 p-4 transition-colors hover:bg-surface-2">
              <Ring value={eaten.kcal / target.kcal} size={56} stroke={6} tone={eaten.kcal > target.kcal * 1.08 ? "caution" : "accent"}>
                <span className="tnum text-[11px] font-semibold">{Math.round((eaten.kcal / target.kcal) * 100)}%</span>
              </Ring>
              <div className="min-w-0 flex-1">
                <div className="text-caption text-text-3">{t.isTrainingDay ? "Training-day fuel" : "Rest-day fuel"}</div>
                <div className="tnum text-[15px] font-semibold">{Math.max(0, target.kcal - Math.round(eaten.kcal)).toLocaleString()} kcal left</div>
                <div className="mt-1.5 flex items-center gap-2">
                  <Meter value={eaten.protein / target.protein} tone="positive" className="flex-1" height={4} />
                  <span className="tnum shrink-0 text-[12px] text-text-2">
                    {Math.round(eaten.protein)}/{target.protein} g protein
                  </span>
                </div>
              </div>
            </Card>
          </Link>
        )}
      </div>

      {!last && (
        <Card className="mt-3 flex items-center gap-3 p-4">
          <BedDouble size={20} className="shrink-0 text-text-3" />
          <p className="text-[14px] text-text-2">
            Your history starts with your first workout. After a few sessions you&apos;ll see trends, benchmarks and personal records here. Your plan is built for {FOCUS[p.primaryFocus].label}.
          </p>
        </Card>
      )}

      <CheckInSheet open={checkIn} onClose={() => setCheckIn(false)} existing={t.checkIn} />
    </>
  );
}

function articled(title: string) {
  const [a, b] = title.split(" · ");
  const base = b ? `${a.toLowerCase()} ${b.toLowerCase()}` : a.toLowerCase();
  return `${/^[aeiou]/.test(base) ? "an" : "a"} ${base} session`;
}
