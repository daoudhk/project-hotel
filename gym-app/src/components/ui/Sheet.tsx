"use client";

import { AnimatePresence, motion, useDragControls } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cx } from "./primitives";

/** Bottom sheet on phones, centred dialog on wide screens. */
export function Sheet({ open, onClose, title, children, footer, size = "md" }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; size?: "md" | "lg" }) {
  const controls = useDragControls();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
          <motion.div className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 40 }}
            drag="y"
            dragControls={controls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, i) => {
              if (i.offset.y > 120 || i.velocity.y > 600) onClose();
            }}
            className={cx(
              "relative flex max-h-[92dvh] w-full flex-col rounded-t-[28px] bg-surface shadow-[var(--shadow-sheet)] sm:rounded-[28px]",
              size === "lg" ? "sm:max-w-[600px]" : "sm:max-w-[480px]",
            )}
          >
            <div className="touch-none" onPointerDown={(e) => controls.start(e)}>
            <div className="flex justify-center pt-2.5 sm:hidden">
              <span className="h-1 w-9 rounded-full bg-line-strong" />
            </div>
            <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-3">
              <div className="text-headline">{title}</div>
              <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full bg-surface-2 text-text-2 hover:text-text">
                <X size={16} />
              </button>
            </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
              {children}
            </div>
            {footer && <div className="pb-safe border-t border-line px-5 pt-3 pb-4">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
