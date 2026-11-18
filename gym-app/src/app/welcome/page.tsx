"use client";

import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Logo } from "@/components/AppShell";
import { Button } from "@/components/ui/primitives";
import { useApp } from "@/lib/store/store";
import { buildDemoState } from "@/lib/store/demo";

export default function Welcome() {
  const router = useRouter();
  const importState = useApp((s) => s.importState);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[520px] flex-col px-6 pb-[max(env(safe-area-inset-bottom),24px)] pt-[max(env(safe-area-inset-top),24px)]">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex items-center gap-2 pt-4">
        <Logo />
        <span className="text-[17px] font-semibold tracking-tight">Gymnasio</span>
      </motion.div>

      <div className="flex flex-1 flex-col justify-center py-12">
        <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }} className="text-[44px] font-semibold leading-[1.02] tracking-[-0.04em]">
          Train smarter.
          <br />
          <span className="text-text-3">Become your strongest self.</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="mt-5 max-w-sm text-[17px] leading-relaxed text-text-2">
          Your entire athletic journey. One intelligent coach that tells you what to train, how much to lift, and when to recover.
        </motion.p>

        <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.6 }} className="mt-10 space-y-4">
          {[
            ["A plan built for your sport", "MMA, football, strength, physique and more."],
            ["The right weight, every set", "Transparent progression rules, not guesswork."],
            ["Recovery that adapts", "Sore or short on sleep? Today's session changes with you."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="tnum mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface text-[12px] font-semibold text-text-2">{i + 1}</span>
              <div>
                <div className="text-[15px] font-medium">{t}</div>
                <div className="text-caption text-text-2">{d}</div>
              </div>
            </li>
          ))}
        </motion.ul>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="space-y-3">
        <Button size="lg" block onClick={() => router.push("/onboarding")}>
          Get started
        </Button>
        <Button
          size="lg"
          block
          variant="plain"
          onClick={() => {
            importState(buildDemoState());
            router.push("/today");
          }}
        >
          Explore with a demo athlete
        </Button>
        <p className="text-center text-caption text-text-3">Your data stays on this device. No account needed to start.</p>
      </motion.div>
    </main>
  );
}
