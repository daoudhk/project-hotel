"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { motion } from "motion/react";
import { Activity, CircleUserRound, Dumbbell, Sun, UtensilsCrossed } from "lucide-react";
import { useApp, useHydrated } from "@/lib/store/store";
import { cx, Skeleton } from "./ui/primitives";
import { CoachProvider } from "./coach/CoachProvider";
import { ActiveWorkoutBar } from "./train/ActiveWorkoutBar";

export const TABS = [
  { href: "/today", label: "Today", icon: Sun },
  { href: "/train", label: "Train", icon: Dumbbell },
  { href: "/progress", label: "Progress", icon: Activity },
  { href: "/nutrition", label: "Nutrition", icon: UtensilsCrossed },
  { href: "/you", label: "You", icon: CircleUserRound },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const hasProfile = useApp((s) => !!s.profile);
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (hydrated && !hasProfile) router.replace("/welcome");
  }, [hydrated, hasProfile, router]);

  if (!hydrated || !hasProfile) {
    return (
      <div className="mx-auto max-w-[560px] space-y-4 px-5 pt-16">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  return (
    <CoachProvider>
      <div className="min-h-dvh lg:pl-[232px]">
        <SideNav path={path} />
        <main className="mx-auto max-w-[560px] px-4 pb-36 pt-[max(env(safe-area-inset-top),12px)] sm:px-6 lg:max-w-[640px] lg:pb-16">{children}</main>
        <ActiveWorkoutBar />
        <TabBar path={path} />
      </div>
    </CoachProvider>
  );
}

function TabBar({ path }: { path: string }) {
  return (
    <nav aria-label="Primary" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[color-mix(in_srgb,var(--bg)_82%,transparent)] backdrop-blur-xl lg:hidden">
      <ul className="mx-auto flex max-w-[560px] items-stretch justify-around px-2">
        {TABS.map((t) => {
          const active = path.startsWith(t.href);
          const Icon = t.icon;
          return (
            <li key={t.href} className="flex-1">
              <Link href={t.href} aria-current={active ? "page" : undefined} className={cx("relative flex h-[58px] flex-col items-center justify-center gap-1 text-[10.5px] font-medium tracking-[0.01em] transition-colors", active ? "text-text" : "text-text-3 hover:text-text-2")}>
                <motion.span animate={{ scale: active ? 1 : 0.94 }} transition={{ type: "spring", stiffness: 500, damping: 30 }}>
                  <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
                </motion.span>
                {t.label}
                {active && <motion.span layoutId="tab-dot" className="absolute top-0 h-[2px] w-6 rounded-full bg-accent" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function SideNav({ path }: { path: string }) {
  return (
    <nav aria-label="Primary" className="fixed inset-y-0 left-0 hidden w-[232px] flex-col border-r border-line px-4 py-8 lg:flex">
      <div className="mb-8 flex items-center gap-2 px-3">
        <Logo />
        <span className="text-[17px] font-semibold tracking-tight">Gymnasio</span>
      </div>
      <ul className="space-y-1">
        {TABS.map((t) => {
          const active = path.startsWith(t.href);
          const Icon = t.icon;
          return (
            <li key={t.href}>
              <Link href={t.href} className={cx("flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors", active ? "bg-surface text-text" : "text-text-2 hover:bg-surface-2 hover:text-text")}>
                <Icon size={19} strokeWidth={active ? 2.2 : 1.8} />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden>
      <rect width="512" height="512" rx="120" fill="var(--text)" />
      <path d="M168 300c0-60 40-112 104-112 26 0 48 7 66 20" fill="none" stroke="var(--accent)" strokeWidth="44" strokeLinecap="round" />
      <path d="M344 236v64c0 50-36 88-88 88-48 0-80-30-88-72" fill="none" stroke="var(--bg)" strokeWidth="44" strokeLinecap="round" />
      <path d="M264 300h80" stroke="var(--bg)" strokeWidth="44" strokeLinecap="round" />
    </svg>
  );
}
