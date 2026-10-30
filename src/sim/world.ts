import { Rng } from '../core/rng';
import { angleDiff, approach, clamp, dist, easeInOut, lerp, rotateTowards, wrapAngle } from '../core/math';
import { CALIBERS, Caliber, damageAt, WEAPONS, WeaponId, WeaponSlot } from '../data/weapons';
import { computeSkillMods, DEFAULT_MODS, SkillMods } from '../data/skills';
import { DIFFICULTIES, DifficultyDef } from '../data/difficulty';
import { HotelMap } from './map';
import { Navigator } from './nav';
import { TILE } from './mapTypes';
import {
  Actor, emptyInput, Hostage, InputCommand, Inventory, MatchConfig, MatchState, Noise, otherTeam, Pickup, SimEvent, Team, TEAM_NAMES,
} from './types';
import { BotBrain } from './ai/bot';

export const FLASH_RANGE = 440;
export const FLASH_HALF = 0.42;
export const WALK_SPEED = 160;
export const RUN_SPEED = 240;
export const PLATE_ARMOR = 50;
const INTERACT_RANGE = 52;
const RESCUE_TIME = 1.6;

const GUARD_NAMES = ['Viper', 'Kestrel', 'Morrow', 'Dace', 'Rook', 'Sable', 'Grieve', 'Halloran', 'Voss', 'Tarn', 'Crane', 'Mercer', 'Lusk', 'Brandt'];
const AT_NAMES = ['Hale', 'Ortega', 'Kim', 'Novak', 'Adeyemi', 'Reyes', 'Lindqvist', 'Sato'];

export interface Corpse { x: number; y: number; team: Team; id: number; time: number }

const emptyReserve = (): Record<Caliber, number> => Object.fromEntries(CALIBERS.map((c) => [c, 0])) as Record<Caliber, number>;

/**
 * Authoritative game simulation. Owns all gameplay state and advances it in fixed steps.
 * Rendering, audio and UI read from it and consume `events`; nothing here touches Phaser.
 */
export class World {
  readonly map: HotelMap;
  readonly nav: Navigator;
  readonly rng: Rng;
  readonly diff: DifficultyDef;
  readonly actors: Actor[] = [];
  readonly brains = new Map<number, BotBrain>();
  readonly pickups: Pickup[] = [];
  readonly hostages: Hostage[] = [];
  readonly corpses: Corpse[] = [];
  noises: Noise[] = [];
  private pendingNoises: Noise[] = [];
  events: SimEvent[] = [];
  readonly match: MatchState;
  time = 0;
  private nextId = 1;
  readonly humanIds: number[] = [];

  constructor(readonly config: MatchConfig, humanSkillLevels: Record<string, number> = {}, map?: HotelMap) {
    this.map = map ?? new HotelMap();
    this.nav = new Navigator(this.map);
    this.rng = new Rng(config.seed);
    this.diff = DIFFICULTIES[config.difficulty];
    this.match = {
      phase: config.attract ? 'live' : 'briefing', time: 0, timeLeft: config.timeLimit, briefing: 3.2, winner: null, reason: '',
      hostagesTotal: config.hostages, hostagesRescued: 0,
    };
    this.setup(computeSkillMods(humanSkillLevels));
  }

  // ------------------------------------------------------------------ setup
  private T = (x: number, y: number): [number, number] => this.map.nearestWalkable(x * TILE, y * TILE);

  private setup(humanMods: SkillMods) {
    const L = this.map.layout;
    const rng = this.rng;
    const cfg = this.config;

    // hostages
    const spots = rng.shuffle([...L.hostageSpots]).slice(0, cfg.attract ? 0 : cfg.hostages);
    spots.forEach((s, i) => {
      const [x, y] = this.T(s.x, s.y);
      this.hostages.push({ id: this.nextId++, x, y, homeX: x, homeY: y, room: s.room, state: 'captive', follow: -1, path: [], pathTimer: 0, facing: rng.range(-Math.PI, Math.PI), variant: i % 3 });
    });

    const routes = rng.shuffle(L.patrolRoutes.map((_, i) => i));
    let routeCursor = 0;
    const guardNames = rng.shuffle([...GUARD_NAMES]);
    const atNames = rng.shuffle([...AT_NAMES]);

    const playerTeam = cfg.playerTeam;
    const enemyBots = cfg.attract ? 0 : playerTeam === 'AT' ? this.diff.enemyCount + cfg.allies : Math.max(3, Math.round(this.diff.enemyCount * 0.45)) + cfg.allies;
    const guardCount = cfg.attract ? 6 : playerTeam === 'GUARD' ? cfg.hostages + cfg.allies : enemyBots;
    const atBots = cfg.attract ? 0 : playerTeam === 'AT' ? cfg.allies : enemyBots;

    // human player
    if (!cfg.attract) {
      const p = this.createActor('You', playerTeam, false, humanMods);
      p.inv.slots[1] = { def: 'pistol', mag: 5 };
      p.inv.active = 1;
      p.inv.plates = 1;
      if (playerTeam === 'AT') {
        const [x, y] = this.T(...L.spawnsAT[0]);
        p.x = x; p.y = y; p.aim.angle = -Math.PI / 2;
      } else {
        const h = this.hostages[0];
        const [x, y] = this.map.nearestWalkable(h.x + 40, h.y + 30);
        p.x = x; p.y = y;
      }
      this.humanIds.push(p.id);
    }

    // guards
    const guardWeapon = (): WeaponId => {
      const r = rng.next();
      if (cfg.difficulty === 'easy') return r < 0.5 ? 'pistol' : r < 0.8 ? 'mp5' : r < 0.95 ? 'm4' : 'deagle';
      if (cfg.difficulty === 'hard') return r < 0.2 ? 'pistol' : r < 0.5 ? 'mp5' : r < 0.85 ? 'm4' : 'deagle';
      return r < 0.35 ? 'pistol' : r < 0.65 ? 'mp5' : r < 0.9 ? 'm4' : 'deagle';
    };
    for (let i = 0; i < guardCount; i++) {
      const g = this.createActor(guardNames[i % guardNames.length], 'GUARD', true, DEFAULT_MODS);
      const w = guardWeapon();
      this.giveWeapon(g, w, true);
      const brain = new BotBrain(g.id, this);
      if (i < this.hostages.length) {
        const h = this.hostages[i];
        const [x, y] = this.map.nearestWalkable(h.x + rng.range(-50, 50), h.y + rng.range(-50, 50));
        g.x = x; g.y = y;
        brain.setGuard(h.x, h.y, h.id);
      } else {
        const ri = routes[routeCursor++ % routes.length];
        const route = L.patrolRoutes[ri];
        const start = rng.int(0, route.length - 1);
        const [x, y] = this.T(...route[start]);
        g.x = x; g.y = y;
        brain.setPatrol(ri, start);
      }
      g.aim.angle = rng.range(-Math.PI, Math.PI);
      this.brains.set(g.id, brain);
    }
    // anti-terrorist bots
    for (let i = 0; i < atBots; i++) {
      const a = this.createActor(atNames[i % atNames.length], 'AT', true, DEFAULT_MODS);
      this.giveWeapon(a, 'pistol', true);
      if (rng.chance(0.85)) this.giveWeapon(a, rng.chance(0.5) ? 'mp5' : 'm4', true);
      const sp = L.spawnsAT[(i + 1) % L.spawnsAT.length];
      const [x, y] = this.T(sp[0], sp[1]);
      a.x = x; a.y = y; a.aim.angle = -Math.PI / 2;
      const brain = new BotBrain(a.id, this);
      brain.setAssault(i);
      this.brains.set(a.id, brain);
    }

    if (cfg.attract) return;
    // pickups
    const wSpots = rng.shuffle([...L.weaponSpots]);
    const want: Record<string, number> = { mp5: 2, m4: 2, deagle: rng.chance(0.6) ? 2 : 1 };
    for (const s of wSpots) {
      if ((want[s.weapon] ?? 0) <= 0) continue;
      want[s.weapon]--;
      const def = WEAPONS[s.weapon];
      const total = rng.int(10, 30);
      const mag = Math.min(def.magazine, total);
      const [x, y] = this.T(s.x, s.y);
      this.addPickup({ kind: 'weapon', x, y, weapon: s.weapon, mag, reserve: total - mag });
    }
    for (const c of rng.shuffle([...L.crateSpots]).slice(0, 7)) {
      const [x, y] = this.T(c[0], c[1]);
      this.addPickup({ kind: 'crate', x, y, taken: [] });
    }
    for (const c of rng.shuffle([...L.plateSpots]).slice(0, 5)) {
      const [x, y] = this.T(c[0], c[1]);
      this.addPickup({ kind: 'plate', x, y });
    }
  }

  createActor(name: string, team: Team, isBot: boolean, mods: SkillMods): Actor {
    const inv: Inventory = { slots: [null, null], active: 1, reserve: emptyReserve(), plates: 0 };
    const a: Actor = {
      id: this.nextId++, name, team, isBot, x: 0, y: 0, vx: 0, vy: 0, radius: 13, moveAngle: 0, speed: 0,
      health: 100, maxHealth: 100, armor: 0, maxArmor: 100, alive: true, inv,
      aim: { angle: 0, recoil: 0, bloom: 0, lock: 0, lockTarget: -1, cx: 0, cy: 0, lineEnd: 0, freeDist: 200 },
      flashlight: true, lightBeforeHide: true, hidden: false, hideTimer: 0, stillTime: 0,
      reloadTimer: 0, reloadTotal: 0, swapTimer: 0, plateTimer: 0, plateTotal: 0, fireCooldown: 0, triggerHeld: false,
      muzzleTimer: 0, hurtTimer: 0, interactTimer: 0, interactTarget: -1, stepAccum: 0, mods,
      stats: { kills: 0, deaths: 0, shots: 0, hits: 0, coins: 0, weaponKills: { pistol: 0, mp5: 0, m4: 0, deagle: 0 }, hiddenTime: 0, detected: false, rescues: 0, ghostRescues: 0 },
      threat: 0, lastDamageFrom: -1,
    };
    this.actors.push(a);
    return a;
  }

  private giveWeapon(a: Actor, w: WeaponId, withReserve: boolean) {
    const def = WEAPONS[w];
    a.inv.slots[def.slot] = { def: w, mag: def.magazine };
    if (withReserve) a.inv.reserve[def.caliber] += def.magazine * 2;
    if (def.slot === 0 || !a.inv.slots[0]) a.inv.active = def.slot;
  }

  private addPickup(p: Omit<Pickup, 'id' | 'spawnTime'>) {
    const pk: Pickup = { ...p, id: this.nextId++, spawnTime: this.time };
    this.pickups.push(pk);
    return pk;
  }

  actor(id: number) {
    return this.actors.find((a) => a.id === id);
  }

  // ------------------------------------------------------------------ main step
  step(dt: number, inputs: Map<number, InputCommand>) {
    this.time += dt;
    const m = this.match;
    this.noises = this.pendingNoises;
    this.pendingNoises = [];

    if (m.phase === 'briefing') {
      m.briefing -= dt;
      if (m.briefing <= 0) m.phase = 'live';
    }
    const frozen = m.phase !== 'live';
    if (m.phase === 'live' && !this.config.attract) {
      m.time += dt;
      m.timeLeft = Math.max(0, this.config.timeLimit - m.time);
    }

    for (const a of this.actors) {
      if (!a.alive) continue;
      let input: InputCommand;
      const brain = this.brains.get(a.id);
      if (brain) input = frozen ? emptyInput() : brain.update(dt);
      else input = inputs.get(a.id) ?? emptyInput();
      if (frozen) { input = { ...emptyInput(), aimAngle: input.aimAngle, aimDist: input.aimDist }; }
      this.updateActor(a, input, dt);
    }
    this.updateHostages(dt);
    this.updatePickups(dt);
    if (!this.config.attract) this.updateThreat();
    if (m.phase === 'live' && !this.config.attract) this.checkMatchEnd();
  }

  drainEvents(): SimEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  emit(e: SimEvent) {
    this.events.push(e);
  }

  noise(n: Noise) {
    this.pendingNoises.push(n);
  }

  // ------------------------------------------------------------------ actors
  private updateActor(a: Actor, input: InputCommand, dt: number) {
    const inv = a.inv;
    const wi = inv.slots[inv.active];
    const def = wi ? WEAPONS[wi.def] : null;

    // timers
    a.fireCooldown = Math.max(0, a.fireCooldown - dt);
    a.muzzleTimer = Math.max(0, a.muzzleTimer - dt);
    a.hurtTimer = Math.max(0, a.hurtTimer - dt);
    if (a.swapTimer > 0) a.swapTimer = Math.max(0, a.swapTimer - dt);

    // ---- movement
    let mx = input.moveX, my = input.moveY;
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    const moving = ml > 0.05;
    let speed = (input.run ? RUN_SPEED : WALK_SPEED) * a.mods.moveSpeed;
    if (a.plateTimer > 0) speed *= 0.45;
    else if (a.reloadTimer > 0) speed *= 0.85;
    if (input.fire && !input.run) speed *= 0.9;
    const tvx = mx * speed, tvy = my * speed;
    const k = approach(moving ? 14 : 18, dt);
    a.vx = lerp(a.vx, tvx, k);
    a.vy = lerp(a.vy, tvy, k);
    if (Math.abs(a.vx) < 1 && !moving) a.vx = 0;
    if (Math.abs(a.vy) < 1 && !moving) a.vy = 0;
    const [nx, ny] = this.map.moveCircle(a.x, a.y, a.vx * dt, a.vy * dt, a.radius);
    const realVx = (nx - a.x) / dt, realVy = (ny - a.y) / dt;
    a.x = nx; a.y = ny;
    a.speed = Math.hypot(realVx, realVy);
    if (a.speed > 10) a.moveAngle = Math.atan2(realVy, realVx);

    // footsteps
    if (a.speed > 40) {
      a.stepAccum += a.speed * dt;
      const stride = input.run ? 62 : 52;
      if (a.stepAccum > stride) {
        a.stepAccum = 0;
        this.emit({ type: 'footstep', actor: a.id, x: a.x, y: a.y, run: input.run });
        const r = (input.run ? 320 : 130) * a.mods.footstepNoise;
        this.noise({ x: a.x, y: a.y, radius: r, team: a.team, sourceId: a.id, kind: 'footstep' });
      }
    }

    // ---- aim
    this.updateAim(a, input, dt, moving);

    // ---- flashlight toggle
    if (input.toggleLight) {
      a.flashlight = !a.flashlight;
      if (a.hidden) this.setHidden(a, false, false);
      a.lightBeforeHide = a.flashlight;
      this.emit({ type: 'flashlight', actor: a.id, on: a.flashlight });
    }

    // ---- weapon swap
    if (input.switchSlot !== null && input.switchSlot !== inv.active && inv.slots[input.switchSlot] && a.plateTimer <= 0) {
      inv.active = input.switchSlot;
      a.reloadTimer = 0;
      a.swapTimer = 0.45 * a.mods.handling;
      a.aim.lock *= 0.3;
      this.emit({ type: 'swap', actor: a.id, slot: inv.active });
    }

    // ---- armor plate
    if (input.applyPlate && a.plateTimer <= 0 && inv.plates > 0 && a.armor < a.maxArmor) {
      a.reloadTimer = 0;
      a.plateTotal = a.plateTimer = 2.2 * a.mods.plateTime;
      this.emit({ type: 'plateStart', actor: a.id, duration: a.plateTotal });
    }
    if (a.plateTimer > 0) {
      a.plateTimer -= dt;
      if (a.plateTimer <= 0) {
        a.plateTimer = 0;
        inv.plates--;
        a.armor = Math.min(a.maxArmor, a.armor + PLATE_ARMOR);
        this.emit({ type: 'plateDone', actor: a.id });
      }
    }

    // ---- reload
    if (wi && def) {
      if (input.reload && a.reloadTimer <= 0 && a.plateTimer <= 0 && wi.mag < def.magazine && inv.reserve[def.caliber] > 0) this.startReload(a);
      if (a.reloadTimer > 0) {
        a.reloadTimer -= dt;
        if (a.reloadTimer <= 0) {
          a.reloadTimer = 0;
          const take = Math.min(def.magazine - wi.mag, inv.reserve[def.caliber]);
          wi.mag += take;
          inv.reserve[def.caliber] -= take;
          this.emit({ type: 'reloadDone', actor: a.id });
        }
      }
    }

    // ---- firing
    const pressed = input.fire && !a.triggerHeld;
    a.triggerHeld = input.fire;
    if (input.fire && wi && def && a.fireCooldown <= 0 && a.swapTimer <= 0 && a.plateTimer <= 0 && (def.automatic || pressed)) {
      if (a.reloadTimer > 0) {
        // can't fire while reloading
      } else if (wi.mag <= 0) {
        if (pressed) {
          this.emit({ type: 'dryFire', actor: a.id });
          a.fireCooldown = 0.25;
          if (inv.reserve[def.caliber] > 0) this.startReload(a);
        }
      } else {
        this.fire(a, wi.def);
      }
    }

    // ---- interaction
    this.updateInteraction(a, input, dt);

    // ---- stealth
    this.updateStealth(a, input, dt, moving);
  }

  private startReload(a: Actor) {
    const wi = a.inv.slots[a.inv.active]!;
    const def = WEAPONS[wi.def];
    a.reloadTotal = a.reloadTimer = def.reloadTime * a.mods.handling;
    this.emit({ type: 'reload', actor: a.id, weapon: wi.def, duration: a.reloadTotal });
  }

  private updateAim(a: Actor, input: InputCommand, dt: number, moving: boolean) {
    const aim = a.aim;
    const wi = a.inv.slots[a.inv.active];
    const def = WEAPONS[wi?.def ?? 'pistol'];
    const wm = a.mods.weapon[def.id];

    if (a.isBot) aim.angle = rotateTowards(aim.angle, input.aimAngle, this.diff.turnRate * dt);
    else aim.angle = wrapAngle(aim.angle + angleDiff(aim.angle, input.aimAngle) * approach(22, dt));

    // recoil & bloom recovery
    aim.recoil *= Math.exp(-def.recoilRecovery * wm.recovery * dt);
    aim.bloom *= Math.exp(-def.recoilRecovery * wm.recovery * 0.8 * dt);
    if (moving) aim.recoil += Math.sin(this.time * 7 + a.id) * def.moveSpread * 0.25 * dt * 6;

    // the firing line stops at the first wall, tall object or piece of cover a bullet would hit
    aim.lineEnd = a.isBot ? this.map.raycast(a.x, a.y, aim.angle, def.range, 'opaque') : Math.min(this.map.raycast(a.x, a.y, aim.angle, def.range, 'opaque'), this.map.traceBullet(a.x, a.y, aim.angle, def.range).dist);
    const desired = clamp(input.aimDist, 46, aim.lineEnd);
    aim.freeDist = lerp(aim.freeDist, desired, approach(def.glide, dt));

    // free crosshair point on the firing line (with recoil deviation)
    const fa = aim.angle + aim.recoil;
    let tx = a.x + Math.cos(fa) * aim.freeDist;
    let ty = a.y + Math.sin(fa) * aim.freeDist;

    if (!a.isBot) {
      // --- signature attraction system
      const target = this.findAttractTarget(a, def.attractWidth, aim.lineEnd);
      if (target) {
        if (target.id !== aim.lockTarget) {
          aim.lock *= 0.25;
          aim.lockTarget = target.id;
        }
        const d = dist(a.x, a.y, target.x, target.y);
        const distF = clamp(1.25 - d / 900, 0.35, 1.1);
        const moveF = moving ? 0.65 : 1;
        const stealthF = 1;
        aim.lock = Math.min(1, aim.lock + def.attractRate * wm.attract * distF * moveF * stealthF * dt);
      } else {
        aim.lock = Math.max(0, aim.lock - 2.6 * dt);
        if (aim.lock === 0) aim.lockTarget = -1;
      }
      const lt = aim.lockTarget >= 0 ? this.actor(aim.lockTarget) : undefined;
      if (lt && lt.alive && aim.lock > 0) {
        const e = easeInOut(aim.lock);
        // the target point keeps recoil deviation so shots after a kick pull back onto the target
        const rd = dist(a.x, a.y, lt.x, lt.y);
        const ra = Math.atan2(lt.y - a.y, lt.x - a.x) + aim.recoil * 0.85;
        const lx = a.x + Math.cos(ra) * rd, ly = a.y + Math.sin(ra) * rd;
        tx = lerp(tx, lx, e);
        ty = lerp(ty, ly, e);
      }
      const g = approach(def.glide * 1.15, dt);
      aim.cx = lerp(aim.cx || tx, tx, g);
      aim.cy = lerp(aim.cy || ty, ty, g);
    } else {
      aim.cx = tx;
      aim.cy = ty;
    }
  }

  private diffRange(a: Actor) {
    return WEAPONS[a.inv.slots[a.inv.active]?.def ?? 'pistol'].range;
  }

  /** Enemy closest to the firing line corridor that the actor can actually perceive. */
  private findAttractTarget(a: Actor, width: number, lineEnd: number): Actor | null {
    const dx = Math.cos(a.aim.angle), dy = Math.sin(a.aim.angle);
    let best: Actor | null = null;
    let bestScore = Infinity;
    for (const o of this.actors) {
      if (!o.alive || o.team === a.team) continue;
      const rx = o.x - a.x, ry = o.y - a.y;
      const along = rx * dx + ry * dy;
      if (along < 20 || along > (this.diffRange(a) ?? lineEnd) + o.radius) continue;
      const perp = Math.abs(rx * dy - ry * dx);
      const w = width + o.radius * 0.5 + along * 0.02;
      if (perp > w) continue;
      if (along > lineEnd + o.radius + 4 && !this.map.lineClear(a.x, a.y, o.x, o.y)) continue;
      if (!this.map.lineClear(a.x, a.y, o.x, o.y)) continue;
      // bullets must actually be able to reach the target (cover blocks the attraction)
      const da = Math.atan2(o.y - a.y, o.x - a.x), dd = Math.hypot(rx, ry);
      if (this.map.traceBullet(a.x, a.y, da, dd).dist < dd - o.radius) continue;
      if (this.perceive(a, o) < 0.1 && along > 120) continue;
      const score = perp / w + along / 2000 + (o.id === a.aim.lockTarget ? -0.35 : 0);
      if (score < bestScore) { bestScore = score; best = o; }
    }
    return best;
  }

  private fire(a: Actor, w: WeaponId) {
    const def = WEAPONS[w];
    const wi = a.inv.slots[a.inv.active]!;
    const wm = a.mods.weapon[w];
    const aim = a.aim;
    wi.mag--;
    a.fireCooldown = 60 / def.rpm;
    a.muzzleTimer = 0.3;
    a.stats.shots++;
    if (a.hidden) this.setHidden(a, false, true);

    const moveF = clamp(a.speed / WALK_SPEED, 0, 1.4);
    let spread = def.spread * wm.spread * (1 - 0.55 * aim.lock) + moveF * def.moveSpread * wm.spread + aim.bloom;
    let angle = Math.atan2(aim.cy - a.y, aim.cx - a.x);
    if (a.isBot) {
      spread += this.diff.aimError;
      angle = aim.angle + aim.recoil;
    }
    angle += this.rng.gauss() * spread * 0.5;

    // recoil kick: mostly one direction per burst with some randomness
    const sign = aim.recoil >= 0 ? (this.rng.chance(0.7) ? 1 : -1) : (this.rng.chance(0.7) ? -1 : 1);
    aim.recoil += def.recoilKick * wm.recoil * sign * (0.6 + this.rng.next() * 0.5);
    aim.bloom = Math.min(0.15, aim.bloom + def.bloomPerShot * wm.recoil);
    aim.lock *= 1 - def.lockLoss * wm.lockLoss;

    const hit = this.map.traceBullet(a.x, a.y, angle, def.range);
    let endD = hit.dist;
    let victim: Actor | null = null;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    for (const o of this.actors) {
      if (!o.alive || o === a || o.team === a.team) continue;
      const t = rayCircle(a.x, a.y, dx, dy, o.x, o.y, o.radius + 1);
      if (t !== null && t < endD) { endD = t; victim = o; }
    }
    const tx = a.x + dx * endD, ty = a.y + dy * endD;
    this.emit({ type: 'shot', actor: a.id, weapon: w, x: a.x + dx * def.muzzle, y: a.y + dy * def.muzzle, tx, ty, hit: victim ? 'actor' : hit.kind, nx: hit.nx, ny: hit.ny, angle });
    this.noise({ x: a.x, y: a.y, radius: def.noiseRadius, team: a.team, sourceId: a.id, kind: 'gunshot' });
    if (hit.kind !== 'none' && !victim) this.noise({ x: tx, y: ty, radius: 160, team: a.team, sourceId: a.id, kind: 'impact' });
    if (victim) {
      a.stats.hits++;
      this.damage(victim, damageAt(def, endD), a, w, angle);
    }
  }

  damage(t: Actor, amount: number, src: Actor | null, w: WeaponId | null, angle: number) {
    if (!t.alive) return;
    let armorHit = false;
    if (t.armor > 0) {
      const absorbed = Math.min(t.armor, amount * 0.6);
      t.armor -= absorbed;
      amount -= absorbed;
      armorHit = true;
    }
    t.health -= amount;
    t.hurtTimer = 0.22;
    t.lastDamageFrom = src?.id ?? -1;
    if (t.hidden) this.setHidden(t, false, true);
    // interrupt plate application
    if (t.plateTimer > 0 && amount > 8) { t.plateTimer = 0; }
    this.emit({ type: 'damage', target: t.id, source: src?.id ?? -1, amount, x: t.x, y: t.y, armor: armorHit, angle });
    this.brains.get(t.id)?.onDamaged(src);
    if (t.health <= 0) this.kill(t, src, w);
  }

  private kill(t: Actor, src: Actor | null, w: WeaponId | null) {
    t.health = 0;
    t.alive = false;
    t.flashlight = false;
    t.stats.deaths++;
    t.reloadTimer = t.plateTimer = 0;
    if (src) {
      src.stats.kills++;
      if (w) src.stats.weaponKills[w]++;
    }
    // drop active weapon with exactly the ammunition it carried
    const wi = t.inv.slots[t.inv.active] ?? t.inv.slots[0] ?? t.inv.slots[1];
    if (wi) {
      const def = WEAPONS[wi.def];
      const reserve = t.inv.reserve[def.caliber];
      this.addPickup({ kind: 'weapon', x: t.x, y: t.y, weapon: wi.def, mag: wi.mag, reserve, vx: this.rng.range(-60, 60), vy: this.rng.range(-60, 60) });
    }
    // coin for the killing team
    if (src && this.humanIds.length && this.actors.some((h) => !h.isBot && h.team === src.team)) {
      this.addPickup({ kind: 'coin', x: t.x, y: t.y, value: 5, forTeam: src.team, vx: this.rng.range(-90, 90), vy: this.rng.range(-90, 90) });
    }
    this.corpses.push({ x: t.x, y: t.y, team: t.team, id: t.id, time: this.time });
    for (const h of this.hostages) if (h.follow === t.id && h.state === 'following') { h.state = 'captive'; h.follow = -1; h.homeX = h.x; h.homeY = h.y; }
    this.emit({ type: 'death', actor: t.id, killer: src?.id ?? -1, weapon: w });
    if (src && !t.isBot) this.emit({ type: 'notice', text: `Eliminated by ${src.name}`, tone: 'bad' });
  }

  private setHidden(a: Actor, hidden: boolean, broke: boolean) {
    if (a.hidden === hidden) return;
    a.hidden = hidden;
    if (hidden) {
      a.lightBeforeHide = a.flashlight;
      if (a.flashlight) {
        a.flashlight = false;
        this.emit({ type: 'flashlight', actor: a.id, on: false });
      }
    } else if (broke && a.lightBeforeHide && !a.flashlight) {
      a.flashlight = true;
      this.emit({ type: 'flashlight', actor: a.id, on: true });
    }
    a.stillTime = 0;
    this.emit({ type: 'stealth', actor: a.id, hidden });
  }

  /** Is this spot dark and enclosed enough to hide in? */
  hideSpotQuality(a: Actor): number {
    const light = this.map.staticLightAt(a.x, a.y) + this.flashlightAt(a.x, a.y, a.id) * 0.6;
    const thr = a.mods.darknessThreshold;
    if (light > thr) return 0;
    // proximity to walls/furniture: probe 8 directions
    let near = 0;
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const px = a.x + Math.cos(ang) * (a.radius + 14), py = a.y + Math.sin(ang) * (a.radius + 14);
      const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
      if (this.map.isSolidTile(tx, ty) || !this.map.isWalkable(tx, ty)) near++;
    }
    if (near < 2) return 0;
    return clamp(1 - light / thr, 0, 1) * clamp(near / 4, 0.5, 1);
  }

  private updateStealth(a: Actor, input: InputCommand, dt: number, moving: boolean) {
    const busy = moving || input.fire || input.aimMoved || a.speed > 8 || a.plateTimer > 0;
    if (a.hidden) {
      a.stats.hiddenTime += dt;
      if (busy || input.toggleLight) this.setHidden(a, false, true);
      return;
    }
    if (a.isBot) return;
    if (busy) { a.stillTime = 0; a.hideTimer = 0; return; }
    a.stillTime += dt;
    const q = this.hideSpotQuality(a);
    if (q <= 0) { a.hideTimer = 0; return; }
    a.hideTimer = a.stillTime / a.mods.hideTime;
    if (a.stillTime >= a.mods.hideTime) this.setHidden(a, true, false);
  }

  // ------------------------------------------------------------------ perception
  /** Flashlight illumination at a point from every active beam (except one actor's own). */
  flashlightAt(x: number, y: number, excludeId = -1): number {
    let L = 0;
    for (const o of this.actors) {
      if (!o.alive || !o.flashlight || o.id === excludeId) continue;
      const d = dist(o.x, o.y, x, y);
      if (d > FLASH_RANGE) continue;
      if (d < 36) { L = Math.max(L, 0.5); continue; }
      const da = Math.abs(angleDiff(o.aim.angle, Math.atan2(y - o.y, x - o.x)));
      if (da > FLASH_HALF + 0.08) continue;
      if (!this.map.lineClear(o.x, o.y, x, y)) continue;
      const ang = clamp(1 - (da - FLASH_HALF * 0.6) / (FLASH_HALF * 0.5), 0, 1);
      L += Math.pow(1 - d / FLASH_RANGE, 0.7) * ang * 1.1;
    }
    return L;
  }

  lightAt(x: number, y: number, excludeId = -1) {
    return this.map.staticLightAt(x, y) + this.flashlightAt(x, y, excludeId);
  }

  /**
   * How visible `t` is to observer `o` this instant (0 = invisible, ~1 = plainly visible).
   * Combines field of view, line of sight, lighting, distance, movement and stealth.
   */
  visibility(o: Actor, t: Actor, useFov = true): number {
    const d = dist(o.x, o.y, t.x, t.y);
    if (d > 1150) return 0;
    let fov = 1;
    if (useFov) {
      const da = Math.abs(angleDiff(o.aim.angle, Math.atan2(t.y - o.y, t.x - o.x)));
      fov = da < 1.05 ? 1 : da < 1.75 ? 0.35 : d < 70 ? 0.6 : 0;
      if (fov === 0) return 0;
    }
    if (!this.map.lineClear(o.x, o.y, t.x, t.y)) return 0;
    let L = this.map.staticLightAt(t.x, t.y) + this.flashlightAt(t.x, t.y, t.id);
    if (t.flashlight) L = Math.max(L, 0.95);
    if (t.muzzleTimer > 0) L = Math.max(L, 1.2);
    L = clamp(L, 0, 1.2);
    const base = Math.max(L, d < 90 ? 0.6 : d < 160 ? 0.25 : 0.04);
    const motion = t.speed > 200 ? 1.3 : t.speed > 30 ? 1.1 : 0.85;
    const distF = d < 250 ? 1 : clamp(1 - (d - 250) / (t.flashlight ? 900 : 650), 0, 1);
    let v = base * motion * distF * fov;
    if (t.hidden) {
      v *= 0.16 * t.mods.concealment;
      // a beam directly on you at close range will eventually give you away
      const beam = o.flashlight ? this.flashlightAt(t.x, t.y, t.id) : 0;
      if (beam > 0.5 && d < 180) v = Math.max(v, 0.35 * t.mods.concealment);
    }
    return clamp(v, 0, 1.3);
  }

  /** Visibility without field-of-view restriction (used for the player's aim assist). */
  perceive(o: Actor, t: Actor) {
    return this.visibility(o, t, false);
  }

  private updateThreat() {
    for (const a of this.actors) {
      if (a.isBot) continue;
      let th = 0;
      for (const [, b] of this.brains) {
        const ba = this.actor(b.actorId);
        if (!ba?.alive || ba.team === a.team) continue;
        th = Math.max(th, b.detectionOf(a.id));
      }
      a.threat = th;
    }
  }

  // ------------------------------------------------------------------ interaction
  interactable(a: Actor): { kind: 'weapon' | 'crate' | 'hostage'; id: number; text: string; progress?: number; blocked?: boolean } | null {
    let best: { kind: 'weapon' | 'crate' | 'hostage'; id: number; text: string; progress?: number; blocked?: boolean } | null = null;
    let bestD = INTERACT_RANGE;
    if (a.team === 'AT') {
      for (const h of this.hostages) {
        if (h.state !== 'captive') continue;
        const d = dist(a.x, a.y, h.x, h.y);
        if (d < bestD + 8) { bestD = d; best = { kind: 'hostage', id: h.id, text: 'Hold E — Free hostage', progress: a.interactTarget === h.id ? a.interactTimer / RESCUE_TIME : 0 }; }
      }
      if (best) return best;
    }
    for (const p of this.pickups) {
      if (p.kind !== 'weapon' && p.kind !== 'crate') continue;
      const d = dist(a.x, a.y, p.x, p.y);
      if (d >= bestD) continue;
      if (p.kind === 'weapon') {
        const def = WEAPONS[p.weapon!];
        const same = a.inv.slots[def.slot]?.def === p.weapon;
        const total = (p.mag ?? 0) + (p.reserve ?? 0);
        bestD = d;
        best = { kind: 'weapon', id: p.id, text: same ? `E — Take ${total} rds (${def.caliber})` : `E — Pick up ${def.name} · ${total} rds`, blocked: same && total === 0 };
      } else {
        const wi = a.inv.slots[a.inv.active];
        if (!wi) continue;
        const def = WEAPONS[wi.def];
        const key = `${a.id}:${def.caliber}`;
        const used = p.taken!.includes(key);
        bestD = d;
        best = { kind: 'crate', id: p.id, text: used ? `Crate: ${def.caliber} already taken` : `E — Take 2 mags (${def.caliber})`, blocked: used };
      }
    }
    return best;
  }

  private updateInteraction(a: Actor, input: InputCommand, dt: number) {
    const it = (input.interact || input.interactPressed) ? this.interactable(a) : null;
    if (it?.kind === 'hostage' && input.interact && a.plateTimer <= 0) {
      if (a.interactTarget !== it.id) { a.interactTarget = it.id; a.interactTimer = 0; }
      a.interactTimer += dt;
      if (a.interactTimer >= RESCUE_TIME) {
        const h = this.hostages.find((x) => x.id === it.id)!;
        h.state = 'following';
        h.follow = a.id;
        a.interactTimer = 0;
        a.interactTarget = -1;
        a.stats.rescues++;
        if (!a.stats.detected && !a.isBot) a.stats.ghostRescues++;
        this.emit({ type: 'hostageFreed', hostage: h.id, by: a.id });
        this.emit({ type: 'notice', text: `Hostage freed in ${h.room} — escort to the entrance`, tone: 'good' });
        this.noise({ x: h.x, y: h.y, radius: 360, team: a.team, sourceId: a.id, kind: 'shout' });
      }
      return;
    }
    a.interactTimer = 0;
    a.interactTarget = -1;
    if (!input.interactPressed || !it || it.blocked) return;
    if (it.kind === 'weapon') this.pickWeapon(a, it.id);
    else if (it.kind === 'crate') this.useCrate(a, it.id);
  }

  private pickWeapon(a: Actor, pid: number) {
    const pi = this.pickups.findIndex((p) => p.id === pid);
    if (pi < 0) return;
    const p = this.pickups[pi];
    const def = WEAPONS[p.weapon!];
    const cur = a.inv.slots[def.slot];
    this.pickups.splice(pi, 1);
    if (cur && cur.def === p.weapon) {
      const total = (p.mag ?? 0) + (p.reserve ?? 0);
      a.inv.reserve[def.caliber] += total;
      this.emit({ type: 'pickup', actor: a.id, kind: 'crate', label: `+${total} ${def.caliber}`, x: a.x, y: a.y });
      return;
    }
    if (cur) {
      // drop current weapon in that slot, keeping its magazine
      this.addPickup({ kind: 'weapon', x: a.x + this.rng.range(-8, 8), y: a.y + this.rng.range(-8, 8), weapon: cur.def, mag: cur.mag, reserve: 0 });
    }
    a.inv.slots[def.slot] = { def: p.weapon!, mag: p.mag ?? 0 };
    a.inv.reserve[def.caliber] += p.reserve ?? 0;
    a.inv.active = def.slot;
    a.reloadTimer = 0;
    a.swapTimer = 0.5 * a.mods.handling;
    a.aim.lock = 0;
    this.emit({ type: 'pickup', actor: a.id, kind: 'weapon', label: `${def.name}  ${p.mag}/${p.reserve}`, x: a.x, y: a.y });
  }

  private useCrate(a: Actor, pid: number) {
    const p = this.pickups.find((x) => x.id === pid);
    const wi = a.inv.slots[a.inv.active];
    if (!p || !wi) return;
    const def = WEAPONS[wi.def];
    const key = `${a.id}:${def.caliber}`;
    if (p.taken!.includes(key)) return;
    p.taken!.push(key);
    const amount = def.magazine * 2;
    a.inv.reserve[def.caliber] += amount;
    this.emit({ type: 'pickup', actor: a.id, kind: 'crate', label: `+${amount} ${def.caliber}`, x: p.x, y: p.y });
  }

  // ------------------------------------------------------------------ pickups & hostages
  private updatePickups(dt: number) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      if (p.vx || p.vy) {
        const [nx, ny] = this.map.moveCircle(p.x, p.y, (p.vx ?? 0) * dt, (p.vy ?? 0) * dt, 6);
        p.x = nx; p.y = ny;
        p.vx = (p.vx ?? 0) * Math.exp(-5 * dt);
        p.vy = (p.vy ?? 0) * Math.exp(-5 * dt);
        if (Math.abs(p.vx) < 2 && Math.abs(p.vy) < 2) p.vx = p.vy = 0;
      }
      if (p.kind === 'coin') {
        for (const a of this.actors) {
          if (!a.alive || a.isBot || a.team !== p.forTeam) continue;
          const d = dist(a.x, a.y, p.x, p.y);
          if (d < 110 && this.time - p.spawnTime > 0.4) {
            // magnet towards the collector
            const k = approach(6, dt);
            p.x = lerp(p.x, a.x, k);
            p.y = lerp(p.y, a.y, k);
          }
          if (d < 24) {
            a.stats.coins += p.value ?? 0;
            this.emit({ type: 'coin', actor: a.id, amount: p.value ?? 0, x: p.x, y: p.y });
            this.pickups.splice(i, 1);
            break;
          }
        }
      } else if (p.kind === 'plate') {
        for (const a of this.actors) {
          if (!a.alive || a.isBot) continue;
          if (dist(a.x, a.y, p.x, p.y) < 30 && a.inv.plates < a.mods.plateCapacity) {
            a.inv.plates++;
            this.emit({ type: 'pickup', actor: a.id, kind: 'plate', label: '+1 Armor plate', x: p.x, y: p.y });
            this.pickups.splice(i, 1);
            break;
          }
        }
      }
    }
  }

  private updateHostages(dt: number) {
    const ex = this.map.layout.extraction;
    for (const h of this.hostages) {
      if (h.state !== 'following') continue;
      const f = this.actor(h.follow);
      if (!f || !f.alive) { h.state = 'captive'; h.follow = -1; continue; }
      const d = dist(h.x, h.y, f.x, f.y);
      h.pathTimer -= dt;
      if (h.pathTimer <= 0) {
        h.pathTimer = 0.4;
        h.path = d > 60 ? this.nav.findPath(h.x, h.y, f.x, f.y) ?? [] : [];
      }
      if (d > 46 && h.path.length) {
        const [px, py] = h.path[0];
        const pd = dist(h.x, h.y, px, py);
        if (pd < 10) h.path.shift();
        else {
          const sp = (d > 160 ? 230 : 175) * dt;
          const [nx, ny] = this.map.moveCircle(h.x, h.y, ((px - h.x) / pd) * sp, ((py - h.y) / pd) * sp, 10);
          h.facing = Math.atan2(ny - h.y, nx - h.x);
          h.x = nx; h.y = ny;
        }
      }
      if (h.x > ex.x * TILE && h.x < (ex.x + ex.w) * TILE && h.y > ex.y * TILE && h.y < (ex.y + ex.h) * TILE) {
        h.state = 'rescued';
        this.match.hostagesRescued++;
        this.emit({ type: 'hostageRescued', hostage: h.id, by: f.id });
        const left = this.match.hostagesTotal - this.match.hostagesRescued;
        this.emit({ type: 'notice', text: left > 0 ? `Hostage extracted — ${left} remaining` : 'All hostages extracted', tone: 'good' });
      }
    }
  }

  // ------------------------------------------------------------------ match rules
  private checkMatchEnd() {
    const m = this.match;
    const aliveAT = this.actors.some((a) => a.alive && a.team === 'AT');
    const aliveG = this.actors.some((a) => a.alive && a.team === 'GUARD');
    let winner: Team | null = null;
    let reason = '';
    if (m.hostagesRescued >= m.hostagesTotal) { winner = 'AT'; reason = 'All hostages rescued'; }
    else if (!aliveG) { winner = 'AT'; reason = 'All hostage guards neutralized'; }
    else if (!aliveAT) { winner = 'GUARD'; reason = 'Strike team eliminated'; }
    else if (m.timeLeft <= 0) { winner = 'GUARD'; reason = 'Time expired'; }
    if (winner) {
      m.phase = 'ended';
      m.winner = winner;
      m.reason = reason;
      this.emit({ type: 'matchEnd', winner, reason });
    }
  }

  /** Teams' summary for the scoreboard. */
  scoreboard() {
    return (['AT', 'GUARD'] as Team[]).map((team) => ({
      team, name: TEAM_NAMES[team],
      members: this.actors.filter((a) => a.team === team).map((a) => ({ id: a.id, name: a.name, alive: a.alive, kills: a.stats.kills, deaths: a.stats.deaths, bot: a.isBot })),
    }));
  }

  enemiesOf(team: Team) {
    return this.actors.filter((a) => a.team === otherTeam(team));
  }
}

export function rayCircle(ox: number, oy: number, dx: number, dy: number, cx: number, cy: number, r: number): number | null {
  const fx = ox - cx, fy = oy - cy;
  const b = fx * dx + fy * dy;
  const c = fx * fx + fy * fy - r * r;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  if (t < 0) return c < 0 ? 0 : null;
  return t;
}
