"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, Building2, Home, PersonStanding } from "lucide-react";
import type { ActivityLevel, BenchmarkLift, DietPreference, EquipmentPreset, Experience, FocusId, Goal, Limitation, Profile, Sex, StartingLift, TestResult, Units, WeightDirection } from "@/lib/types";
import { FOCUS, FOCUS_ORDER, describeTradeoffs } from "@/lib/engine/focus";
import { EQUIPMENT_PRESETS } from "@/lib/data/exercises";
import { generatePlan } from "@/lib/engine/planner";
import { useApp } from "@/lib/store/store";
import { FOCUS_ICON } from "@/components/focusIcons";
import { Button, Chip, ChoiceTile, Segmented, Stepper, cx } from "@/components/ui/primitives";
import { DayCard, WeekStrip } from "@/components/PlanPreview";
import { KG_PER_LB, uid } from "@/lib/format";

const STEPS = ["focus", "about", "training", "start", "goals", "plan"] as const;
type Step = (typeof STEPS)[number];

const EXPERIENCE: { v: Experience; t: string; d: string }[] = [
  { v: "new", t: "New to lifting", d: "Less than 6 months of structured training" },
  { v: "some", t: "Some experience", d: "6 months to 2 years" },
  { v: "experienced", t: "Experienced", d: "2 to 5 years of consistent training" },
  { v: "veteran", t: "Very experienced", d: "5+ years, comfortable with all main lifts" },
];

const LIMITS: { v: Limitation; t: string }[] = [
  { v: "shoulder", t: "Shoulder" },
  { v: "elbow", t: "Elbow" },
  { v: "wrist", t: "Wrist" },
  { v: "lower_back", t: "Lower back" },
  { v: "hip", t: "Hip" },
  { v: "knee", t: "Knee" },
  { v: "ankle", t: "Ankle" },
  { v: "neck", t: "Neck" },
];

const GOALS: { v: Goal; t: string }[] = [
  { v: "strength", t: "Strength" },
  { v: "muscle", t: "Muscle growth" },
  { v: "athleticism", t: "Athletic performance" },
  { v: "conditioning", t: "Conditioning" },
  { v: "body_composition", t: "Body composition" },
];

const LIFTS: { lift: BenchmarkLift; t: string; w: number; r: number }[] = [
  { lift: "bench_press", t: "Bench press", w: 60, r: 5 },
  { lift: "back_squat", t: "Back squat", w: 80, r: 5 },
  { lift: "deadlift", t: "Deadlift", w: 100, r: 5 },
  { lift: "overhead_press", t: "Overhead press", w: 40, r: 5 },
];

const DEFAULT_DAYS: Record<number, number[]> = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5] };

export default function Onboarding() {
  const router = useRouter();
  const complete = useApp((s) => s.completeOnboarding);
  const [step, setStep] = useState<Step>("focus");
  const [dir, setDir] = useState(1);

  const [primary, setPrimary] = useState<FocusId | null>(null);
  const [secondary, setSecondary] = useState<FocusId[]>([]);
  const [units, setUnits] = useState<Units>("metric");
  const [name, setName] = useState("");
  const [age, setAge] = useState(28);
  const [sex, setSex] = useState<Sex>("male");
  const [heightCm, setHeightCm] = useState(178);
  const [weightKg, setWeightKg] = useState(75);
  const [experience, setExperience] = useState<Experience>("some");
  const [days, setDays] = useState(4);
  const [minutes, setMinutes] = useState(60);
  const [preset, setPreset] = useState<EquipmentPreset>("full_gym");
  const [limits, setLimits] = useState<Limitation[]>([]);
  const [lifts, setLifts] = useState<Partial<Record<BenchmarkLift, { w: number; r: number }>>>({});
  const [pullUps, setPullUps] = useState<number | null>(null);
  const [vjump, setVjump] = useState<number | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [aesthetic, setAesthetic] = useState<number | null>(null);
  const [direction, setDirection] = useState<WeightDirection>("maintain");
  const [activity, setActivity] = useState<ActivityLevel>("light");
  const [diet, setDiet] = useState<DietPreference>("none");

  const idx = STEPS.indexOf(step);
  const go = (s: Step) => {
    setDir(STEPS.indexOf(s) > idx ? 1 : -1);
    setStep(s);
    window.scrollTo({ top: 0 });
  };
  const next = () => go(STEPS[Math.min(STEPS.length - 1, idx + 1)]);
  const back = () => (idx === 0 ? router.push("/welcome") : go(STEPS[idx - 1]));

  const focus = primary ?? "general";
  const aw = aesthetic ?? FOCUS[focus].defaultAestheticWeight;

  const profile: Profile = useMemo(
    () => ({
      name: name.trim(),
      age,
      sex,
      heightCm,
      weightKg,
      experience,
      primaryFocus: focus,
      secondaryFocus: secondary,
      aestheticWeight: aw,
      goals,
      daysPerWeek: days,
      sessionMinutes: minutes,
      equipmentPreset: preset,
      equipment: EQUIPMENT_PRESETS[preset].equipment,
      trainingDays: DEFAULT_DAYS[days],
      limitations: limits,
      activityLevel: activity,
      weightDirection: direction,
      diet,
      units,
      theme: "system",
      createdAt: new Date().toISOString(),
    }),
    [name, age, sex, heightCm, weightKg, experience, focus, secondary, aw, goals, days, minutes, preset, limits, activity, direction, diet, units],
  );

  const plan = useMemo(
    () =>
      step === "plan"
        ? generatePlan({
            primaryFocus: profile.primaryFocus,
            secondaryFocus: profile.secondaryFocus,
            aestheticWeight: profile.aestheticWeight,
            daysPerWeek: profile.daysPerWeek,
            sessionMinutes: profile.sessionMinutes,
            equipment: profile.equipment,
            experience: profile.experience,
            limitations: profile.limitations,
            trainingDays: profile.trainingDays,
          })
        : null,
    [step, profile],
  );

  const finish = () => {
    const now = new Date().toISOString();
    const starting: StartingLift[] = Object.entries(lifts).map(([lift, v]) => ({ lift: lift as BenchmarkLift, weight: v!.w, reps: v!.r, date: now }));
    if (pullUps !== null) starting.push({ lift: "pull_up", weight: 0, reps: pullUps, date: now });
    const tests: TestResult[] = [];
    if (pullUps !== null) tests.push({ id: uid("t"), test: "pull_up_max", value: pullUps, date: now });
    if (vjump !== null) tests.push({ id: uid("t"), test: "vertical_jump", value: vjump, date: now });
    complete(profile, starting, tests);
    router.replace("/today");
  };

  const wUnit = units === "imperial" ? "lb" : "kg";
  const toW = (kg: number) => (units === "imperial" ? Math.round(kg / KG_PER_LB) : kg);
  const fromW = (v: number) => (units === "imperial" ? Math.round(v * KG_PER_LB * 10) / 10 : v);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col px-5 pt-[max(env(safe-area-inset-top),12px)]">
      <div className="flex h-14 items-center gap-3">
        <button onClick={back} aria-label="Back" className="-ml-2 grid h-10 w-10 place-items-center rounded-full text-text-2 hover:bg-surface">
          <ChevronLeft size={22} />
        </button>
        <div className="flex flex-1 gap-1" aria-label={`Step ${idx + 1} of ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <div key={s} className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
              <motion.div className="h-full bg-text" initial={false} animate={{ width: i <= idx ? "100%" : "0%" }} transition={{ duration: 0.35 }} />
            </div>
          ))}
        </div>
        {(step === "start" || step === "goals") && (
          <button onClick={next} className="text-[14px] font-medium text-text-2 hover:text-text">
            Skip
          </button>
        )}
      </div>

      <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.div
          key={step}
          custom={dir}
          initial={{ opacity: 0, x: dir * 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: dir * -24 }}
          transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          className="flex-1 pb-36 pt-4"
        >
          {step === "focus" && (
            <>
              <StepTitle title="What are you training for?" sub="Pick your main focus. You can add a secondary focus and change it any time without losing progress." />
              <div className="grid gap-2">
                {FOCUS_ORDER.map((f) => {
                  const Icon = FOCUS_ICON[f];
                  return (
                    <ChoiceTile
                      key={f}
                      selected={primary === f}
                      onClick={() => {
                        setPrimary(f);
                        setSecondary((s) => s.filter((x) => x !== f));
                      }}
                      icon={<Icon size={19} />}
                      title={FOCUS[f].label}
                      detail={FOCUS[f].tagline}
                    />
                  );
                })}
              </div>
              {primary && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-8">
                  <div className="text-headline">Add a secondary focus</div>
                  <p className="mb-3 text-caption text-text-2">Optional, up to two. Your main focus stays the priority.</p>
                  <div className="flex flex-wrap gap-2">
                    {FOCUS_ORDER.filter((f) => f !== primary).map((f) => (
                      <Chip key={f} selected={secondary.includes(f)} onClick={() => setSecondary((s) => (s.includes(f) ? s.filter((x) => x !== f) : s.length >= 2 ? [s[1], f] : [...s, f]))}>
                        {FOCUS[f].short}
                      </Chip>
                    ))}
                  </div>
                  {secondary.length > 0 && (
                    <div className="mt-4 space-y-2 rounded-2xl bg-surface p-4 text-caption text-text-2">
                      {describeTradeoffs(primary, secondary).map((t) => (
                        <p key={t}>{t}</p>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </>
          )}

          {step === "about" && (
            <>
              <StepTitle title="About you" sub="Used to set starting weights, compare strength fairly and estimate your energy needs." />
              <div className="space-y-6">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="First name (optional)" aria-label="First name" className="h-12 w-full rounded-xl bg-surface px-4 text-[16px] outline-none placeholder:text-text-3 focus:ring-2 focus:ring-accent" />
                <Segmented
                  options={[
                    { value: "metric", label: "kg · cm" },
                    { value: "imperial", label: "lb · in" },
                  ]}
                  value={units}
                  onChange={setUnits}
                />
                <div className="grid grid-cols-2 gap-y-6 rounded-2xl bg-surface py-6">
                  <Stepper label="Age" value={age} onChange={(v) => setAge(Math.round(v))} step={1} min={14} max={90} size="md" />
                  <Stepper label={`Weight (${wUnit})`} value={toW(weightKg)} onChange={(v) => setWeightKg(fromW(v))} step={units === "imperial" ? 1 : 0.5} min={30} max={600} size="md" />
                  <div className="col-span-2">
                    <Stepper
                      label={units === "imperial" ? "Height (in)" : "Height (cm)"}
                      value={units === "imperial" ? Math.round(heightCm / 2.54) : heightCm}
                      onChange={(v) => setHeightCm(units === "imperial" ? Math.round(v * 2.54) : Math.round(v))}
                      step={1}
                      min={units === "imperial" ? 48 : 120}
                      max={units === "imperial" ? 90 : 230}
                      size="md"
                    />
                  </div>
                </div>
                <div>
                  <Label>Sex</Label>
                  <p className="mb-2 text-caption text-text-3">Only used to choose the right strength standards and energy equation.</p>
                  <Segmented
                    options={[
                      { value: "male", label: "Male" },
                      { value: "female", label: "Female" },
                      { value: "unspecified", label: "Prefer not to say" },
                    ]}
                    value={sex}
                    onChange={setSex}
                  />
                </div>
                <div>
                  <Label>Training experience</Label>
                  <div className="mt-2 grid gap-2">
                    {EXPERIENCE.map((e) => (
                      <ChoiceTile key={e.v} selected={experience === e.v} onClick={() => setExperience(e.v)} title={e.t} detail={e.d} />
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {step === "training" && (
            <>
              <StepTitle title="Your training" sub="We'll fit the plan around your week, not the other way round." />
              <div className="space-y-7">
                <div>
                  <Label>Days per week</Label>
                  <Segmented className="mt-2" options={[2, 3, 4, 5, 6].map((d) => ({ value: d, label: String(d) }))} value={days} onChange={setDays} />
                </div>
                <div>
                  <Label>Session length</Label>
                  <Segmented className="mt-2" options={[30, 45, 60, 75, 90].map((d) => ({ value: d, label: `${d}′` }))} value={minutes} onChange={setMinutes} />
                </div>
                <div>
                  <Label>Where you train</Label>
                  <div className="mt-2 grid gap-2">
                    {(Object.keys(EQUIPMENT_PRESETS) as EquipmentPreset[]).map((p) => (
                      <ChoiceTile
                        key={p}
                        selected={preset === p}
                        onClick={() => setPreset(p)}
                        icon={p === "full_gym" ? <Building2 size={19} /> : p === "home_gym" ? <Home size={19} /> : <PersonStanding size={19} />}
                        title={EQUIPMENT_PRESETS[p].label}
                        detail={EQUIPMENT_PRESETS[p].detail}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Anything to work around?</Label>
                  <p className="mb-2 text-caption text-text-3">Optional. Movements that load these areas are left out of your plan.</p>
                  <div className="flex flex-wrap gap-2">
                    {LIMITS.map((l) => (
                      <Chip key={l.v} selected={limits.includes(l.v)} onClick={() => setLimits((s) => (s.includes(l.v) ? s.filter((x) => x !== l.v) : [...s, l.v]))}>
                        {l.t}
                      </Chip>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {step === "start" && (
            <>
              <StepTitle title="Your starting point" sub="Optional. A recent set you're confident in lets us suggest accurate first weights and benchmark your strength." />
              <div className="space-y-3">
                {LIFTS.map((l) => {
                  const v = lifts[l.lift];
                  return (
                    <div key={l.lift} className="rounded-2xl bg-surface p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-[15px] font-medium">{l.t}</div>
                        <button
                          onClick={() => setLifts((s) => ({ ...s, [l.lift]: v ? undefined : { w: l.w, r: l.r } }))}
                          className={cx("text-[14px] font-medium", v ? "text-text-3" : "text-accent")}
                        >
                          {v ? "Remove" : "Add a set"}
                        </button>
                      </div>
                      {v && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 grid grid-cols-2">
                          <Stepper size="md" label={`Weight (${wUnit})`} value={toW(v.w)} step={units === "imperial" ? 5 : 2.5} min={0} onChange={(x) => setLifts((s) => ({ ...s, [l.lift]: { ...v, w: fromW(x) } }))} />
                          <Stepper size="md" label="Reps" value={v.r} step={1} min={1} max={15} onChange={(x) => setLifts((s) => ({ ...s, [l.lift]: { ...v, r: Math.round(x) } }))} />
                        </motion.div>
                      )}
                    </div>
                  );
                })}
                <div className="rounded-2xl bg-surface p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-[15px] font-medium">Max strict pull-ups</div>
                    <button onClick={() => setPullUps(pullUps === null ? 5 : null)} className={cx("text-[14px] font-medium", pullUps !== null ? "text-text-3" : "text-accent")}>
                      {pullUps !== null ? "Remove" : "Add"}
                    </button>
                  </div>
                  {pullUps !== null && (
                    <div className="mt-4">
                      <Stepper size="md" label="Reps" value={pullUps} step={1} min={0} max={50} onChange={(x) => setPullUps(Math.round(x))} />
                    </div>
                  )}
                </div>
                <div className="rounded-2xl bg-surface p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-[15px] font-medium">Vertical jump</div>
                    <button onClick={() => setVjump(vjump === null ? 45 : null)} className={cx("text-[14px] font-medium", vjump !== null ? "text-text-3" : "text-accent")}>
                      {vjump !== null ? "Remove" : "Add"}
                    </button>
                  </div>
                  {vjump !== null && (
                    <div className="mt-4">
                      <Stepper size="md" label="Centimetres" value={vjump} step={1} min={5} max={120} onChange={(x) => setVjump(Math.round(x))} />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {step === "goals" && (
            <>
              <StepTitle title="Your goals" sub="Fine-tune what matters most. Sensible defaults are already set." />
              <div className="space-y-7">
                <div>
                  <Label>What do you want to improve?</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {GOALS.map((g) => (
                      <Chip key={g.v} selected={goals.includes(g.v)} onClick={() => setGoals((s) => (s.includes(g.v) ? s.filter((x) => x !== g.v) : [...s, g.v]))}>
                        {g.t}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Performance or physique?</Label>
                  <p className="mb-3 text-caption text-text-3">Every plan trains both. This sets the balance.</p>
                  <input type="range" min={0} max={100} step={5} value={Math.round(aw * 100)} onChange={(e) => setAesthetic(Number(e.target.value) / 100)} className="w-full accent-[var(--accent)]" aria-label="Balance between athletic function and physique" />
                  <div className="mt-1 flex justify-between text-caption text-text-3">
                    <span>Athletic function</span>
                    <span>Physique</span>
                  </div>
                </div>
                <div>
                  <Label>Body weight</Label>
                  <Segmented
                    className="mt-2"
                    options={[
                      { value: "lose", label: "Lose" },
                      { value: "maintain", label: "Maintain" },
                      { value: "gain", label: "Gain" },
                    ]}
                    value={direction}
                    onChange={setDirection}
                  />
                </div>
                <div>
                  <Label>Daily activity outside training</Label>
                  <Segmented
                    className="mt-2"
                    size="sm"
                    options={[
                      { value: "sedentary", label: "Desk" },
                      { value: "light", label: "Light" },
                      { value: "active", label: "Active" },
                      { value: "very_active", label: "Physical job" },
                    ]}
                    value={activity}
                    onChange={setActivity}
                  />
                </div>
                <div>
                  <Label>Dietary preference</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(["none", "vegetarian", "vegan", "pescatarian", "halal"] as DietPreference[]).map((d) => (
                      <Chip key={d} selected={diet === d} onClick={() => setDiet(d)}>
                        {d === "none" ? "No preference" : d.charAt(0).toUpperCase() + d.slice(1)}
                      </Chip>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {step === "plan" && plan && (
            <>
              <StepTitle title="Your training starts here." sub={`${FOCUS[focus].label}${secondary.length ? " + " + secondary.map((s) => FOCUS[s].short).join(" + ") : ""} · ${plan.splitName}`} />
              <div className="rounded-2xl bg-surface p-3">
                <WeekStrip plan={plan} />
              </div>
              <div className="mt-4 space-y-2">
                {plan.days.map((d, i) => (
                  <DayCard key={d.id} day={d} defaultOpen={i === 0} />
                ))}
              </div>
              <div className="mt-6 space-y-2">
                <div className="text-headline">Why this plan</div>
                <ul className="space-y-2 text-[14px] leading-relaxed text-text-2">
                  {[...plan.rationale, ...plan.tradeoffs].map((r) => (
                    <li key={r} className="flex gap-2">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-text-3" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="pb-safe pointer-events-none fixed inset-x-0 bottom-0 bg-gradient-to-t from-bg via-bg to-transparent pt-8">
        <div className="pointer-events-auto mx-auto max-w-[560px] px-5 pb-5">
          {step === "plan" ? (
            <Button size="lg" block onClick={finish}>
              Start training
            </Button>
          ) : (
            <Button size="lg" block onClick={next} disabled={step === "focus" && !primary}>
              {step === "goals" ? "Build my plan" : "Continue"}
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}

function StepTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-title">{title}</h1>
      {sub && <p className="mt-2 text-body text-text-2">{sub}</p>}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[15px] font-semibold">{children}</div>;
}
