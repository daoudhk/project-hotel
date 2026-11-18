"use client";

import { useEffect, useState } from "react";
import type { CheckIn, Muscle, SorenessLevel } from "@/lib/types";
import { MUSCLE_LABEL } from "@/lib/format";
import { useApp } from "@/lib/store/store";
import { Sheet } from "./ui/Sheet";
import { BodyMap } from "./BodyMap";
import { Button, Segmented, Stepper, Toggle, cx } from "./ui/primitives";

const SORE_LABEL = ["None", "Mild", "Moderate", "Severe"] as const;
export const SORE_FILL = ["var(--muscle-0)", "color-mix(in srgb, var(--caution) 35%, var(--muscle-0))", "var(--caution)", "var(--critical)"];

export function CheckInSheet({ open, onClose, existing }: { open: boolean; onClose: () => void; existing?: CheckIn }) {
  const save = useApp((s) => s.saveCheckIn);
  const [soreness, setSoreness] = useState<Partial<Record<Muscle, SorenessLevel>>>({});
  const [selected, setSelected] = useState<Muscle | null>(null);
  const [sleep, setSleep] = useState(7.5);
  const [quality, setQuality] = useState<1 | 2 | 3>(2);
  const [energy, setEnergy] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [hasPain, setHasPain] = useState(false);
  const [painArea, setPainArea] = useState("");
  const [painSeverity, setPainSeverity] = useState<"mild" | "sharp">("mild");
  const [persistent, setPersistent] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSoreness(existing?.soreness ?? {});
    setSleep(existing?.sleepHours ?? 7.5);
    setQuality(existing?.sleepQuality ?? 2);
    setEnergy(existing?.energy ?? 3);
    setHasPain(!!existing?.pain);
    setPainArea(existing?.pain?.area ?? "");
    setPainSeverity(existing?.pain?.severity ?? "mild");
    setPersistent(existing?.pain?.persistent ?? false);
    setSelected(null);
  }, [open, existing]);

  const setLevel = (m: Muscle, l: SorenessLevel) => setSoreness((s) => ({ ...s, [m]: l }));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="How's your body feeling?"
      footer={
        <Button
          size="lg"
          block
          onClick={() => {
            save({
              soreness,
              sleepHours: sleep,
              sleepQuality: quality,
              energy,
              pain: hasPain && painArea.trim() ? { area: painArea.trim(), severity: painSeverity, persistent } : undefined,
            });
            onClose();
          }}
        >
          Update today&apos;s plan
        </Button>
      }
    >
      <div className="space-y-7">
        <section>
          <p className="text-body text-text-2">Tap any area that feels sore.</p>
          <div className="mt-3 rounded-2xl bg-surface-2 p-3">
            <BodyMap
              fill={(m) => SORE_FILL[soreness[m] ?? 0]}
              selected={selected}
              onSelect={(m) => {
                setSelected(m);
                if (!soreness[m]) setLevel(m, 1);
              }}
              label={(m) => `${MUSCLE_LABEL[m]}: ${SORE_LABEL[soreness[m] ?? 0]} soreness`}
            />
          </div>
          {selected ? (
            <div className="mt-3">
              <div className="mb-2 text-[14px] font-medium">{MUSCLE_LABEL[selected]}</div>
              <Segmented options={SORE_LABEL.map((l, i) => ({ value: i as SorenessLevel, label: l }))} value={soreness[selected] ?? 0} onChange={(v) => setLevel(selected, v)} size="sm" />
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-3 text-caption text-text-3">
              {SORE_LABEL.map((l, i) => (
                <span key={l} className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: SORE_FILL[i] }} />
                  {l}
                </span>
              ))}
            </div>
          )}
          {Object.values(soreness).some((v) => v) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(Object.entries(soreness) as [Muscle, SorenessLevel][])
                .filter(([, v]) => v)
                .map(([m, v]) => (
                  <button key={m} onClick={() => setSelected(m)} className={cx("rounded-full px-2.5 py-1 text-[12px] font-medium", v === 3 ? "bg-critical-soft text-critical" : "bg-caution-soft text-caution")}>
                    {MUSCLE_LABEL[m]} · {SORE_LABEL[v]}
                  </button>
                ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="text-headline">Sleep & energy</div>
          <div className="rounded-2xl bg-surface-2 py-4">
            <Stepper label="Hours slept" value={sleep} onChange={setSleep} step={0.5} min={0} max={14} size="md" />
          </div>
          <div>
            <div className="mb-2 text-caption text-text-2">Sleep quality</div>
            <Segmented
              options={[
                { value: 1, label: "Poor" },
                { value: 2, label: "OK" },
                { value: 3, label: "Good" },
              ]}
              value={quality}
              onChange={(v) => setQuality(v as 1 | 2 | 3)}
            />
          </div>
          <div>
            <div className="mb-2 text-caption text-text-2">Energy</div>
            <Segmented
              options={[
                { value: 1, label: "Drained" },
                { value: 2, label: "Low" },
                { value: 3, label: "Normal" },
                { value: 4, label: "Good" },
                { value: 5, label: "Great" },
              ]}
              value={energy}
              onChange={(v) => setEnergy(v as 1 | 2 | 3 | 4 | 5)}
              size="sm"
            />
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-headline">Pain or discomfort</div>
              <p className="text-caption text-text-3">Different from normal muscle soreness.</p>
            </div>
            <Toggle checked={hasPain} onChange={setHasPain} label="I have pain or discomfort" />
          </div>
          {hasPain && (
            <div className="space-y-3 rounded-2xl bg-surface-2 p-4">
              <input value={painArea} onChange={(e) => setPainArea(e.target.value)} placeholder="Where? e.g. left knee" aria-label="Pain location" className="h-11 w-full rounded-xl bg-surface px-3 text-[15px] outline-none focus:ring-2 focus:ring-accent" />
              <Segmented
                options={[
                  { value: "mild", label: "Dull / mild" },
                  { value: "sharp", label: "Sharp / severe" },
                ]}
                value={painSeverity}
                onChange={setPainSeverity}
                size="sm"
              />
              <label className="flex items-center justify-between text-[14px]">
                Lasting more than a few days
                <Toggle checked={persistent} onChange={setPersistent} label="Persistent pain" />
              </label>
              <p className="text-caption text-text-3">We won&apos;t diagnose anything. We&apos;ll steer your training away from it, and tell you when it&apos;s worth seeing a professional.</p>
            </div>
          )}
        </section>
      </div>
    </Sheet>
  );
}
