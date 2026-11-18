"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CoachSheet } from "./CoachSheet";

interface CoachCtx {
  open: (context: string, question?: string) => void;
}

const Ctx = createContext<CoachCtx>({ open: () => {} });

export function CoachProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; context: string; question?: string }>({ open: false, context: "today" });
  const open = useCallback((context: string, question?: string) => setState({ open: true, context, question }), []);
  return (
    <Ctx.Provider value={{ open }}>
      {children}
      <CoachSheet open={state.open} context={state.context} initialQuestion={state.question} onClose={() => setState((s) => ({ ...s, open: false }))} />
    </Ctx.Provider>
  );
}

export const useCoach = () => useContext(Ctx);
