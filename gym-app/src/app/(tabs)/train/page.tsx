"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { WeekStrip, SlotLine } from "@/components/PlanPreview";
import { ExerciseSheet } from "@/components/train/ExerciseSheet";
import { Sheet } from "@/components/ui/Sheet";
import { Button, Card, Chip, EmptyState, Meter, Pill, Section, cx } from "@/components/ui/primitives";
import { useApp } from "@/lib/store/store";
import { useToday } from "@/lib/store/derived";
import { EXERCISES, getExercise, isAvailable } from "@/lib/data/exercises";
import { finished, recentSetsByMuscle } from "@/lib/engine/analytics";
import { FOCUS } from "@/lib/engine/focus";
import { MUSCLE_LABEL, WEEKDAYS, relativeDay, weekdayIndex } from "@/lib/format";
import { MUSCLES, type Muscle, type PlanDay } from "@/lib/types";

export default function TrainPage() {
  const router = useRouter();
  const s = useApp();
  const t = useToday();
  const plan = s.plan!;
  const p = s.profile!;
  const [selected, setSelected] = useState<PlanDay | null>(null);
  const [why, setWhy] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  const [exDetail, setExDetail] = useState<string | null>(null);

  const doneThisWeek = recentSetsByMuscle(s.sessions, 7);
  const history = finished(s.sessions).slice(-8).reverse();

  const start = (day: PlanDay) => {
    if (s.active) return router.push("/workout");
    const isToday = t.plannedDay?.id === day.id;
    s.startWorkout(isToday && t.adapted ? t.adapted.day : day, t.readiness.status, isToday ? (t.adapted?.changes ?? []) : []);
    router.push("/workout");
  };

  return (
    <>
      <PageHeader eyebrow={`${FOCUS[p.primaryFocus].label}${p.secondaryFocus.length ? " + " + p.secondaryFocus.map((f) => FOCUS[f].short).join(" + ") : ""}`} title="Train" context="train" />

      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between px-1">
          <div className="text-[15px] font-semibold">{plan.splitName}</div>
          <button onClick={() => setWhy(true)} className="text-[14px] font-medium text-accent">
            Why this plan
          </button>
        </div>
        <WeekStrip plan={plan} today={weekdayIndex()} onPick={setSelected} />
      </Card>

      <Section title="This week" className="mt-8">
        <div className="space-y-2">
          {[...plan.days]
            .sort((a, b) => a.weekday - b.weekday)
            .map((d) => {
              const isToday = d.weekday === weekdayIndex();
              return (
                <Card key={d.id} className={cx("flex items-center gap-3 p-4", isToday && "ring-1 ring-accent/40")}>
                  <button onClick={() => setSelected(d)} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-text-3">{WEEKDAYS[d.weekday]}</span>
                      {isToday && <Pill tone="accent">Today</Pill>}
                    </div>
                    <div className="mt-0.5 truncate text-[16px] font-semibold">{d.title}</div>
                    <div className="text-caption text-text-3">
                      {d.slots.length} exercises · ~{d.estMinutes} min
                    </div>
                  </button>
                  <Button size="sm" variant={isToday ? "primary" : "secondary"} icon={<Play size={13} />} onClick={() => start(d)}>
                    Start
                  </Button>
                </Card>
              );
            })}
        </div>
      </Section>

      <Section title="Weekly volume" subtitle="Hard sets in the last 7 days vs. your plan" className="mt-8">
        <Card className="space-y-3 p-4">
          {MUSCLES.filter((m) => (plan.weeklySets[m] ?? 0) > 0).map((m) => {
            const target = plan.weeklySets[m] ?? 0;
            const done = Math.round(doneThisWeek[m] ?? 0);
            return (
              <div key={m} className="grid grid-cols-[96px_1fr_56px] items-center gap-3">
                <span className="text-[14px]">{MUSCLE_LABEL[m]}</span>
                <Meter value={done / target} tone={done >= target * 0.8 ? "positive" : "accent"} />
                <span className="tnum text-right text-[13px] text-text-2">
                  {done}/{Math.round(target)}
                </span>
              </div>
            );
          })}
        </Card>
      </Section>

      <Section title="History" className="mt-8" action={<button onClick={() => setLibOpen(true)} className="text-[14px] font-medium text-accent">Exercise library</button>}>
        {history.length ? (
          <Card className="divide-y divide-line">
            {history.map((w) => (
              <div key={w.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-medium">{w.title}</div>
                  <div className="text-caption text-text-3">
                    {relativeDay(w.startedAt)} · {w.exercises.reduce((a, e) => a + e.sets.length, 0)} sets
                  </div>
                </div>
                {w.isDemo && <Pill>Demo</Pill>}
              </div>
            ))}
          </Card>
        ) : (
          <Card>
            <EmptyState title="No workouts yet" body="Completed sessions appear here, with every set you logged." />
          </Card>
        )}
      </Section>

      <Sheet open={!!selected} onClose={() => setSelected(null)} title={selected?.title}>
        {selected && (
          <div>
            <p className="text-body text-text-2">{selected.summary}</p>
            <div className="mt-3 divide-y divide-line">
              {selected.slots.map((sl) => (
                <button key={sl.id} onClick={() => setExDetail(sl.exerciseId)} className="block w-full text-left">
                  <SlotLine exerciseId={sl.exerciseId} sets={sl.prescription.sets} reps={[sl.prescription.repsMin, sl.prescription.repsMax]} workSec={sl.prescription.workSec} role={sl.role} />
                </button>
              ))}
            </div>
            <Button
              className="mt-5"
              size="lg"
              block
              onClick={() => {
                const d = selected;
                setSelected(null);
                start(d);
              }}
            >
              Start this session
            </Button>
            {t.plannedDay?.id !== selected.id && t.isTrainingDay && !t.completedToday && (
              <Button
                className="mt-2"
                size="md"
                block
                variant="plain"
                onClick={() => {
                  s.chooseToday(selected.id);
                  setSelected(null);
                  router.push("/today");
                }}
              >
                Make this today&apos;s session
              </Button>
            )}
          </div>
        )}
      </Sheet>

      <Sheet open={why} onClose={() => setWhy(false)} title="Why this plan">
        <ul className="space-y-3 text-[15px] leading-relaxed text-text-2">
          {[...plan.rationale, ...plan.tradeoffs].map((r) => (
            <li key={r} className="flex gap-2.5">
              <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-text-3" />
              {r}
            </li>
          ))}
        </ul>
        <div className="mt-5 rounded-2xl bg-surface-2 p-4">
          <div className="text-micro text-text-3">{FOCUS[p.primaryFocus].label} priorities</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {FOCUS[p.primaryFocus].priorities.map((x) => (
              <Pill key={x}>{x}</Pill>
            ))}
          </div>
        </div>
        <p className="mt-4 text-caption text-text-3">Exercises, sets and reps are chosen by documented, deterministic rules. The same inputs always give the same plan.</p>
      </Sheet>

      <LibrarySheet open={libOpen} onClose={() => setLibOpen(false)} onPick={setExDetail} />
      <ExerciseSheet id={exDetail} onClose={() => setExDetail(null)} />
    </>
  );
}

function LibrarySheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (id: string) => void }) {
  const equipment = useApp((s) => s.profile!.equipment);
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const [onlyMine, setOnlyMine] = useState(true);
  const list = useMemo(
    () =>
      EXERCISES.filter((e) => (!muscle || e.primary.includes(muscle)) && (!onlyMine || isAvailable(e, equipment)) && e.name.toLowerCase().includes(q.trim().toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)),
    [q, muscle, onlyMine, equipment],
  );
  return (
    <Sheet open={open} onClose={onClose} title="Exercise library" size="lg">
      <div className="sticky top-0 z-10 -mx-5 space-y-3 bg-surface px-5 pb-3">
        <label className="flex h-11 items-center gap-2 rounded-xl bg-surface-2 px-3">
          <Search size={16} className="text-text-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search exercises" className="h-full flex-1 bg-transparent text-[15px] outline-none" aria-label="Search exercises" />
        </label>
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          <Chip selected={onlyMine} onClick={() => setOnlyMine(!onlyMine)} className="h-8 shrink-0 px-3 text-[13px]">
            My equipment
          </Chip>
          {MUSCLES.map((m) => (
            <Chip key={m} selected={muscle === m} onClick={() => setMuscle(muscle === m ? null : m)} className="h-8 shrink-0 px-3 text-[13px]">
              {MUSCLE_LABEL[m]}
            </Chip>
          ))}
        </div>
      </div>
      <div className="divide-y divide-line">
        {list.map((e) => (
          <button key={e.id} onClick={() => onPick(e.id)} className="flex w-full items-center justify-between gap-3 py-3 text-left">
            <div>
              <div className="text-[15px] font-medium">{e.name}</div>
              <div className="text-caption capitalize text-text-3">{e.primary.map((m) => MUSCLE_LABEL[m]).join(", ")}</div>
            </div>
            <span className="text-[12px] capitalize text-text-3">{e.kind}</span>
          </button>
        ))}
        {!list.length && <p className="py-6 text-center text-body text-text-3">No exercises match.</p>}
      </div>
    </Sheet>
  );
}

