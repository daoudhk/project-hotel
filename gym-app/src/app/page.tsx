"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp, useHydrated } from "@/lib/store/store";

export default function Index() {
  const hydrated = useHydrated();
  const hasProfile = useApp((s) => !!s.profile);
  const router = useRouter();
  useEffect(() => {
    if (hydrated) router.replace(hasProfile ? "/today" : "/welcome");
  }, [hydrated, hasProfile, router]);
  return <div className="min-h-dvh bg-bg" />;
}
