"use client";

import { Sheet } from "@/components/ui/Sheet";
import { Pill, Sparkline } from "@/components/ui/primitives";
import { useApp } from "@/lib/store/store";
import { getExercise } from "@/lib/data/exercises";
import { e1rmSeries } from "@/lib/engine/analytics";
import { exerciseHistory } from "@/lib/engine/progression";
import { MUSCLE_LABEL, fmtWeight, relativeDay } from "@/lib/format";

export function ExerciseSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const sessions = useApp((s) => s.sessions);
  const units = useApp((s) => s.profile!.units);
  const ex = id ? getExercise(id) : null;
  const series = id ? e1rmSeries(sessions, id) : [];
  const hist = id ? exerciseHistory(sessions, id, 5) : [];
  return (
    <Sheet open={!!id} onClose={onClose} title={ex?.name}>
      {ex && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-1.5">
            {ex.primary.map((m) => (
              <Pill key={m} tone="accent">
                {MUSCLE_LABEL[m]}
              </Pill>
            ))}
            {ex.secondary.map((m) => (
              <Pill key={m}>{MUSCLE_LABEL[m]}</Pill>
            ))}
          </div>
          <div className="rounded-2xl bg-surface-2 p-4 text-[15px]">
            <div className="text-micro text-text-3">Cue</div>
            <p className="mt-1">{ex.cue}</p>
          </div>
          {series.length >= 2 && (
            <div>
              <div className="text-micro text-text-3">Estimated max</div>
              <div className="mt-2 flex items-end justify-between">
                <div className="tnum text-[28px] font-semibold">{fmtWeight(series[series.length - 1].value, units)}</div>
                <Sparkline values={series.map((x) => x.value)} width={160} height={44} />
              </div>
            </div>
          )}
          <div>
            <div className="text-micro text-text-3">Recent sessions</div>
            {hist.length ? (
              <div className="mt-2 space-y-1.5">
                {hist.map((h) => (
                  <div key={h.date} className="tnum flex justify-between text-[14px]">
                    <span className="text-text-3">{relativeDay(h.date)}</span>
                    <span>
                      {h.sets[0].weight > 0 && `${fmtWeight(h.sets[0].weight, units)} × `}
                      {h.sets.map((x) => x.reps).join(", ")}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-[14px] text-text-3">Not logged yet.</p>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}
