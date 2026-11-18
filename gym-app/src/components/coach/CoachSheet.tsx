"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, Check } from "lucide-react";
import { Sheet } from "../ui/Sheet";
import { BasisTag, Button, cx } from "../ui/primitives";
import { answer, STARTER_QUESTIONS, type CoachAnswer, type Proposal } from "@/lib/assistant/coach";
import { useApp } from "@/lib/store/store";
import { getExercise } from "@/lib/data/exercises";
import { FOCUS } from "@/lib/engine/focus";

interface Turn {
  id: number;
  q: string;
  a: CoachAnswer;
  applied?: boolean;
  dismissed?: boolean;
}

export function CoachSheet({ open, onClose, context, initialQuestion }: { open: boolean; onClose: () => void; context: string; initialQuestion?: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const cloud = useApp((s) => s.consents.assistantCloud);

  const ask = async (q: string) => {
    const text = q.trim();
    if (!text || busy) return;
    setInput("");
    const draft = answer(text, useApp.getState());
    const id = Date.now();
    if (!cloud) {
      setTurns((t) => [...t, { id, q: text, a: draft }]);
      return;
    }
    setBusy(true);
    setTurns((t) => [...t, { id, q: text, a: { ...draft, text: "…" } }]);
    let final = draft.text;
    try {
      const r = await fetch("/api/coach", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: text, draft: draft.text }) });
      if (r.ok) final = ((await r.json()) as { text?: string }).text || draft.text;
    } catch {
      /* fall back to the deterministic answer */
    }
    setTurns((t) => t.map((x) => (x.id === id ? { ...x, a: { ...draft, text: final } } : x)));
    setBusy(false);
  };

  useEffect(() => {
    if (open && initialQuestion) void ask(initialQuestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialQuestion]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  const apply = (turn: Turn) => {
    const p = turn.a.proposal;
    if (!p) return;
    const st = useApp.getState();
    if (p.kind === "shorten") st.setCustomToday(p.day, `Shortened to about ${p.minutes} minutes at your request.`);
    if (p.kind === "swap") st.swapInPlan(p.dayId, p.slotId, p.to);
    if (p.kind === "focus") st.changeFocus(p.primary, p.secondary);
    if (p.kind === "calories") st.setCalorieAdjustment(st.calorieAdjustment + p.kcal);
    setTurns((t) => t.map((x) => (x.id === turn.id ? { ...x, applied: true } : x)));
  };

  const starters = STARTER_QUESTIONS[context] ?? STARTER_QUESTIONS.today;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Coach"
      size="lg"
      footer={
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask(input);
          }}
          className="flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about training, recovery or food"
            aria-label="Ask your coach"
            className="h-11 min-w-0 flex-1 rounded-full bg-surface-2 px-4 text-[15px] outline-none placeholder:text-text-3 focus:ring-2 focus:ring-accent"
          />
          <button type="submit" disabled={!input.trim() || busy} aria-label="Send" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-accent-ink disabled:opacity-30">
            <ArrowUp size={18} />
          </button>
        </form>
      }
    >
      <div className="min-h-[40dvh] space-y-5 pt-1">
        {turns.length === 0 && (
          <div className="space-y-3">
            <p className="text-body text-text-2">Ask anything about your training. Answers come from your own data and the coaching rules behind your plan. Any change I suggest waits for your confirmation.</p>
            <div className="flex flex-col items-start gap-2">
              {starters.map((q) => (
                <button key={q} onClick={() => void ask(q)} className="rounded-2xl bg-surface-2 px-4 py-2.5 text-left text-[14px] font-medium transition-colors hover:bg-surface-3">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        <AnimatePresence initial={false}>
          {turns.map((t) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-[15px] text-accent-ink">{t.q}</div>
              </div>
              <div className="max-w-[92%] space-y-2">
                <div className="rounded-2xl rounded-bl-md bg-surface-2 px-4 py-3 text-[15px] leading-relaxed">{t.a.text}</div>
                <div className="pl-1">
                  <BasisTag basis={t.a.basis} />
                </div>
                {t.a.proposal && !t.dismissed && <ProposalCard p={t.a.proposal} applied={!!t.applied} onApply={() => apply(t)} onDismiss={() => setTurns((x) => x.map((y) => (y.id === t.id ? { ...y, dismissed: true } : y)))} />}
                {t.a.followUps && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {t.a.followUps.map((f) => (
                      <button key={f} onClick={() => void ask(f)} className="rounded-full border border-line-strong px-3 py-1.5 text-[13px] font-medium hover:bg-surface-2">
                        {f}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={endRef} />
      </div>
    </Sheet>
  );
}

function ProposalCard({ p, applied, onApply, onDismiss }: { p: Proposal; applied: boolean; onApply: () => void; onDismiss: () => void }) {
  const title =
    p.kind === "shorten"
      ? `Shorten today's session to ~${p.minutes} min`
      : p.kind === "swap"
        ? `Replace ${getExercise(p.from).name} with ${getExercise(p.to).name}`
        : p.kind === "focus"
          ? `Update focus: ${FOCUS[p.primary].short}${p.secondary.length ? " + " + p.secondary.map((s) => FOCUS[s].short).join(" + ") : ""}`
          : `Adjust calories by ${p.kcal > 0 ? "+" : ""}${p.kcal} kcal`;
  const lines = p.kind === "shorten" || p.kind === "focus" ? p.summary : p.kind === "swap" ? ["Applies to this exercise in your weekly plan. History is kept."] : [];
  return (
    <div className={cx("rounded-2xl border p-4", applied ? "border-positive/40 bg-positive-soft" : "border-line-strong")}>
      <div className="text-micro text-text-3">Proposed change</div>
      <div className="mt-1 text-[15px] font-semibold">{title}</div>
      {lines.length > 0 && (
        <ul className="mt-2 space-y-1 text-caption text-text-2">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex gap-2">
        {applied ? (
          <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-positive">
            <Check size={16} /> Saved to your plan
          </span>
        ) : (
          <>
            <Button size="sm" onClick={onApply}>
              Apply
            </Button>
            <Button size="sm" variant="secondary" onClick={onDismiss}>
              Not now
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
