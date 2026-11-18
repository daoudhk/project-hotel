"use client";

import type { ReactNode } from "react";
import { MessageCircle } from "lucide-react";
import { useApp } from "@/lib/store/store";
import { useCoach } from "./coach/CoachProvider";
import { Pill } from "./ui/primitives";

export function PageHeader({ eyebrow, title, context, trailing }: { eyebrow?: ReactNode; title: ReactNode; context?: string; trailing?: ReactNode }) {
  const isDemo = useApp((s) => s.isDemo);
  const coach = useCoach();
  return (
    <header className="mb-6 pt-4">
      <div className="flex h-10 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {eyebrow && <span className="truncate text-[13px] font-medium text-text-3">{eyebrow}</span>}
          {isDemo && (
            <Pill tone="caution" className="h-5 px-2 text-[11px]">
              Demo data
            </Pill>
          )}
        </div>
        <div className="flex items-center gap-1">
          {trailing}
          {context && (
            <button
              onClick={() => coach.open(context)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface px-3.5 text-[13px] font-medium text-text-2 transition-colors hover:text-text"
              aria-label="Ask your coach"
            >
              <MessageCircle size={15} />
              Ask
            </button>
          )}
        </div>
      </div>
      <h1 className="text-display mt-1">{title}</h1>
    </header>
  );
}
