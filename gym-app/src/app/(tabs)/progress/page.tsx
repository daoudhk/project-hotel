"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Flag, Plus, Trophy, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { BodyMap } from "@/components/BodyMap";
import { Sheet } from "@/components/ui/Sheet";
import { BasisTag, Button, Card, EmptyState, Meter, Pill, Section, Segmented, Sparkline, Stat, Stepper, cx, type Tone } from "@/components/ui/primitives";
import { ExerciseSheet } from "@/components/train/ExerciseSheet";
import { useApp } from "@/lib/store/store";
import { useBenchmarks } from "@/lib/store/derived";
import { getExercise } from "@/lib/data/exercises";
import { consistencyStreak, e1rmSeries, forecast, milestones, strengthChange, trackedExercises, weeklyCounts } from "@/lib/engine/analytics";
import { BENCHMARK_ORDER, LEVELS, STANDARDS, type Level } from "@/lib/engine/strength";
import { TESTS, TEST_ORDER, testTrend } from "@/lib/engine/performance";
import { weightTrend } from "@/lib/engine/nutrition";
import { FOCUS } from "@/lib/engine/focus";
import { MUSCLE_LABEL, fmtWeight, fromDisplayWeight, relativeDay, toDisplayWeight, weightUnit } from "@/lib/format";
import type { AthleticTest, BenchmarkLift, Muscle } from "@/lib/types";

type Tab = "strength" | "athletic" | "body" | "journey";

const LEVEL_TONE: Record<Level, Tone> = { Beginner: "neutral", Novice: "neutral", Intermediate: "accent", Advanced: "positive", Elite: "positive" };
const levelFill = (score: number | null) => (score === null ? "var(--muscle-0)" : `color-mix(in srgb, var(--accent) ${Math.round(18 + (Math.min(4.5, score) / 4.5) * 82)}%, var(--muscle-0))`);

export default function ProgressPage() {
  const [tab, setTab] = useState<Tab>("strength");
  return (
    <>
      <PageHeader title="Progress" context="progress" />
      <Insights />
      <Segmented
        className="mt-6"
        options={[
          { value: "strength", label: "Strength" },
          { value: "athletic", label: "Athletic" },
          { value: "body", label: "Body" },
          { value: "journey", label: "Journey" },
        ]}
        value={tab}
        onChange={setTab}
      />
      <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="mt-6">
        {tab === "strength" && <StrengthTab />}
        {tab === "athletic" && <AthleticTab />}
        {tab === "body" && <BodyTab />}
        {tab === "journey" && <JourneyTab />}
      </motion.div>
    </>
  );
}

function Insights() {
  const s = useApp();
  const { weaknesses } = useBenchmarks();
  const p = s.profile!;
  const lines = useMemo(() => {
    const out: { icon: typeof TrendingUp; text: string; tone: Tone }[] = [];
    const changes = trackedExercises(s.sessions)
      .slice(0, 6)
      .map((id) => strengthChange(s.sessions, id))
      .filter((c): c is NonNullable<typeof c> => !!c)
      .sort((a, b) => b.pct - a.pct);
    const lowerIds = ["back_squat", "front_squat", "deadlift", "trap_bar_deadlift", "leg_press", "hip_thrust"];
    const lower = changes.find((c) => lowerIds.includes(c.exerciseId));
    const jump = testTrend(s.tests, "vertical_jump");
    if (lower && lower.pct > 2 && jump && jump.direction === "stable")
      out.push({ icon: TrendingUp, tone: "accent", text: `Your lower-body strength is up ${lower.pct}% over ${lower.weeks} weeks, but your jump has held steady. More explosive work would help turn that strength into power.` });
    else if (changes[0] && changes[0].pct > 1)
      out.push({ icon: TrendingUp, tone: "positive", text: `${getExercise(changes[0].exerciseId).name} estimated max is up ${changes[0].pct}% over ${changes[0].weeks} weeks (${Math.round(changes[0].from)} → ${Math.round(changes[0].to)} kg). Progression is working.` });
    const flat = changes.find((c) => Math.abs(c.pct) <= 1 && c.weeks >= 3);
    if (flat) out.push({ icon: Flag, tone: "caution", text: `${getExercise(flat.exerciseId).name} hasn't moved in ${flat.weeks} weeks. If it stays flat, a short deload or a variation swap usually restarts progress.` });
    const streak = consistencyStreak(s.sessions, p.daysPerWeek);
    if (streak >= 2) out.push({ icon: Trophy, tone: "positive", text: `${streak} consistent weeks in a row. Consistency is the strongest predictor of long-term progress.` });
    if (weaknesses.length) out.push({ icon: Flag, tone: "neutral", text: `Relative to your other lifts, ${weaknesses.map((w) => MUSCLE_LABEL[w.muscle].toLowerCase()).join(" and ")} ${weaknesses.length > 1 ? "are" : "is"} behind. Your plan can give ${weaknesses.length > 1 ? "them" : "it"} extra volume.` });
    return out.slice(0, 3);
  }, [s.sessions, s.tests, p.daysPerWeek, weaknesses]);

  if (!lines.length)
    return (
      <Card className="p-5">
        <div className="text-headline">Your story starts with data</div>
        <p className="mt-1 text-body text-text-2">After two to three weeks of logged training, this is where you&apos;ll see what changed, why it matters and what to do next. Nothing here is estimated until there&apos;s enough data.</p>
      </Card>
    );
  return (
    <Card className="divide-y divide-line">
      {lines.map((l) => (
        <div key={l.text} className="flex gap-3 p-4">
          <span className={cx("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full", l.tone === "positive" ? "bg-positive-soft text-positive" : l.tone === "caution" ? "bg-caution-soft text-caution" : "bg-accent-soft text-accent")}>
            <l.icon size={14} />
          </span>
          <p className="text-[15px] leading-snug">{l.text}</p>
        </div>
      ))}
    </Card>
  );
}

function StrengthTab() {
  const s = useApp();
  const { benchmarks, muscles } = useBenchmarks();
  const units = s.profile!.units;
  const [sel, setSel] = useState<Muscle | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [exId, setExId] = useState<string | null>(null);
  const selA = sel ? muscles.find((m) => m.muscle === sel) : null;
  const tracked = trackedExercises(s.sessions).slice(0, 6);

  return (
    <div className="space-y-8">
      <Section title="Strength benchmarks" subtitle="Estimated max vs. body weight" action={<button onClick={() => setAddOpen(true)} className="text-[14px] font-medium text-accent">Add</button>}>
        {benchmarks.length ? (
          <Card className="divide-y divide-line">
            {benchmarks.map((b) => {
              const isReps = STANDARDS[b.lift].unit === "reps";
              const cls = b.classification;
              return (
                <div key={b.lift} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[15px] font-semibold">{b.label}</div>
                      <div className="tnum mt-0.5 text-[22px] font-semibold tracking-tight">
                        {isReps ? `${b.best} reps` : fmtWeight(b.best, units)}
                        {!isReps && <span className="ml-1.5 text-[13px] font-medium text-text-3">est. max</span>}
                      </div>
                    </div>
                    <Pill tone={LEVEL_TONE[cls.level]}>{cls.level}</Pill>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    {LEVELS.map((l, i) => (
                      <div key={l} className="flex-1">
                        <Meter value={i < cls.levelIndex ? 1 : i === cls.levelIndex ? cls.score - cls.levelIndex || 0.04 : 0} tone={i <= cls.levelIndex ? "accent" : "neutral"} height={4} />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex justify-between text-[12px] text-text-3">
                    <span>
                      Next milestone: <span className="font-medium text-text-2">{isReps ? b.milestoneLabel : `${fmtWeight(b.milestone, units)} est. max`}</span>
                    </span>
                    <span>{b.confidence} confidence</span>
                  </div>
                  <div className="tnum mt-1 text-[12px] text-text-3">
                    From {b.source === "starting point" ? "your starting point" : relativeDay(b.bestSet.date)}: {b.bestSet.weight > 0 ? `${fmtWeight(b.bestSet.weight, units)} × ` : ""}
                    {b.bestSet.reps}
                    {!isReps && ` · ${(b.best / s.profile!.weightKg).toFixed(2)}× body weight`}
                  </div>
                </div>
              );
            })}
          </Card>
        ) : (
          <Card>
            <EmptyState title="No benchmarks yet" body="Log a squat, bench, deadlift, press, row or pull-up, or add a recent set, to see where you stand." action={<Button size="sm" onClick={() => setAddOpen(true)}>Add a set</Button>} />
          </Card>
        )}
        <p className="px-1 text-caption text-text-3">
          Estimated max uses the Epley formula. Levels compare it to body weight using published strength-standard ratios{s.profile!.age > 40 ? ", eased for age" : ""}. They describe training status, not population percentiles.
        </p>
      </Section>

      <Section title="Muscle map" subtitle="Tap a muscle group">
        <Card className="p-4">
          <BodyMap fill={(m) => levelFill(muscles.find((x) => x.muscle === m)?.score ?? null)} selected={sel} onSelect={setSel} label={(m) => `${MUSCLE_LABEL[m]}: ${muscles.find((x) => x.muscle === m)?.level ?? "not enough data"}`} />
          <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-text-3">
            <span>Beginner</span>
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className="h-2 w-5 rounded-full" style={{ background: levelFill(i + 0.5) }} />
            ))}
            <span>Elite</span>
          </div>
          {selA ? (
            <motion.div key={selA.muscle} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-2xl bg-surface-2 p-4">
              <div className="flex items-center justify-between">
                <div className="text-[16px] font-semibold">{MUSCLE_LABEL[selA.muscle]}</div>
                {selA.level ? <Pill tone={LEVEL_TONE[selA.level]}>{selA.level}</Pill> : <BasisTag basis="uncertain" />}
              </div>
              <p className="mt-1.5 text-[14px] text-text-2">
                {selA.level
                  ? `Estimated from ${selA.evidence.map((l) => STANDARDS[l].label.toLowerCase()).join(", ")}. ${selA.confidence === "high" ? "Good" : selA.confidence === "medium" ? "Moderate" : "Limited"} confidence.`
                  : selA.muscle === "calves"
                    ? "No benchmark lift reflects calf strength well, so we don't rate it."
                    : "Log a lift that trains this area to get an estimate."}
              </p>
            </motion.div>
          ) : (
            <p className="mt-4 text-center text-caption text-text-3">Based on lift performance. Not a measurement of muscle size.</p>
          )}
        </Card>
      </Section>

      {tracked.length > 0 && (
        <Section title="Lift trends">
          <Card className="divide-y divide-line">
            {tracked.map((id) => {
              const series = e1rmSeries(s.sessions, id);
              const fc = forecast(series);
              const last = series[series.length - 1];
              return (
                <button key={id} onClick={() => setExId(id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-medium">{getExercise(id).name}</div>
                    <div className="tnum text-caption text-text-3">
                      {last ? `${fmtWeight(last.value, units)} est. max` : "—"}
                      {fc && ` · 6-wk projection ${fmtWeight(fc.low, units, { unit: false })}–${fmtWeight(fc.high, units)}`}
                    </div>
                  </div>
                  <Sparkline values={series.map((x) => x.value)} width={88} height={30} />
                </button>
              );
            })}
          </Card>
          <p className="px-1 text-caption text-text-3">Projections are conservative estimates from your own trend, shown as a range. They aren&apos;t guarantees.</p>
        </Section>
      )}

      <AddBenchmarkSheet open={addOpen} onClose={() => setAddOpen(false)} />
      <ExerciseSheet id={exId} onClose={() => setExId(null)} />
    </div>
  );
}

function AddBenchmarkSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const units = useApp((s) => s.profile!.units);
  const [lift, setLift] = useState<BenchmarkLift>("bench_press");
  const [w, setW] = useState(60);
  const [r, setR] = useState(5);
  const isReps = STANDARDS[lift].unit === "reps";
  return (
    <Sheet open={open} onClose={onClose} title="Add a benchmark set">
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {BENCHMARK_ORDER.map((l) => (
            <button key={l} onClick={() => setLift(l)} className={cx("rounded-full px-3 py-1.5 text-[13px] font-medium", lift === l ? "bg-text text-bg" : "bg-surface-2")}>
              {STANDARDS[l].label}
            </button>
          ))}
        </div>
        <div className={cx("grid rounded-2xl bg-surface-2 py-4", isReps ? "grid-cols-1" : "grid-cols-2")}>
          {!isReps && <Stepper size="md" label={weightUnit(units)} value={toDisplayWeight(w, units)} step={units === "imperial" ? 5 : 2.5} onChange={(v) => setW(fromDisplayWeight(v, units))} />}
          <Stepper size="md" label={isReps ? "Strict reps" : "Reps"} value={r} step={1} min={1} max={isReps ? 100 : 15} onChange={(v) => setR(Math.round(v))} />
        </div>
        <Button
          size="lg"
          block
          onClick={() => {
            const st = useApp.getState();
            useApp.setState({ startingLifts: [...st.startingLifts.filter((x) => x.lift !== lift), { lift, weight: isReps ? 0 : w, reps: r, date: new Date().toISOString() }] });
            onClose();
          }}
        >
          Save
        </Button>
        <p className="text-caption text-text-3">Logged workouts take priority over manually added sets.</p>
      </div>
    </Sheet>
  );
}

function AthleticTab() {
  const s = useApp();
  const [test, setTest] = useState<AthleticTest | null>(null);
  const weeks = weeklyCounts(s.sessions, new Date(), 10);
  const max = Math.max(s.profile!.daysPerWeek, ...weeks.map((w) => w.count));
  return (
    <div className="space-y-8">
      <Section title="Performance tests" subtitle="Each quality is tracked on its own. No combined score.">
        <Card className="divide-y divide-line">
          {TEST_ORDER.map((t) => {
            const tr = testTrend(s.tests, t);
            const def = TESTS[t];
            const series = s.tests.filter((x) => x.test === t).sort((a, b) => a.date.localeCompare(b.date));
            return (
              <div key={t} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold">{def.label}</div>
                    <div className="text-caption text-text-3">{def.quality}</div>
                  </div>
                  {tr ? (
                    <div className="flex items-center gap-3">
                      {series.length > 1 && <Sparkline values={series.map((x) => (def.lowerIsBetter ? -x.value : x.value))} width={56} height={24} tone={tr.direction === "improved" ? "positive" : "neutral"} fill={false} />}
                      <div className="tnum text-right text-[18px] font-semibold">
                        {tr.latest.value}
                        <span className="ml-0.5 text-[12px] font-medium text-text-3">{def.unit}</span>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => setTest(t)}>
                      Test
                    </Button>
                  )}
                </div>
                {tr && (
                  <div className="mt-2 flex items-start justify-between gap-3">
                    <p className="text-[13px] text-text-2">{tr.sentence}</p>
                    <button onClick={() => setTest(t)} className="shrink-0 text-[13px] font-medium text-accent">
                      Re-test
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      </Section>

      <Section title="Training consistency" subtitle="Sessions per week">
        <Card className="p-4">
          <div className="flex h-28 items-end gap-2">
            {weeks.map((w, i) => (
              <div key={w.weekStart} className="flex flex-1 flex-col items-center gap-1.5">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${(w.count / max) * 88}px` }}
                  transition={{ delay: i * 0.03 }}
                  className={cx("w-full max-w-[22px] rounded-md", w.count >= s.profile!.daysPerWeek - 1 ? "bg-accent" : "bg-surface-3")}
                  style={{ minHeight: 3 }}
                  title={`${w.count} sessions`}
                />
                <span className="tnum text-[10px] text-text-3">{w.count}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 text-caption text-text-3">Last 10 weeks · target {s.profile!.daysPerWeek} per week</div>
        </Card>
      </Section>

      <TestSheet test={test} onClose={() => setTest(null)} />
    </div>
  );
}

function TestSheet({ test, onClose }: { test: AthleticTest | null; onClose: () => void }) {
  const addTest = useApp((s) => s.addTest);
  const last = useApp((s) => (test ? s.tests.filter((t) => t.test === test).slice(-1)[0] : undefined));
  const def = test ? TESTS[test] : null;
  const [v, setV] = useState<number | null>(null);
  const value = v ?? last?.value ?? (test === "sprint_10m" ? 1.9 : test === "row_1k" ? 210 : test === "broad_jump" ? 220 : test === "vertical_jump" ? 45 : 10);
  return (
    <Sheet
      open={!!test}
      onClose={() => {
        setV(null);
        onClose();
      }}
      title={def?.label}
    >
      {def && test && (
        <div className="space-y-5">
          <p className="text-body text-text-2">{def.how}</p>
          <div className="rounded-2xl bg-surface-2 py-5">
            <Stepper label={def.unit} value={value} step={def.step} min={0} onChange={(x) => setV(Math.round(x * 100) / 100)} />
          </div>
          <Button
            size="lg"
            block
            onClick={() => {
              addTest(test, value);
              setV(null);
              onClose();
            }}
          >
            Save result
          </Button>
        </div>
      )}
    </Sheet>
  );
}

function BodyTab() {
  const s = useApp();
  const units = s.profile!.units;
  const [open, setOpen] = useState(false);
  const [w, setW] = useState(s.profile!.weightKg);
  const trend = weightTrend(s.weights);
  const sorted = [...s.weights].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return (
    <div className="space-y-8">
      <Section title="Body weight" action={<button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-[14px] font-medium text-accent"><Plus size={15} /> Weigh-in</button>}>
        <Card className="p-5">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Current" value={trend ? fmtWeight(trend.current, units, { unit: false }) : last ? fmtWeight(last.kg, units, { unit: false }) : "—"} unit={weightUnit(units)} hint={trend ? "7-day average" : undefined} />
            <Stat label="Weekly trend" value={trend ? `${trend.ratePerWeek > 0 ? "+" : ""}${fmtWeight(trend.ratePerWeek, units, { unit: false })}` : "—"} unit={trend ? weightUnit(units) : undefined} hint={trend ? `${trend.days} days of data` : "Needs 1–2 weeks"} />
            <Stat label="Since start" value={first && last ? `${last.kg - first.kg > 0 ? "+" : ""}${fmtWeight(last.kg - first.kg, units, { unit: false })}` : "—"} unit={weightUnit(units)} />
          </div>
          {sorted.length >= 2 ? (
            <div className="mt-5">
              <Sparkline values={sorted.map((x) => x.kg)} width={480} height={90} className="h-[90px] w-full" />
              <div className="mt-1 flex justify-between text-[11px] text-text-3">
                <span>{new Date(sorted[0].date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                <span>Today</span>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-caption text-text-3">Weigh in a few times a week, ideally in the morning. Trends matter more than single readings.</p>
          )}
        </Card>
      </Section>
      <Sheet open={open} onClose={() => setOpen(false)} title="Log weigh-in">
        <div className="space-y-5">
          <div className="rounded-2xl bg-surface-2 py-5">
            <Stepper label={weightUnit(units)} value={toDisplayWeight(w, units)} step={units === "imperial" ? 0.5 : 0.1} onChange={(v) => setW(fromDisplayWeight(v, units))} />
          </div>
          <Button
            size="lg"
            block
            onClick={() => {
              s.addWeight(Math.round(w * 10) / 10);
              setOpen(false);
            }}
          >
            Save
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

function JourneyTab() {
  const s = useApp();
  const p = s.profile!;
  const ms = useMemo(() => milestones(s.sessions, s.tests, s.weights, p.daysPerWeek), [s.sessions, s.tests, s.weights, p.daysPerWeek]);
  const timeline = [
    ...ms.map((m) => ({ ...m, focus: false })),
    ...s.focusChanges.map((f) => ({ id: `f-${f.date}`, date: f.date, title: `Focus changed to ${FOCUS[f.to].label}`, detail: `From ${FOCUS[f.from].label}. All history kept.`, kind: "start" as const, focus: true })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const totalSessions = s.sessions.filter((x) => x.finishedAt).length;
  return (
    <div className="space-y-8">
      <Card className="grid grid-cols-3 gap-3 p-5">
        <Stat label="Sessions" value={totalSessions} />
        <Stat label="Since" value={new Date(p.createdAt).toLocaleDateString(undefined, { month: "short", year: "2-digit" })} />
        <Stat label="Records" value={ms.filter((m) => m.kind === "pr" || m.kind === "round").length} />
      </Card>
      <Section title="Milestones">
        {timeline.length ? (
          <ol className="relative ml-3 space-y-5 border-l border-line pl-6">
            {timeline.slice(0, 30).map((m) => (
              <li key={m.id} className="relative">
                <span className={cx("absolute -left-[31px] top-1 grid h-3.5 w-3.5 place-items-center rounded-full ring-4 ring-bg", m.kind === "pr" || m.kind === "round" ? "bg-accent" : m.kind === "consistency" ? "bg-positive" : "bg-text-3")} />
                <div className="text-[12px] text-text-3">{new Date(m.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</div>
                <div className="text-[15px] font-semibold">{m.title}</div>
                <div className="text-[13px] text-text-2">{m.detail}</div>
              </li>
            ))}
          </ol>
        ) : (
          <Card>
            <EmptyState title="Milestones appear as you train" body="Personal records, round-number lifts, test bests and consistent weeks are recorded automatically." />
          </Card>
        )}
      </Section>
    </div>
  );
}
