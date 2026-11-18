"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Check, Trophy } from "lucide-react";
import { useApp, useHydrated } from "@/lib/store/store";
import { computeToday } from "@/lib/store/derived";
import { getExercise } from "@/lib/data/exercises";
import { finished, sessionSummary } from "@/lib/engine/analytics";
import { exerciseHistory, recommend } from "@/lib/engine/progression";
import { fmtDuration, fmtWeight, WEEKDAYS } from "@/lib/format";
import { Button, Card, Stat } from "@/components/ui/primitives";

export default function SummaryPage() {
  const hydrated = useHydrated();
  const router = useRouter();
  const s = useApp();
  const session = s.sessions.find((x) => x.id === s.lastSummaryId);
  const summary = useMemo(() => (session ? sessionSummary(session, finished(s.sessions).filter((x) => x.id !== session.id)) : null), [session, s.sessions]);
  const t = useMemo(() => computeToday(s), [s]);

  if (!hydrated) return <div className="min-h-dvh" />;
  if (!session || !summary || !s.profile) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col items-center justify-center px-6 text-center">
        <p className="text-body text-text-2">No recent workout to summarise.</p>
        <Button className="mt-4" onClick={() => router.replace("/today")}>
          Back to Today
        </Button>
      </main>
    );
  }
  const units = s.profile.units;

  // What changes next time, per lift (progression preview)
  const nextTime = session.exercises
    .map((e) => {
      const ex = getExercise(e.exerciseId);
      if (ex.loadType === "timed" || (ex.loadType === "bodyweight" && ex.increment === 0)) return null;
      const rec = recommend({ exercise: ex, prescription: e.prescription, history: exerciseHistory(s.sessions, ex.id) });
      return rec.weight ? { name: ex.name, rec } : null;
    })
    .filter(Boolean)
    .slice(0, 4) as { name: string; rec: ReturnType<typeof recommend> }[];

  return (
    <main className="mx-auto min-h-dvh max-w-[560px] px-5 pb-32 pt-[max(env(safe-area-inset-top),24px)]">
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 18 }} className="mx-auto mt-8 grid h-16 w-16 place-items-center rounded-full bg-positive text-white">
        <Check size={30} strokeWidth={3} />
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mt-5 text-center">
        <h1 className="text-title">Workout complete</h1>
        <p className="mt-1 text-body text-text-2">{session.title}</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <Card className="mt-8 grid grid-cols-3 gap-2 p-5">
          <Stat label="Duration" value={summary.minutes} unit="min" />
          <Stat label="Sets" value={summary.sets} />
          {summary.volume > 0 ? (
            <Stat label="Volume" value={units === "imperial" ? Math.round(summary.volume / 0.4536).toLocaleString() : summary.volume.toLocaleString()} unit={units === "imperial" ? "lb" : "kg"} />
          ) : (
            <Stat label="Exercises" value={session.exercises.length} />
          )}
        </Card>

        {summary.prs.length > 0 && (
          <Card className="mt-3 p-5">
            <div className="flex items-center gap-2 text-[15px] font-semibold">
              <Trophy size={17} className="text-accent" /> Personal records
            </div>
            <ul className="mt-2 space-y-1 text-[14px] text-text-2">
              {summary.prs.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </Card>
        )}

        <Card className="mt-3 divide-y divide-line">
          {session.exercises.map((e, i) => {
            const ex = getExercise(e.exerciseId);
            const done = e.sets.filter((x) => x.done);
            return (
              <div key={i} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-medium">{ex.name}</div>
                  <div className="tnum text-[12px] text-text-3">
                    {done.length ? done.map((x) => (x.seconds && ex.loadType === "timed" ? fmtDuration(x.seconds) : x.reps)).join(" · ") : "Skipped"}
                  </div>
                </div>
                {done[0]?.weight > 0 && <div className="tnum text-[14px] font-medium">{fmtWeight(Math.max(...done.map((x) => x.weight)), units)}</div>}
              </div>
            );
          })}
        </Card>

        {nextTime.length > 0 && (
          <div className="mt-6">
            <div className="px-1 text-headline">Next time</div>
            <Card className="mt-3 divide-y divide-line">
              {nextTime.map(({ name, rec }) => (
                <div key={name} className="px-4 py-3">
                  <div className="flex justify-between gap-3 text-[14px]">
                    <span className="font-medium">{name}</span>
                    <span className={rec.decision === "increase" ? "tnum font-semibold text-positive" : "tnum font-medium"}>
                      {fmtWeight(rec.weight, units)} × {rec.repsMin}–{rec.repsMax}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-text-3">{rec.reason}</p>
                </div>
              ))}
            </Card>
          </div>
        )}

        {t.nextDay && (
          <p className="mt-6 text-center text-[14px] text-text-2">
            Next session: {t.nextDay.title}, {t.daysUntilNext === 1 ? "tomorrow" : WEEKDAYS[t.nextDay.weekday]}.
          </p>
        )}
      </motion.div>

      <div className="pb-safe pointer-events-none fixed inset-x-0 bottom-0 bg-gradient-to-t from-bg via-bg to-transparent pt-8">
        <div className="pointer-events-auto mx-auto max-w-[560px] px-5 pb-5">
          <Button size="lg" block onClick={() => router.replace("/today")}>
            Done
          </Button>
        </div>
      </div>
    </main>
  );
}
