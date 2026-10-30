export type WeaponId = 'pistol' | 'mp5' | 'm4' | 'deagle';
export type Caliber = '.45 ACP' | '9mm' | '5.56mm' | '.50 AE';
export type WeaponSlot = 0 | 1; // 0 = primary, 1 = sidearm

export interface WeaponDef {
  id: WeaponId;
  name: string;
  short: string;
  slot: WeaponSlot;
  caliber: Caliber;
  automatic: boolean;
  /** damage per bullet before falloff */
  damage: number;
  /** distance (px) where damage falloff starts / reaches minimum */
  falloffStart: number;
  falloffEnd: number;
  falloffMin: number; // multiplier at falloffEnd
  rpm: number;
  magazine: number;
  reloadTime: number;
  range: number;
  // --- aiming behaviour ---
  /** angular kick per shot (radians) */
  recoilKick: number;
  /** how fast recoil offset returns to the firing line (1/s) */
  recoilRecovery: number;
  /** base cone (radians, std-dev-ish) */
  spread: number;
  /** extra spread while moving */
  moveSpread: number;
  /** bloom added per shot (radians), decays with recovery */
  bloomPerShot: number;
  /** crosshair attraction progress per second */
  attractRate: number;
  /** half width of the firing-line corridor that attracts to targets (px) */
  attractWidth: number;
  /** fraction of lock lost per shot */
  lockLoss: number;
  /** crosshair glide speed (1/s) */
  glide: number;
  /** distance at which gunshots alert bots */
  noiseRadius: number;
  muzzle: number; // muzzle length in px from body centre
  flash: number; // muzzle flash scale
  shake: number; // camera shake intensity
  sound: string;
  description: string;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: {
    id: 'pistol', name: 'Standard Pistol', short: 'P-45', slot: 1, caliber: '.45 ACP', automatic: false,
    damage: 20, falloffStart: 2000, falloffEnd: 3000, falloffMin: 1, rpm: 300, magazine: 8, reloadTime: 1.5, range: 760,
    recoilKick: 0.11, recoilRecovery: 3.2, spread: 0.022, moveSpread: 0.05, bloomPerShot: 0.03,
    attractRate: 1.05, attractWidth: 46, lockLoss: 0.45, glide: 9,
    noiseRadius: 850, muzzle: 27, flash: 0.8, shake: 0.0025, sound: 'shot_pistol',
    description: 'Issued sidearm. Reliable, but kicks hard and needs five clean hits.',
  },
  mp5: {
    id: 'mp5', name: 'MP5', short: 'MP5', slot: 0, caliber: '9mm', automatic: true,
    damage: 17, falloffStart: 260, falloffEnd: 700, falloffMin: 0.6, rpm: 800, magazine: 30, reloadTime: 2.2, range: 780,
    recoilKick: 0.034, recoilRecovery: 6.5, spread: 0.03, moveSpread: 0.035, bloomPerShot: 0.008,
    attractRate: 1.7, attractWidth: 56, lockLoss: 0.12, glide: 12,
    noiseRadius: 800, muzzle: 34, flash: 0.75, shake: 0.0016, sound: 'shot_mp5',
    description: 'Compact 9mm SMG. Blistering rate of fire, deadly up close, fades at range.',
  },
  m4: {
    id: 'm4', name: 'M4 Carbine', short: 'M4', slot: 0, caliber: '5.56mm', automatic: true,
    damage: 24, falloffStart: 700, falloffEnd: 1300, falloffMin: 0.8, rpm: 700, magazine: 30, reloadTime: 2.6, range: 1250,
    recoilKick: 0.046, recoilRecovery: 5.2, spread: 0.012, moveSpread: 0.07, bloomPerShot: 0.01,
    attractRate: 1.3, attractWidth: 42, lockLoss: 0.18, glide: 10,
    noiseRadius: 1000, muzzle: 48, flash: 1, shake: 0.0022, sound: 'shot_m4',
    description: '5.56mm carbine. Accurate and controllable across long hotel halls.',
  },
  deagle: {
    id: 'deagle', name: 'Desert Eagle', short: 'DEAGLE', slot: 1, caliber: '.50 AE', automatic: false,
    damage: 55, falloffStart: 900, falloffEnd: 1400, falloffMin: 0.9, rpm: 110, magazine: 7, reloadTime: 2.1, range: 1000,
    recoilKick: 0.24, recoilRecovery: 1.9, spread: 0.014, moveSpread: 0.09, bloomPerShot: 0.05,
    attractRate: 0.85, attractWidth: 38, lockLoss: 0.8, glide: 8,
    noiseRadius: 1150, muzzle: 31, flash: 1.5, shake: 0.007, sound: 'shot_deagle',
    description: '.50 AE hand cannon. Two hits drop a target. Brutal recoil, slow follow-ups.',
  },
};

export const WEAPON_IDS: WeaponId[] = ['pistol', 'mp5', 'm4', 'deagle'];
export const CALIBERS: Caliber[] = ['.45 ACP', '9mm', '5.56mm', '.50 AE'];

export function damageAt(def: WeaponDef, distance: number) {
  if (distance <= def.falloffStart) return def.damage;
  const t = Math.min(1, (distance - def.falloffStart) / (def.falloffEnd - def.falloffStart));
  return def.damage * (1 - (1 - def.falloffMin) * t);
}
