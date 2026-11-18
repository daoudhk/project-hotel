"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Droplet, Minus, Plus, ScanBarcode, Search, Sparkles, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Sheet } from "@/components/ui/Sheet";
import { BasisTag, Button, Card, Meter, Ring, Section, Segmented, Stepper } from "@/components/ui/primitives";
import { useApp } from "@/lib/store/store";
import { useNutrition, useToday } from "@/lib/store/derived";
import { FOODS, searchFoods } from "@/lib/data/foods";
import { parseMealDescription } from "@/lib/engine/mealParser";
import { sumMeals } from "@/lib/engine/nutrition";
import { localDate, weekdayIndex } from "@/lib/format";
import type { FoodItem, MealEntry } from "@/lib/types";

const MEALS: MealEntry["meal"][] = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_LABEL = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snacks" };

function defaultMeal(): MealEntry["meal"] {
  const h = new Date().getHours();
  return h < 11 ? "breakfast" : h < 15 ? "lunch" : h < 21 ? "dinner" : "snack";
}

export default function NutritionPage() {
  const s = useApp();
  const n = useNutrition();
  const t = useToday();
  const [addFor, setAddFor] = useState<MealEntry["meal"] | null>(null);
  const [edit, setEdit] = useState<MealEntry | null>(null);
  const [how, setHow] = useState(false);
  if (!n) return null;

  const today = localDate();
  const meals = s.meals.filter((m) => m.date === today);
  const eaten = sumMeals(meals);
  const training = t.isTrainingDay && t.adapted?.day.emphasis !== "recovery";
  const target = training ? n.plan.trainingDay : n.plan.restDay;
  const water = s.water[today] ?? 0;
  const left = target.kcal - eaten.kcal;

  const tomorrow = s.plan?.days.find((d) => d.weekday === (weekdayIndex() + 1) % 7);
  const guidance = training
    ? `Training day: ${target.carbs} g carbohydrate to fuel ${t.adapted?.day.title ?? "your session"}. A carb-and-protein meal 2–3 hours before helps.`
    : tomorrow && (tomorrow.emphasis === "lower" || tomorrow.emphasis === "legs" || tomorrow.emphasis === "conditioning")
      ? `Rest day, but tomorrow is ${tomorrow.title}. Make sure tonight's dinner includes a solid carbohydrate portion.`
      : "Rest day: slightly fewer carbohydrates, same protein. Recovery is built from protein and sleep.";

  return (
    <>
      <PageHeader eyebrow={training ? "Training day" : "Rest day"} title="Nutrition" context="nutrition" />

      <Card className="p-5">
        <div className="flex items-center gap-5">
          <Ring value={eaten.kcal / target.kcal} size={112} stroke={10} tone={eaten.kcal > target.kcal * 1.08 ? "caution" : "accent"}>
            <div className="text-center">
              <div className="tnum text-[24px] font-semibold leading-none tracking-tight">{Math.abs(Math.round(left)).toLocaleString()}</div>
              <div className="mt-1 text-[11px] text-text-3">{left >= 0 ? "kcal left" : "kcal over"}</div>
            </div>
          </Ring>
          <div className="flex-1 space-y-3">
            <Macro label="Protein" eaten={eaten.protein} target={target.protein} tone="positive" />
            <Macro label="Carbs" eaten={eaten.carbs} target={target.carbs} tone="accent" />
            <Macro label="Fat" eaten={eaten.fat} target={target.fat} tone="neutral" />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
          <span className="tnum text-[13px] text-text-2">
            {Math.round(eaten.kcal).toLocaleString()} of {target.kcal.toLocaleString()} kcal
          </span>
          <button onClick={() => setHow(true)} className="flex items-center gap-2 text-[13px] font-medium text-accent">
            <BasisTag basis="estimate" /> How it&apos;s calculated
          </button>
        </div>
      </Card>

      <p className="mt-4 px-1 text-[15px] leading-snug text-text-2">{guidance}</p>

      {n.suggestion && s.calorieAdjustment === 0 && (
        <Card className="mt-4 p-4">
          <div className="text-micro text-text-3">Based on your weight trend</div>
          <p className="mt-1 text-[15px]">{n.suggestion.message}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => s.setCalorieAdjustment(n.suggestion!.kcal)}>
              Apply {n.suggestion.kcal > 0 ? "+" : ""}
              {n.suggestion.kcal} kcal
            </Button>
          </div>
        </Card>
      )}

      <div className="mt-8 space-y-6">
        {MEALS.map((m) => {
          const items = meals.filter((x) => x.meal === m);
          const kcal = Math.round(items.reduce((a, x) => a + x.kcal, 0));
          return (
            <Section
              key={m}
              title={MEAL_LABEL[m]}
              subtitle={items.length ? `${kcal} kcal` : undefined}
              action={
                <button onClick={() => setAddFor(m)} className="inline-flex items-center gap-1 text-[14px] font-medium text-accent">
                  <Plus size={15} /> Add
                </button>
              }
            >
              {items.length > 0 && (
                <Card className="divide-y divide-line">
                  {items.map((it) => (
                    <button key={it.id} onClick={() => setEdit(it)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-2">
                      <div className="min-w-0">
                        <div className="truncate text-[15px] font-medium">{it.name}</div>
                        <div className="tnum text-caption text-text-3">
                          {it.servings !== 1 && `${it.servings} × · `}P {Math.round(it.protein)} · C {Math.round(it.carbs)} · F {Math.round(it.fat)}
                          {it.source === "estimate" && " · estimate"}
                        </div>
                      </div>
                      <span className="tnum shrink-0 text-[14px] font-medium">{Math.round(it.kcal)}</span>
                    </button>
                  ))}
                </Card>
              )}
            </Section>
          );
        })}
      </div>

      <Section title="Hydration" subtitle={`Target about ${(n.plan.hydrationMl / 1000).toFixed(1)} L`} className="mt-8">
        <Card className="flex items-center gap-4 p-4">
          <Droplet size={22} className="text-accent" />
          <div className="flex-1">
            <div className="tnum text-[17px] font-semibold">{(water / 1000).toFixed(2)} L</div>
            <Meter value={water / n.plan.hydrationMl} className="mt-1.5" />
          </div>
          <button onClick={() => s.addWater(-250)} aria-label="Remove 250 ml" className="grid h-10 w-10 place-items-center rounded-full bg-surface-2">
            <Minus size={16} />
          </button>
          <button onClick={() => s.addWater(250)} aria-label="Add 250 ml" className="grid h-10 w-10 place-items-center rounded-full bg-accent text-accent-ink">
            <Plus size={16} />
          </button>
        </Card>
      </Section>

      <AddFoodSheet meal={addFor} onClose={() => setAddFor(null)} />
      <EditEntrySheet entry={edit} onClose={() => setEdit(null)} />

      <Sheet open={how} onClose={() => setHow(false)} title="How your targets are set">
        <ul className="space-y-3 text-[15px] leading-relaxed text-text-2">
          {n.plan.explanation.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
        <div className="mt-5 grid grid-cols-2 gap-3 text-[14px]">
          <Card className="bg-surface-2 p-3">
            <div className="text-caption text-text-3">Training day</div>
            <div className="tnum font-semibold">{n.plan.trainingDay.kcal} kcal</div>
            <div className="tnum text-caption text-text-2">
              P {n.plan.trainingDay.protein} · C {n.plan.trainingDay.carbs} · F {n.plan.trainingDay.fat}
            </div>
          </Card>
          <Card className="bg-surface-2 p-3">
            <div className="text-caption text-text-3">Rest day</div>
            <div className="tnum font-semibold">{n.plan.restDay.kcal} kcal</div>
            <div className="tnum text-caption text-text-2">
              P {n.plan.restDay.protein} · C {n.plan.restDay.carbs} · F {n.plan.restDay.fat}
            </div>
          </Card>
        </div>
        {s.calorieAdjustment !== 0 && (
          <Button className="mt-4" size="sm" variant="secondary" onClick={() => s.setCalorieAdjustment(0)}>
            Remove {s.calorieAdjustment > 0 ? "+" : ""}
            {s.calorieAdjustment} kcal adjustment
          </Button>
        )}
        <p className="mt-4 text-caption text-text-3">These are starting estimates, not medical advice. After 2–3 weeks of weigh-ins they&apos;re refined from your real trend.</p>
      </Sheet>
    </>
  );
}

function Macro({ label, eaten, target, tone }: { label: string; eaten: number; target: number; tone: "positive" | "accent" | "neutral" }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[13px]">
        <span className="font-medium">{label}</span>
        <span className="tnum text-text-2">
          {Math.round(eaten)}/{target} g
        </span>
      </div>
      <Meter value={eaten / target} tone={eaten > target * 1.15 ? "caution" : tone} height={5} />
    </div>
  );
}

type AddMode = "search" | "describe" | "quick" | "saved";

function AddFoodSheet({ meal, onClose }: { meal: MealEntry["meal"] | null; onClose: () => void }) {
  const s = useApp();
  const [mode, setMode] = useState<AddMode>("search");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<FoodItem | null>(null);
  const [servings, setServings] = useState(1);
  const [desc, setDesc] = useState("");
  const [parsed, setParsed] = useState<ReturnType<typeof parseMealDescription> | null>(null);
  const [quick, setQuick] = useState({ name: "", kcal: 400, protein: 25, carbs: 40, fat: 15 });
  const results = useMemo(() => searchFoods(q, 20), [q]);
  const m = meal ?? defaultMeal();
  const today = localDate();

  const close = () => {
    setPicked(null);
    setQ("");
    setDesc("");
    setParsed(null);
    setServings(1);
    onClose();
  };

  const addFood = (f: FoodItem, sv: number, source: MealEntry["source"] = "database") =>
    s.addMeal({ date: today, meal: m, name: f.name, servings: sv, kcal: Math.round(f.kcal * sv), protein: f.protein * sv, carbs: f.carbs * sv, fat: f.fat * sv, foodId: f.id, source });

  return (
    <Sheet open={!!meal} onClose={close} title={`Add to ${MEAL_LABEL[m].toLowerCase()}`} size="lg">
      <Segmented
        size="sm"
        className="mb-4"
        options={[
          { value: "search", label: "Search" },
          { value: "describe", label: "Describe" },
          { value: "quick", label: "Quick add" },
          { value: "saved", label: "Saved" },
        ]}
        value={mode}
        onChange={(v) => {
          setMode(v);
          setPicked(null);
        }}
      />

      {mode === "search" &&
        (picked ? (
          <div className="space-y-4">
            <div>
              <div className="text-[17px] font-semibold">{picked.name}</div>
              <div className="text-caption text-text-3">Per {picked.serving}</div>
            </div>
            <div className="rounded-2xl bg-surface-2 py-4">
              <Stepper label="Servings" value={servings} step={0.5} min={0.5} max={20} onChange={setServings} />
            </div>
            <div className="tnum grid grid-cols-4 gap-2 text-center text-[13px]">
              {[
                ["kcal", picked.kcal],
                ["Protein", picked.protein],
                ["Carbs", picked.carbs],
                ["Fat", picked.fat],
              ].map(([l, v]) => (
                <div key={l as string} className="rounded-xl bg-surface-2 py-2">
                  <div className="font-semibold">{Math.round((v as number) * servings)}</div>
                  <div className="text-[11px] text-text-3">{l}</div>
                </div>
              ))}
            </div>
            <Button
              size="lg"
              block
              onClick={() => {
                addFood(picked, servings);
                close();
              }}
            >
              Add
            </Button>
            <p className="text-center text-caption text-text-3">Approximate values from standard food composition data.</p>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <label className="flex h-11 flex-1 items-center gap-2 rounded-xl bg-surface-2 px-3">
                <Search size={16} className="text-text-3" />
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search foods" aria-label="Search foods" className="h-full flex-1 bg-transparent text-[15px] outline-none" />
              </label>
              <button disabled title="Barcode scanning arrives with the native app" aria-label="Scan barcode (coming with the native app)" className="grid h-11 w-11 place-items-center rounded-xl bg-surface-2 text-text-3 opacity-50">
                <ScanBarcode size={18} />
              </button>
            </div>
            <div className="mt-2 divide-y divide-line">
              {results.map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    setPicked(f);
                    setServings(1);
                  }}
                  className="flex w-full items-center justify-between gap-3 py-3 text-left"
                >
                  <div>
                    <div className="text-[15px] font-medium">{f.name}</div>
                    <div className="text-caption text-text-3">{f.serving}</div>
                  </div>
                  <span className="tnum text-[13px] text-text-2">{f.kcal} kcal</span>
                </button>
              ))}
              {!results.length && <p className="py-6 text-center text-body text-text-3">Nothing found. Try Quick add to enter it manually.</p>}
            </div>
          </>
        ))}

      {mode === "describe" && (
        <div className="space-y-4">
          <p className="text-body text-text-2">Describe what you ate. We&apos;ll match it to foods you can check and edit before saving.</p>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="e.g. 3 eggs, 2 slices of toast and a banana" aria-label="Describe your meal" className="w-full resize-none rounded-xl bg-surface-2 p-3 text-[15px] outline-none focus:ring-2 focus:ring-accent" />
          <Button size="md" variant="secondary" icon={<Sparkles size={15} />} disabled={!desc.trim()} onClick={() => setParsed(parseMealDescription(desc))}>
            Interpret
          </Button>
          {parsed && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              {parsed.items.length > 0 && (
                <Card className="divide-y divide-line bg-surface-2">
                  {parsed.items.map((it, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-[15px] font-medium">{it.food.name}</div>
                        <div className="text-caption text-text-3">
                          &ldquo;{it.matchedText}&rdquo; · {it.food.serving}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button aria-label="Fewer servings" onClick={() => setParsed({ ...parsed, items: parsed.items.map((x, j) => (j === i ? { ...x, servings: Math.max(0.5, x.servings - 0.5) } : x)) })} className="grid h-8 w-8 place-items-center rounded-full bg-surface">
                          <Minus size={14} />
                        </button>
                        <span className="tnum w-8 text-center text-[14px] font-semibold">{it.servings}</span>
                        <button aria-label="More servings" onClick={() => setParsed({ ...parsed, items: parsed.items.map((x, j) => (j === i ? { ...x, servings: x.servings + 0.5 } : x)) })} className="grid h-8 w-8 place-items-center rounded-full bg-surface">
                          <Plus size={14} />
                        </button>
                        <button aria-label="Remove" onClick={() => setParsed({ ...parsed, items: parsed.items.filter((_, j) => j !== i) })} className="grid h-8 w-8 place-items-center text-text-3">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </Card>
              )}
              {parsed.unrecognised.length > 0 && (
                <p className="rounded-xl bg-caution-soft p-3 text-[14px] text-caution">
                  Couldn&apos;t identify: {parsed.unrecognised.map((u) => `“${u}”`).join(", ")}. Add {parsed.unrecognised.length > 1 ? "them" : "it"} with Search or Quick add. We don&apos;t guess.
                </p>
              )}
              {parsed.items.length > 0 && (
                <>
                  <div className="tnum text-[14px] text-text-2">
                    Estimated total: {Math.round(parsed.items.reduce((a, x) => a + x.food.kcal * x.servings, 0))} kcal · {Math.round(parsed.items.reduce((a, x) => a + x.food.protein * x.servings, 0))} g protein
                  </div>
                  <Button
                    size="lg"
                    block
                    onClick={() => {
                      parsed.items.forEach((x) => addFood(x.food, x.servings, "estimate"));
                      close();
                    }}
                  >
                    Add {parsed.items.length} item{parsed.items.length > 1 ? "s" : ""}
                  </Button>
                </>
              )}
            </motion.div>
          )}
        </div>
      )}

      {mode === "quick" && (
        <div className="space-y-4">
          <input value={quick.name} onChange={(e) => setQuick({ ...quick, name: e.target.value })} placeholder="Name (optional)" aria-label="Food name" className="h-11 w-full rounded-xl bg-surface-2 px-3 text-[15px] outline-none focus:ring-2 focus:ring-accent" />
          <div className="grid grid-cols-2 gap-y-5 rounded-2xl bg-surface-2 py-4">
            <Stepper size="md" label="kcal" value={quick.kcal} step={10} onChange={(v) => setQuick({ ...quick, kcal: Math.round(v) })} />
            <Stepper size="md" label="Protein g" value={quick.protein} step={1} onChange={(v) => setQuick({ ...quick, protein: Math.round(v) })} />
            <Stepper size="md" label="Carbs g" value={quick.carbs} step={1} onChange={(v) => setQuick({ ...quick, carbs: Math.round(v) })} />
            <Stepper size="md" label="Fat g" value={quick.fat} step={1} onChange={(v) => setQuick({ ...quick, fat: Math.round(v) })} />
          </div>
          <Button
            size="lg"
            block
            onClick={() => {
              s.addMeal({ date: today, meal: m, name: quick.name.trim() || "Quick add", servings: 1, kcal: quick.kcal, protein: quick.protein, carbs: quick.carbs, fat: quick.fat, source: "manual" });
              close();
            }}
          >
            Add
          </Button>
        </div>
      )}

      {mode === "saved" && (
        <div className="space-y-3">
          {s.savedMeals.map((sm) => (
            <Card key={sm.id} className="flex items-center justify-between gap-3 bg-surface-2 p-4">
              <div className="min-w-0">
                <div className="text-[15px] font-medium">{sm.name}</div>
                <div className="truncate text-caption text-text-3">
                  {sm.items.map((i) => i.name).join(", ")} · {Math.round(sm.items.reduce((a, i) => a + i.kcal, 0))} kcal
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  sm.items.forEach((i) => s.addMeal({ ...i, date: today, meal: m, source: "saved" }));
                  close();
                }}
              >
                Add
              </Button>
            </Card>
          ))}
          {(() => {
            const todays = s.meals.filter((x) => x.date === today && x.meal === m);
            return todays.length ? (
              <Button
                size="md"
                variant="secondary"
                block
                onClick={() => {
                  const name = `${MEAL_LABEL[m]} · ${todays.map((x) => x.name.split(",")[0]).slice(0, 2).join(" & ")}`;
                  s.saveMealTemplate(
                    name,
                    todays.map(({ id, date, meal: _m, ...rest }) => rest),
                  );
                }}
              >
                Save today&apos;s {MEAL_LABEL[m].toLowerCase()} for later
              </Button>
            ) : null;
          })()}
          {!s.savedMeals.length && <p className="py-4 text-center text-body text-text-3">Meals you save appear here for one-tap logging.</p>}
        </div>
      )}
    </Sheet>
  );
}

function EditEntrySheet({ entry, onClose }: { entry: MealEntry | null; onClose: () => void }) {
  const s = useApp();
  const food = entry?.foodId ? FOODS.find((f) => f.id === entry.foodId) : undefined;
  const [sv, setSv] = useState<number | null>(null);
  const servings = sv ?? entry?.servings ?? 1;
  const close = () => {
    setSv(null);
    onClose();
  };
  return (
    <Sheet open={!!entry} onClose={close} title={entry?.name}>
      {entry && (
        <div className="space-y-4">
          {entry.source === "estimate" && <p className="rounded-xl bg-accent-soft p-3 text-[14px] text-accent">Matched from your description. Check the amount is right.</p>}
          {food ? (
            <>
              <div className="text-caption text-text-3">Per {food.serving}</div>
              <div className="rounded-2xl bg-surface-2 py-4">
                <Stepper label="Servings" value={servings} step={0.5} min={0.5} onChange={setSv} />
              </div>
              <Button
                size="lg"
                block
                onClick={() => {
                  s.updateMeal(entry.id, { servings, kcal: Math.round(food.kcal * servings), protein: food.protein * servings, carbs: food.carbs * servings, fat: food.fat * servings });
                  close();
                }}
              >
                Save
              </Button>
            </>
          ) : (
            <div className="tnum text-[15px] text-text-2">
              {entry.kcal} kcal · P {Math.round(entry.protein)} · C {Math.round(entry.carbs)} · F {Math.round(entry.fat)}
            </div>
          )}
          <Button
            size="md"
            block
            variant="danger"
            icon={<Trash2 size={15} />}
            onClick={() => {
              s.removeMeal(entry.id);
              close();
            }}
          >
            Remove
          </Button>
        </div>
      )}
    </Sheet>
  );
}

