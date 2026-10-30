import type { Difficulty } from '../data/difficulty';
import type { LightQuality } from '../render/lighting';
import { load, save } from './storage';

export interface Settings {
  master: number;
  sfx: number;
  ambience: number;
  ui: number;
  showFps: boolean;
  lighting: LightQuality;
  screenShake: boolean;
  difficulty: Difficulty;
  team: 'AT' | 'GUARD';
  allies: number;
}

const KEY = 'project-hotel.settings.v1';
const DEFAULTS: Settings = {
  master: 0.8, sfx: 0.9, ambience: 0.6, ui: 0.7, showFps: false, lighting: 'high', screenShake: true,
  difficulty: 'normal', team: 'AT', allies: 1,
};

class SettingsStore {
  private s: Settings = load(KEY, DEFAULTS);
  private listeners = new Set<(s: Settings) => void>();
  get() {
    return this.s;
  }
  set(patch: Partial<Settings>) {
    this.s = { ...this.s, ...patch };
    save(KEY, this.s);
    this.listeners.forEach((l) => l(this.s));
  }
  onChange(fn: (s: Settings) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
export const settings = new SettingsStore();
