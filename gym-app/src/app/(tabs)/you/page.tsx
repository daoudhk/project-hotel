"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronRight, Download, HeartPulse, Smartphone, Trash2, Watch } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Sheet } from "@/components/ui/Sheet";
import { FOCUS_ICON } from "@/components/focusIcons";
import { DayCard } from "@/components/PlanPreview";
import { Button, Card, Chip, ChoiceTile, Pill, Section, Segmented, Stepper, Toggle } from "@/components/ui/primitives";
import { useApp } from "@/lib/store/store";
import { FOCUS, FOCUS_ORDER, describeFocusChange, describeTradeoffs } from "@/lib/engine/focus";
import { generatePlan } from "@/lib/engine/planner";
import { EQUIPMENT_PRESETS } from "@/lib/data/exercises";
import { HEALTH_PROVIDERS } from "@/lib/integrations/health";
import { WEEKDAYS_SHORT, fmtHeight, fmtWeight, fromDisplayWeight, toDisplayWeight, weightUnit } from "@/lib/format";
import type { EquipmentPreset, FocusId, Limitation, Profile } from "@/lib/types";

const LIMITS: Limitation[] = ["shoulder", "elbow", "wrist", "lower_back", "hip", "knee", "ankle", "neck"];

export default function YouPage() {
  const s = useApp();
  const p = s.profile!;
  const [focusOpen, setFocusOpen] = useState(false);
  const [sheet, setSheet] = useState<null | "body" | "training" | "goals" | "delete">(null);

  return (
    <>
      <PageHeader eyebrow={p.name || "Your profile"} title="You" context="you" />

      <Card className="p-5">
        <div className="text-micro text-text-3">Athletic focus</div>
        <div className="mt-3 flex items-center gap-3">
          {(() => {
            const Icon = FOCUS_ICON[p.primaryFocus];
            return (
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-accent-ink">
                <Icon size={22} />
              </span>
            );
          })()}
          <div className="min-w-0 flex-1">
            <div className="text-[19px] font-semibold tracking-tight">{FOCUS[p.primaryFocus].label}</div>
            <div className="text-caption text-text-2">{p.secondaryFocus.length ? `with ${p.secondaryFocus.map((f) => FOCUS[f].short).join(" and ")}` : FOCUS[p.primaryFocus].tagline}</div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {FOCUS[p.primaryFocus].priorities.slice(0, 5).map((x) => (
            <Pill key={x}>{x}</Pill>
          ))}
        </div>
        <Button className="mt-5" variant="secondary" block onClick={() => setFocusOpen(true)}>
          Change focus
        </Button>
      </Card>

      <Section title="Profile" className="mt-8">
        <Card className="divide-y divide-line">
          <Row label="Body" value={`${p.age} y · ${fmtHeight(p.heightCm, p.units)} · ${fmtWeight(p.weightKg, p.units)}`} onClick={() => setSheet("body")} />
          <Row label="Training" value={`${p.daysPerWeek} days · ${p.sessionMinutes} min · ${EQUIPMENT_PRESETS[p.equipmentPreset].label}`} onClick={() => setSheet("training")} />
          <Row label="Limitations" value={p.limitations.length ? p.limitations.map((l) => l.replace("_", " ")).join(", ").replace(/^./, (c) => c.toUpperCase()) : "None"} onClick={() => setSheet("training")} />
          <Row label="Goals & nutrition" value={`${p.weightDirection === "lose" ? "Lose" : p.weightDirection === "gain" ? "Gain" : "Maintain"} weight · ${p.diet === "none" ? "No diet preference" : p.diet.charAt(0).toUpperCase() + p.diet.slice(1)}`} onClick={() => setSheet("goals")} />
        </Card>
      </Section>

      <Section title="Connected health data" subtitle="Optional. Nothing connects without your consent." className="mt-8">
        <Card className="divide-y divide-line">
          {HEALTH_PROVIDERS.map((h) => (
            <div key={h.id} className="flex items-center gap-3 px-4 py-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-text-2">{h.icon === "watch" ? <Watch size={17} /> : h.icon === "phone" ? <Smartphone size={17} /> : <HeartPulse size={17} />}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-medium">{h.name}</div>
                <div className="text-caption text-text-3">{h.reads.join(", ")}</div>
              </div>
              <Pill>{h.availability}</Pill>
            </div>
          ))}
        </Card>
        <p className="px-1 text-caption text-text-3">When connected, measured values (like resting heart rate) are labelled separately from estimates and anything you self-report.</p>
      </Section>

      <Section title="Preferences" className="mt-8">
        <Card className="divide-y divide-line">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-[15px]">Units</span>
            <Segmented
              size="sm"
              className="w-40"
              options={[
                { value: "metric", label: "kg" },
                { value: "imperial", label: "lb" },
              ]}
              value={p.units}
              onChange={(units) => s.updateProfile({ units })}
            />
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-[15px]">Appearance</span>
            <Segmented
              size="sm"
              className="w-52"
              options={[
                { value: "system", label: "Auto" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
              value={p.theme}
              onChange={(theme) => s.updateProfile({ theme })}
            />
          </div>
          <div className="flex items-start justify-between gap-4 px-4 py-3">
            <div>
              <div className="text-[15px]">Natural-language coach replies</div>
              <p className="mt-0.5 text-caption text-text-3">Sends your question and the coach&apos;s drafted answer (no profile or history) to a language model on our server for more natural wording. Numbers and recommendations never change.</p>
            </div>
            <Toggle checked={s.consents.assistantCloud} onChange={(v) => s.setConsent("assistantCloud", v)} label="Natural-language coach replies" />
          </div>
        </Card>
      </Section>

      <Section title="Privacy & data" className="mt-8">
        <Card className="divide-y divide-line">
          <button onClick={() => exportData()} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
            <Download size={17} className="text-text-2" />
            <span className="flex-1 text-[15px]">Export all my data</span>
            <span className="text-caption text-text-3">JSON</span>
          </button>
          <button onClick={() => setSheet("delete")} className="flex w-full items-center gap-3 px-4 py-3 text-left text-critical hover:bg-surface-2">
            <Trash2 size={17} />
            <span className="flex-1 text-[15px]">{s.isDemo ? "Exit demo and start fresh" : "Delete all my data"}</span>
          </button>
        </Card>
        <p className="px-1 text-caption text-text-3">Everything is stored on this device only. There is no account yet, so nothing is sent anywhere unless you turn on natural-language coach replies.</p>
      </Section>

      <Section title="How Gymnasio decides" className="mt-8 mb-4">
        <Card className="space-y-3 p-4 text-[14px] leading-relaxed text-text-2">
          <p>Plans, weights, benchmarks, recovery adjustments and nutrition targets come from documented, deterministic rules you can inspect. The same inputs always produce the same answer.</p>
          <p>Estimates are labelled as estimates. When there isn&apos;t enough data, we say so instead of guessing.</p>
          <p>Gymnasio gives training guidance, not medical advice. For pain, injury or health conditions, speak to a qualified professional.</p>
        </Card>
      </Section>

      <FocusSheet open={focusOpen} onClose={() => setFocusOpen(false)} />
      <BodySheet open={sheet === "body"} onClose={() => setSheet(null)} />
      <TrainingSheet open={sheet === "training"} onClose={() => setSheet(null)} />
      <GoalsSheet open={sheet === "goals"} onClose={() => setSheet(null)} />
      <DeleteSheet open={sheet === "delete"} onClose={() => setSheet(null)} />
    </>
  );
}

function Row({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-2">
      <span className="w-28 shrink-0 text-[15px]">{label}</span>
      <span className="min-w-0 flex-1 truncate text-right text-[14px] text-text-2">{value}</span>
      <ChevronRight size={16} className="shrink-0 text-text-3" />
    </button>
  );
}

function exportData() {
  const st = useApp.getState();
  const data = {
    exportedAt: new Date().toISOString(),
    profile: st.profile,
    plan: st.plan,
    sessions: st.sessions,
    checkIns: st.checkIns,
    weights: st.weights,
    tests: st.tests,
    startingLifts: st.startingLifts,
    meals: st.meals,
    savedMeals: st.savedMeals,
    water: st.water,
    focusChanges: st.focusChanges,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gymnasio-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ── Flow D: change athletic focus ──────────────────────────────── */

function FocusSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useApp();
  const p = s.profile!;
  const [primary, setPrimary] = useState<FocusId>(p.primaryFocus);
  const [secondary, setSecondary] = useState<FocusId[]>(p.secondaryFocus);
  const [step, setStep] = useState<"pick" | "review">("pick");
  const preview = useMemo(
    () =>
      step === "review"
        ? generatePlan({ primaryFocus: primary, secondaryFocus: secondary, daysPerWeek: p.daysPerWeek, sessionMinutes: p.sessionMinutes, equipment: p.equipment, experience: p.experience, limitations: p.limitations, trainingDays: p.trainingDays })
        : null,
    [step, primary, secondary, p],
  );
  const change = describeFocusChange(p.primaryFocus, primary);
  const close = () => {
    setStep("pick");
    setPrimary(p.primaryFocus);
    setSecondary(p.secondaryFocus);
    onClose();
  };
  const unchanged = primary === p.primaryFocus && secondary.join() === p.secondaryFocus.join();

  return (
    <Sheet
      open={open}
      onClose={close}
      title={step === "pick" ? "Change your focus" : "Review changes"}
      size="lg"
      footer={
        step === "pick" ? (
          <Button size="lg" block disabled={unchanged} onClick={() => setStep("review")} icon={<ArrowRight size={18} />}>
            Preview new plan
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button size="lg" variant="secondary" onClick={() => setStep("pick")}>
              Back
            </Button>
            <Button
              size="lg"
              block
              onClick={() => {
                s.changeFocus(primary, secondary);
                close();
              }}
            >
              Switch to {FOCUS[primary].short}
            </Button>
          </div>
        )
      }
    >
      {step === "pick" ? (
        <div className="space-y-6">
          <div className="grid gap-2">
            {FOCUS_ORDER.map((f) => {
              const Icon = FOCUS_ICON[f];
              return (
                <ChoiceTile
                  key={f}
                  selected={primary === f}
                  onClick={() => {
                    setPrimary(f);
                    setSecondary((x) => x.filter((y) => y !== f));
                  }}
                  icon={<Icon size={18} />}
                  title={FOCUS[f].label}
                  detail={f === p.primaryFocus ? "Current focus" : FOCUS[f].tagline}
                />
              );
            })}
          </div>
          <div>
            <div className="text-[15px] font-semibold">Secondary focus</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {FOCUS_ORDER.filter((f) => f !== primary).map((f) => (
                <Chip key={f} selected={secondary.includes(f)} onClick={() => setSecondary((x) => (x.includes(f) ? x.filter((y) => y !== f) : x.length >= 2 ? [x[1], f] : [...x, f]))}>
                  {FOCUS[f].short}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {primary !== p.primaryFocus && (
            <div className="space-y-4">
              <p className="text-body text-text-2">
                Moving from <span className="font-medium text-text">{FOCUS[p.primaryFocus].label}</span> to <span className="font-medium text-text">{FOCUS[primary].label}</span>.
              </p>
              <ChangeList title="More emphasis on" items={change.gained} tone="positive" />
              {change.reduced.length > 0 && <ChangeList title="Less emphasis on" items={change.reduced} tone="neutral" />}
              <ChangeList title="Kept" items={change.kept} tone="accent" />
            </div>
          )}
          {secondary.length > 0 && (
            <div className="space-y-2 rounded-2xl bg-surface-2 p-4 text-[14px] text-text-2">
              {describeTradeoffs(primary, secondary).map((t) => (
                <p key={t}>{t}</p>
              ))}
            </div>
          )}
          {preview && (
            <div>
              <div className="mb-2 text-[15px] font-semibold">New week · {preview.splitName}</div>
              <div className="space-y-2">
                {preview.days.map((d) => (
                  <DayCard key={d.id} day={d} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

function ChangeList({ title, items, tone }: { title: string; items: string[]; tone: "positive" | "neutral" | "accent" }) {
  return (
    <div>
      <div className="text-micro text-text-3">{title}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((i) => (
          <Pill key={i} tone={tone}>
            {i}
          </Pill>
        ))}
      </div>
    </div>
  );
}

/* ── Edit sheets ────────────────────────────────────────────────── */

function useDraft(open: boolean) {
  const p = useApp((s) => s.profile!);
  const [draft, setDraft] = useState<Profile>(p);
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setDraft(p);
  }
  return [draft, setDraft] as const;
}

function BodySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useApp();
  const [d, setD] = useDraft(open);
  const u = d.units;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Body"
      footer={
        <Button
          size="lg"
          block
          onClick={() => {
            if (d.weightKg !== s.profile!.weightKg) s.addWeight(d.weightKg);
            s.updateProfile({ age: d.age, sex: d.sex, heightCm: d.heightCm, name: d.name });
            onClose();
          }}
        >
          Save
        </Button>
      }
    >
      <div className="space-y-5">
        <input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="First name" aria-label="First name" className="h-11 w-full rounded-xl bg-surface-2 px-3 text-[15px] outline-none focus:ring-2 focus:ring-accent" />
        <div className="grid grid-cols-2 gap-y-5 rounded-2xl bg-surface-2 py-5">
          <Stepper size="md" label="Age" value={d.age} step={1} min={14} max={90} onChange={(v) => setD({ ...d, age: Math.round(v) })} />
          <Stepper size="md" label={weightUnit(u)} value={toDisplayWeight(d.weightKg, u)} step={u === "imperial" ? 1 : 0.5} onChange={(v) => setD({ ...d, weightKg: fromDisplayWeight(v, u) })} />
          <div className="col-span-2">
            <Stepper size="md" label={u === "imperial" ? "Height (in)" : "Height (cm)"} value={u === "imperial" ? Math.round(d.heightCm / 2.54) : d.heightCm} step={1} onChange={(v) => setD({ ...d, heightCm: u === "imperial" ? Math.round(v * 2.54) : Math.round(v) })} />
          </div>
        </div>
        <Segmented
          options={[
            { value: "male", label: "Male" },
            { value: "female", label: "Female" },
            { value: "unspecified", label: "Not specified" },
          ]}
          value={d.sex}
          onChange={(sex) => setD({ ...d, sex })}
        />
      </div>
    </Sheet>
  );
}

function TrainingSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useApp();
  const [d, setD] = useDraft(open);
  const setDays = (n: number) => {
    const defaults: Record<number, number[]> = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5] };
    setD({ ...d, daysPerWeek: n, trainingDays: defaults[n] });
  };
  const toggleDay = (i: number) => {
    const has = d.trainingDays.includes(i);
    let next = has ? d.trainingDays.filter((x) => x !== i) : [...d.trainingDays, i].sort();
    if (next.length > d.daysPerWeek) next = next.slice(1);
    setD({ ...d, trainingDays: next });
  };
  const valid = d.trainingDays.length === d.daysPerWeek;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Training"
      size="lg"
      footer={
        <Button
          size="lg"
          block
          disabled={!valid}
          onClick={() => {
            s.updateProfile({ daysPerWeek: d.daysPerWeek, trainingDays: d.trainingDays, sessionMinutes: d.sessionMinutes, equipmentPreset: d.equipmentPreset, equipment: EQUIPMENT_PRESETS[d.equipmentPreset].equipment, limitations: d.limitations }, { regenerate: true });
            onClose();
          }}
        >
          {valid ? "Rebuild my plan" : `Pick ${d.daysPerWeek - d.trainingDays.length} more day${d.daysPerWeek - d.trainingDays.length === 1 ? "" : "s"}`}
        </Button>
      }
    >
      <div className="space-y-6">
        <div>
          <div className="mb-2 text-[15px] font-semibold">Days per week</div>
          <Segmented options={[2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))} value={d.daysPerWeek} onChange={setDays} />
          <div className="mt-3 grid grid-cols-7 gap-1.5">
            {WEEKDAYS_SHORT.map((w, i) => (
              <button key={w} onClick={() => toggleDay(i)} aria-pressed={d.trainingDays.includes(i)} className={`h-10 rounded-xl text-[13px] font-medium ${d.trainingDays.includes(i) ? "bg-text text-bg" : "bg-surface-2 text-text-2"}`}>
                {w}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-[15px] font-semibold">Session length</div>
          <Segmented options={[30, 45, 60, 75, 90].map((n) => ({ value: n, label: `${n}′` }))} value={d.sessionMinutes} onChange={(sessionMinutes) => setD({ ...d, sessionMinutes })} />
        </div>
        <div>
          <div className="mb-2 text-[15px] font-semibold">Equipment</div>
          <div className="grid gap-2">
            {(Object.keys(EQUIPMENT_PRESETS) as EquipmentPreset[]).map((k) => (
              <ChoiceTile key={k} selected={d.equipmentPreset === k} onClick={() => setD({ ...d, equipmentPreset: k })} title={EQUIPMENT_PRESETS[k].label} detail={EQUIPMENT_PRESETS[k].detail} />
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-[15px] font-semibold">Injuries & limitations</div>
          <div className="flex flex-wrap gap-2">
            {LIMITS.map((l) => (
              <Chip key={l} selected={d.limitations.includes(l)} onClick={() => setD({ ...d, limitations: d.limitations.includes(l) ? d.limitations.filter((x) => x !== l) : [...d.limitations, l] })}>
                <span className="capitalize">{l.replace("_", " ")}</span>
              </Chip>
            ))}
          </div>
        </div>
        <p className="text-caption text-text-3">Your plan is rebuilt with these settings. Workout history, records and benchmarks are kept.</p>
      </div>
    </Sheet>
  );
}

function GoalsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useApp();
  const [d, setD] = useDraft(open);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Goals & nutrition"
      footer={
        <Button
          size="lg"
          block
          onClick={() => {
            const regen = d.aestheticWeight !== s.profile!.aestheticWeight;
            s.updateProfile({ weightDirection: d.weightDirection, activityLevel: d.activityLevel, diet: d.diet, aestheticWeight: d.aestheticWeight }, { regenerate: regen });
            onClose();
          }}
        >
          Save
        </Button>
      }
    >
      <div className="space-y-6">
        <div>
          <div className="mb-2 text-[15px] font-semibold">Body weight</div>
          <Segmented
            options={[
              { value: "lose", label: "Lose" },
              { value: "maintain", label: "Maintain" },
              { value: "gain", label: "Gain" },
            ]}
            value={d.weightDirection}
            onChange={(weightDirection) => setD({ ...d, weightDirection })}
          />
        </div>
        <div>
          <div className="mb-2 text-[15px] font-semibold">Daily activity</div>
          <Segmented
            size="sm"
            options={[
              { value: "sedentary", label: "Desk" },
              { value: "light", label: "Light" },
              { value: "active", label: "Active" },
              { value: "very_active", label: "Physical" },
            ]}
            value={d.activityLevel}
            onChange={(activityLevel) => setD({ ...d, activityLevel })}
          />
        </div>
        <div>
          <div className="mb-2 text-[15px] font-semibold">Performance or physique</div>
          <input type="range" min={0} max={100} step={5} value={Math.round(d.aestheticWeight * 100)} onChange={(e) => setD({ ...d, aestheticWeight: Number(e.target.value) / 100 })} className="w-full accent-[var(--accent)]" aria-label="Balance between athletic function and physique" />
          <div className="mt-1 flex justify-between text-caption text-text-3">
            <span>Athletic function</span>
            <span>Physique</span>
          </div>
        </div>
        <div>
          <div className="mb-2 text-[15px] font-semibold">Dietary preference</div>
          <div className="flex flex-wrap gap-2">
            {(["none", "vegetarian", "vegan", "pescatarian", "halal"] as const).map((x) => (
              <Chip key={x} selected={d.diet === x} onClick={() => setD({ ...d, diet: x })}>
                {x === "none" ? "No preference" : x.charAt(0).toUpperCase() + x.slice(1)}
              </Chip>
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function DeleteSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useApp();
  const router = useRouter();
  return (
    <Sheet open={open} onClose={onClose} title={s.isDemo ? "Exit demo?" : "Delete all data?"}>
      <div className="space-y-4">
        <p className="text-body text-text-2">{s.isDemo ? "The demo athlete and their sample history will be removed, and you can set up your own profile." : "This permanently removes your profile, plan, workouts, check-ins, nutrition logs and records from this device. Export first if you want a copy."}</p>
        <Button
          size="lg"
          block
          variant="danger"
          onClick={() => {
            s.resetAll();
            onClose();
            router.replace("/welcome");
          }}
        >
          {s.isDemo ? "Exit demo" : "Delete everything"}
        </Button>
        <Button size="md" block variant="plain" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Sheet>
  );
}
