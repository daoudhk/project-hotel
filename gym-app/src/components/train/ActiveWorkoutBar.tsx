"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { useApp } from "@/lib/store/store";
import { useNow } from "./useNow";
import { fmtClock } from "@/lib/format";

export function ActiveWorkoutBar() {
  const active = useApp((s) => s.active);
  const idx = useApp((s) => s.activeIndex);
  const restEndsAt = useApp((s) => s.restEndsAt);
  const now = useNow(1000);
  const rest = restEndsAt ? Math.max(0, Math.round((restEndsAt - now) / 1000)) : 0;
  return (
    <AnimatePresence>
      {active && (
        <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} className="fixed inset-x-0 bottom-[calc(66px+env(safe-area-inset-bottom))] z-30 px-4 lg:bottom-6 lg:left-[232px]">
          <Link href="/workout" className="mx-auto flex max-w-[528px] items-center gap-3 rounded-2xl bg-text px-4 py-3 text-bg shadow-lg">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold">{active.title}</div>
              <div className="tnum text-[12px] opacity-70">
                Exercise {Math.min(idx + 1, active.exercises.length)} of {active.exercises.length}
                {rest > 0 && ` · Rest ${fmtClock(rest)}`}
              </div>
            </div>
            <span className="flex items-center text-[14px] font-medium">
              Resume <ChevronRight size={16} />
            </span>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
