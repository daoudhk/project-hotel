"use client";

import { useEffect } from "react";
import { useApp } from "@/lib/store/store";

/** Applies the user's theme preference to <html data-theme>. */
export function ThemeSync() {
  const theme = useApp((s) => s.profile?.theme ?? "system");
  useEffect(() => {
    const el = document.documentElement;
    if (theme === "system") el.removeAttribute("data-theme");
    else el.setAttribute("data-theme", theme);
  }, [theme]);
  return null;
}
