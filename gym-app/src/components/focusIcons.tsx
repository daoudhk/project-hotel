import { Activity, Dumbbell, Flame, Footprints, HeartPulse, Layers, Shield, Sparkles, Target, Trophy, Zap } from "lucide-react";
import type { FocusId } from "@/lib/types";

export const FOCUS_ICON: Record<FocusId, typeof Activity> = {
  general: HeartPulse,
  hypertrophy: Layers,
  strength: Dumbbell,
  mma: Shield,
  boxing: Target,
  soccer: Footprints,
  polo: Trophy,
  basketball: Flame,
  endurance: Activity,
  explosive: Zap,
  hybrid: Sparkles,
};
