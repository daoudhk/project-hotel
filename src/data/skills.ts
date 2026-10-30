import type { WeaponId } from './weapons';

export type SkillTree = 'weapon' | 'stealth' | 'general';

export interface SkillDef {
  id: string;
  tree: SkillTree;
  weapon?: WeaponId;
  name: string;
  description: string;
  /** per-level effect text */
  effect: (level: number) => string;
  costs: number[]; // cost of each level, length = max level
  icon: string; // key into UI icon set
}

const weaponSkills = (w: WeaponId, label: string): SkillDef[] => [
  {
    id: `${w}.acquire`, tree: 'weapon', weapon: w, name: 'Target Acquisition', icon: 'target',
    description: `Crosshair attraction speed with the ${label}.`,
    effect: (l) => `+${l * 22}% attraction speed`, costs: [10, 20, 35],
  },
  {
    id: `${w}.control`, tree: 'weapon', weapon: w, name: 'Recoil Control', icon: 'recoil',
    description: `Reduces kick and lock loss per shot with the ${label}.`,
    effect: (l) => `-${l * 15}% recoil, -${l * 12}% lock loss`, costs: [10, 20, 35],
  },
  {
    id: `${w}.recovery`, tree: 'weapon', weapon: w, name: 'Recovery', icon: 'recovery',
    description: `The ${label} settles back onto the firing line faster.`,
    effect: (l) => `+${l * 20}% recoil recovery`, costs: [8, 16, 28],
  },
  {
    id: `${w}.steady`, tree: 'weapon', weapon: w, name: 'Steady Hands', icon: 'steady',
    description: `Tighter spread with the ${label}, especially on the move.`,
    effect: (l) => `-${l * 20}% spread`, costs: [12, 26],
  },
];

export const SKILLS: SkillDef[] = [
  ...weaponSkills('pistol', 'standard pistol'),
  ...weaponSkills('mp5', 'MP5'),
  ...weaponSkills('m4', 'M4'),
  ...weaponSkills('deagle', 'Desert Eagle'),
  {
    id: 'stealth.shadowstep', tree: 'stealth', name: 'Shadow Step', icon: 'clock',
    description: 'Slip into hiding faster after you stop moving.',
    effect: (l) => `Hide in ${(1.6 - l * 0.3).toFixed(1)}s`, costs: [10, 20, 32],
  },
  {
    id: 'stealth.conceal', tree: 'stealth', name: 'Concealment', icon: 'eye',
    description: 'Harder to spot while hidden.',
    effect: (l) => `-${l * 18}% visibility while hidden`, costs: [12, 24, 40],
  },
  {
    id: 'stealth.quiet', tree: 'stealth', name: 'Quiet Feet', icon: 'feet',
    description: 'Footsteps carry less far. Enemies notice movement less.',
    effect: (l) => `-${l * 25}% footstep noise`, costs: [10, 22],
  },
  {
    id: 'stealth.night', tree: 'stealth', name: 'Night Adapted', icon: 'moon',
    description: 'Hide in dimmer light, not only in pitch darkness.',
    effect: (l) => `+${l * 30}% usable shadow`, costs: [15, 30],
  },
  {
    id: 'general.conditioning', tree: 'general', name: 'Conditioning', icon: 'run',
    description: 'Faster movement and sprinting.',
    effect: (l) => `+${l * 5}% move speed`, costs: [12, 24, 38],
  },
  {
    id: 'general.plates', tree: 'general', name: 'Plate Drills', icon: 'plate',
    description: 'Apply armor plates faster.',
    effect: (l) => `-${l * 20}% plate application time`, costs: [10, 20, 32],
  },
  {
    id: 'general.handling', tree: 'general', name: 'Weapon Handling', icon: 'hand',
    description: 'Faster reloads and weapon swaps.',
    effect: (l) => `-${l * 10}% reload & swap time`, costs: [12, 24, 38],
  },
  {
    id: 'general.carrier', tree: 'general', name: 'Plate Carrier', icon: 'vest',
    description: 'Carry additional armor plates.',
    effect: (l) => `Carry ${2 + l} plates`, costs: [18, 36],
  },
];

export const SKILL_MAP = new Map(SKILLS.map((s) => [s.id, s]));

/** Gameplay multipliers derived from skill levels. Pure data, usable on a server. */
export interface SkillMods {
  weapon: Record<WeaponId, { attract: number; recoil: number; lockLoss: number; recovery: number; spread: number }>;
  hideTime: number;
  concealment: number; // visibility multiplier while hidden
  footstepNoise: number;
  darknessThreshold: number; // max light level to hide in
  moveSpeed: number;
  plateTime: number;
  handling: number; // reload/swap time multiplier
  plateCapacity: number;
}

export function computeSkillMods(levels: Record<string, number>): SkillMods {
  const lv = (id: string) => levels[id] ?? 0;
  const weapon = {} as SkillMods['weapon'];
  for (const w of ['pistol', 'mp5', 'm4', 'deagle'] as WeaponId[]) {
    weapon[w] = {
      attract: 1 + lv(`${w}.acquire`) * 0.22,
      recoil: 1 - lv(`${w}.control`) * 0.15,
      lockLoss: 1 - lv(`${w}.control`) * 0.12,
      recovery: 1 + lv(`${w}.recovery`) * 0.2,
      spread: 1 - lv(`${w}.steady`) * 0.2,
    };
  }
  return {
    weapon,
    hideTime: 1.6 - lv('stealth.shadowstep') * 0.3,
    concealment: 1 - lv('stealth.conceal') * 0.18,
    footstepNoise: 1 - lv('stealth.quiet') * 0.25,
    darknessThreshold: 0.26 * (1 + lv('stealth.night') * 0.3),
    moveSpeed: 1 + lv('general.conditioning') * 0.05,
    plateTime: 1 - lv('general.plates') * 0.2,
    handling: 1 - lv('general.handling') * 0.1,
    plateCapacity: 2 + lv('general.carrier'),
  };
}

export const DEFAULT_MODS = computeSkillMods({});
