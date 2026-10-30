import type { Caliber, WeaponId, WeaponSlot } from '../data/weapons';
import type { SkillMods } from '../data/skills';
import type { Difficulty } from '../data/difficulty';

export type Team = 'AT' | 'GUARD';
export const otherTeam = (t: Team): Team => (t === 'AT' ? 'GUARD' : 'AT');
export const TEAM_NAMES: Record<Team, string> = { AT: 'Anti-Terrorist', GUARD: 'Hostage Guards' };

/**
 * Everything a controller (human or bot) can ask an actor to do in one tick.
 * This is the message a networked client would send to the authoritative server.
 */
export interface InputCommand {
  moveX: number; // -1..1
  moveY: number; // -1..1
  run: boolean;
  aimAngle: number; // radians, world space
  aimDist: number; // px from actor to the mouse / desired crosshair distance
  aimMoved: boolean; // aim input changed meaningfully this tick
  fire: boolean; // held
  reload: boolean; // edge
  interact: boolean; // held (hostage rescue is a hold)
  interactPressed: boolean; // edge
  switchSlot: WeaponSlot | null; // edge
  toggleLight: boolean; // edge
  applyPlate: boolean; // edge
}

export const emptyInput = (): InputCommand => ({
  moveX: 0, moveY: 0, run: false, aimAngle: 0, aimDist: 200, aimMoved: false, fire: false, reload: false,
  interact: false, interactPressed: false, switchSlot: null, toggleLight: false, applyPlate: false,
});

export interface WeaponInstance {
  def: WeaponId;
  mag: number;
}

export interface Inventory {
  slots: [WeaponInstance | null, WeaponInstance | null];
  active: WeaponSlot;
  reserve: Record<Caliber, number>;
  plates: number;
}

export interface AimState {
  angle: number; // smoothed firing line angle
  recoil: number; // angular recoil offset
  bloom: number; // extra spread from sustained fire
  lock: number; // 0..1 crosshair attraction progress
  lockTarget: number; // actor id or -1
  cx: number; cy: number; // crosshair world position
  lineEnd: number; // distance to first obstacle along the firing line
  freeDist: number; // smoothed distance along the line when not locked
}

export interface Actor {
  id: number;
  name: string;
  team: Team;
  isBot: boolean;
  x: number; y: number;
  vx: number; vy: number;
  radius: number;
  moveAngle: number;
  speed: number; // current speed (px/s) for animation
  health: number;
  maxHealth: number;
  armor: number;
  maxArmor: number;
  alive: boolean;
  inv: Inventory;
  aim: AimState;
  flashlight: boolean;
  /** remembered flashlight state before auto-stealth turned it off */
  lightBeforeHide: boolean;
  hidden: boolean;
  hideTimer: number;
  stillTime: number;
  reloadTimer: number; // >0 while reloading
  reloadTotal: number;
  swapTimer: number;
  plateTimer: number; // >0 while applying armor
  plateTotal: number;
  fireCooldown: number;
  triggerHeld: boolean;
  muzzleTimer: number; // >0 shortly after firing (reveals position)
  hurtTimer: number;
  interactTimer: number; // hostage rescue progress
  interactTarget: number;
  stepAccum: number;
  mods: SkillMods;
  stats: { kills: number; deaths: number; shots: number; hits: number; coins: number; weaponKills: Record<WeaponId, number>; hiddenTime: number; detected: boolean; rescues: number; ghostRescues: number };
  /** highest bot alertness towards this actor (0..1+), for HUD feedback */
  threat: number;
  lastDamageFrom: number;
}

export type PickupKind = 'weapon' | 'plate' | 'coin' | 'crate';
export interface Pickup {
  id: number;
  kind: PickupKind;
  x: number; y: number;
  weapon?: WeaponId;
  mag?: number;
  reserve?: number;
  value?: number;
  /** crate bookkeeping: `${actorId}:${caliber}` already taken */
  taken?: string[];
  forTeam?: Team;
  spawnTime: number;
  vx?: number; vy?: number;
}

export type HostageState = 'captive' | 'following' | 'rescued';
export interface Hostage {
  id: number;
  x: number; y: number;
  homeX: number; homeY: number;
  room: string;
  state: HostageState;
  follow: number; // actor id
  path: [number, number][];
  pathTimer: number;
  facing: number;
  variant: number;
}

export interface Noise {
  x: number; y: number;
  radius: number;
  team: Team;
  sourceId: number;
  kind: 'gunshot' | 'footstep' | 'impact' | 'shout';
}

export type MatchPhase = 'briefing' | 'live' | 'ended';
export interface MatchConfig {
  playerTeam: Team;
  difficulty: Difficulty;
  allies: number;
  seed: number;
  hostages: number;
  timeLimit: number;
  attract?: boolean; // menu background: guards only, no match logic
}

export interface MatchState {
  phase: MatchPhase;
  time: number; // seconds elapsed in live phase
  timeLeft: number;
  briefing: number;
  winner: Team | null;
  reason: string;
  hostagesTotal: number;
  hostagesRescued: number;
}

export type SimEvent =
  | { type: 'shot'; actor: number; weapon: WeaponId; x: number; y: number; tx: number; ty: number; hit: 'wall' | 'furniture' | 'actor' | 'none'; nx: number; ny: number; angle: number }
  | { type: 'damage'; target: number; source: number; amount: number; x: number; y: number; armor: boolean; angle: number }
  | { type: 'death'; actor: number; killer: number; weapon: WeaponId | null }
  | { type: 'reload'; actor: number; weapon: WeaponId; duration: number }
  | { type: 'reloadDone'; actor: number }
  | { type: 'dryFire'; actor: number }
  | { type: 'swap'; actor: number; slot: WeaponSlot }
  | { type: 'pickup'; actor: number; kind: PickupKind; label: string; x: number; y: number }
  | { type: 'coin'; actor: number; amount: number; x: number; y: number }
  | { type: 'flashlight'; actor: number; on: boolean }
  | { type: 'stealth'; actor: number; hidden: boolean }
  | { type: 'plateStart'; actor: number; duration: number }
  | { type: 'plateDone'; actor: number }
  | { type: 'alert'; bot: number; target: number }
  | { type: 'suspicious'; bot: number; target: number }
  | { type: 'footstep'; actor: number; x: number; y: number; run: boolean }
  | { type: 'hostageFreed'; hostage: number; by: number }
  | { type: 'hostageRescued'; hostage: number; by: number }
  | { type: 'notice'; text: string; tone: 'info' | 'good' | 'bad' }
  | { type: 'matchEnd'; winner: Team; reason: string };
