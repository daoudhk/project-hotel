import { angleDiff, clamp, dist } from '../../core/math';
import { WEAPONS } from '../../data/weapons';
import { TILE } from '../mapTypes';
import { Actor, emptyInput, InputCommand } from '../types';
import type { World } from '../world';

export type BotState = 'patrol' | 'guard' | 'assault' | 'investigate' | 'attack' | 'cover' | 'search' | 'rescue' | 'escort';
type Role = 'patrol' | 'guard' | 'assault';

interface Known { id: number; x: number; y: number; seenAt: number; visible: boolean }

const EFFECTIVE_RANGE: Record<string, number> = { pistol: 420, mp5: 340, m4: 650, deagle: 520 };

/**
 * Bot controller. Perceives the world through the same rules a player is subject to
 * (sight, light, sound) and produces an InputCommand each tick, exactly like a human client.
 */
export class BotBrain {
  state: BotState = 'patrol';
  role: Role = 'patrol';
  private route = 0;
  private wp = 0;
  private post = { x: 0, y: 0 };
  private guardHostage = -1;
  private assaultIndex = 0;
  private assaultTargets: { x: number; y: number }[] = [];

  private path: [number, number][] = [];
  private pathGoal = { x: 0, y: 0 };
  private repath = 0;
  private stuckTimer = 0;
  private lastPos = { x: 0, y: 0 };

  private detection = new Map<number, number>();
  private suspicionAnnounced = new Set<number>();
  target: Known | null = null;
  private investigate = { x: 0, y: 0 };
  private searchPts: { x: number; y: number }[] = [];
  private seenCorpses = new Set<number>();

  private think = 0;
  private reaction = 0;
  private burst = 0;
  private burstPause = 0;
  private lookAngle = 0;
  private lookTimer = 0;
  private waitTimer = 0;
  private stateTimer = 0;
  private alertness = 0;
  private cover = { x: 0, y: 0 };
  private coverCooldown = 0;
  private strafe = 1;
  private strafeTimer = 0;
  private rescueHostage = -1;

  constructor(readonly actorId: number, private w: World) {}

  get me(): Actor {
    return this.w.actor(this.actorId)!;
  }

  setPatrol(route: number, wp: number) {
    this.role = 'patrol';
    this.state = 'patrol';
    this.route = route;
    this.wp = wp;
  }
  setGuard(x: number, y: number, hostageId: number) {
    this.role = 'guard';
    this.state = 'guard';
    this.post = { x, y };
    this.guardHostage = hostageId;
  }
  setAssault(index: number) {
    this.role = 'assault';
    this.state = 'assault';
    this.assaultIndex = index;
    const spots = this.w.map.layout.hostageSpots.map((s) => {
      const [x, y] = this.w.map.nearestWalkable(s.x * TILE, s.y * TILE);
      return { x, y };
    });
    // each bot sweeps the hotel in a different order
    const rng = this.w.rng;
    this.assaultTargets = rng.shuffle(spots).slice(0);
  }

  detectionOf(id: number) {
    return this.detection.get(id) ?? 0;
  }

  onDamaged(src: Actor | null) {
    if (!src) return;
    this.detection.set(src.id, Math.max(this.detectionOf(src.id), 0.9));
    this.alertness = 1;
    if (this.state !== 'attack') {
      this.target = { id: src.id, x: src.x, y: src.y, seenAt: this.w.time, visible: false };
      this.lookAngle = Math.atan2(src.y - this.me.y, src.x - this.me.x);
      this.enter('attack');
      this.reaction = Math.max(this.reaction, this.w.diff.reaction * 0.6);
    }
  }

  private enter(s: BotState) {
    if (this.state === s) return;
    this.state = s;
    this.stateTimer = 0;
    this.path = [];
    this.waitTimer = 0;
  }

  private roleState(): BotState {
    return this.role === 'guard' ? 'guard' : this.role === 'assault' ? 'assault' : 'patrol';
  }

  // --------------------------------------------------------------- perception
  private perceive(dt: number) {
    const me = this.me;
    const w = this.w;
    const rate = w.diff.detectRate * (1 + this.alertness * 0.6);
    let bestId = -1, best = 0;
    for (const o of w.actors) {
      if (!o.alive || o.team === me.team) { this.detection.delete(o.id); continue; }
      const v = w.visibility(me, o);
      let m = this.detectionOf(o.id);
      if (v > 0.02) m += v * rate * dt;
      else m -= 0.35 * dt;
      m = clamp(m, 0, 1.6);
      this.detection.set(o.id, m);
      if (this.target?.id === o.id) {
        const keep = this.target && m >= 1 && v > (o.hidden ? 0.1 : 0.03);
        if (keep) {
          this.target.x = o.x; this.target.y = o.y; this.target.seenAt = w.time; this.target.visible = true;
        } else this.target.visible = false;
      }
      if (m > best) { best = m; bestId = o.id; }
      if (m >= 0.35 && m < 1 && !this.suspicionAnnounced.has(o.id) && this.state !== 'attack') {
        this.suspicionAnnounced.add(o.id);
        if (!o.isBot) w.emit({ type: 'suspicious', bot: me.id, target: o.id });
        this.investigate = { x: o.x + w.rng.range(-40, 40), y: o.y + w.rng.range(-40, 40) };
        this.lookAngle = Math.atan2(o.y - me.y, o.x - me.x);
        if (this.state !== 'rescue' && this.state !== 'escort') this.enter('investigate');
      }
    }
    if (bestId >= 0 && best >= 1) {
      const o = w.actor(bestId)!;
      if (!this.target || this.target.id !== bestId || !this.target.visible) {
        const firstContact = this.state !== 'attack';
        this.target = { id: o.id, x: o.x, y: o.y, seenAt: w.time, visible: true };
        if (firstContact) {
          this.reaction = w.diff.reaction * (0.8 + w.rng.next() * 0.5);
          if (!o.isBot) { w.emit({ type: 'alert', bot: me.id, target: o.id }); o.stats.detected = true; }
          // call it out to nearby teammates
          w.noise({ x: me.x, y: me.y, radius: 420, team: me.team, sourceId: me.id, kind: 'shout' });
        }
        this.alertness = 1;
        this.enter('attack');
      }
    }

    // hearing
    for (const n of w.noises) {
      if (n.sourceId === me.id) continue;
      const d = dist(me.x, me.y, n.x, n.y);
      const r = n.radius * w.diff.hearing;
      if (d > r) continue;
      const enemy = n.team !== me.team;
      if (this.state === 'attack' && this.target?.visible) continue;
      if (n.kind === 'shout' && !enemy) {
        // teammate callout: converge on the area if idle
        if (this.state === 'patrol' || this.state === 'guard' && d < 300 || this.state === 'assault') {
          const src = w.actor(n.sourceId);
          const t = src && this.w.brains.get(src.id)?.target;
          if (t) { this.investigate = { x: t.x, y: t.y }; this.enter('investigate'); }
        }
        continue;
      }
      if (!enemy && n.kind !== 'gunshot') continue;
      if (n.kind === 'footstep' && this.state !== 'patrol' && this.state !== 'guard' && this.state !== 'search' && this.state !== 'assault') continue;
      const err = (d / r) * 90;
      this.investigate = { x: n.x + w.rng.range(-err, err), y: n.y + w.rng.range(-err, err) };
      if (enemy) this.detection.set(n.sourceId, Math.max(this.detectionOf(n.sourceId), n.kind === 'gunshot' ? 0.5 : 0.25));
      this.alertness = Math.max(this.alertness, n.kind === 'gunshot' ? 1 : 0.5);
      this.lookAngle = Math.atan2(n.y - me.y, n.x - me.x);
      if (this.state === 'attack') {
        if (this.target && !this.target.visible && enemy) { this.target.x = this.investigate.x; this.target.y = this.investigate.y; }
      } else if (this.state !== 'rescue' && this.state !== 'escort') this.enter('investigate');
    }

    // dead teammates
    for (const c of w.corpses) {
      if (c.team !== me.team || this.seenCorpses.has(c.id)) continue;
      const d = dist(me.x, me.y, c.x, c.y);
      if (d > 500) continue;
      const da = Math.abs(angleDiff(me.aim.angle, Math.atan2(c.y - me.y, c.x - me.x)));
      if (da > 1.1 || !w.map.lineClear(me.x, me.y, c.x, c.y)) continue;
      this.seenCorpses.add(c.id);
      this.alertness = 1;
      if (this.state !== 'attack') {
        this.investigate = { x: c.x, y: c.y };
        this.enter('investigate');
      }
    }
  }

  // --------------------------------------------------------------- movement helpers
  private moveTo(x: number, y: number, input: InputCommand, run = false, dt = 0): boolean {
    const me = this.me;
    if (dist(me.x, me.y, x, y) < 18) return true;
    this.repath -= dt;
    if (!this.path.length || this.repath <= 0 || dist(this.pathGoal.x, this.pathGoal.y, x, y) > 40) {
      this.path = this.w.nav.findPath(me.x, me.y, x, y) ?? [];
      this.pathGoal = { x, y };
      this.repath = 1.5 + this.w.rng.next();
    }
    while (this.path.length && dist(me.x, me.y, this.path[0][0], this.path[0][1]) < 16) this.path.shift();
    if (!this.path.length) return dist(me.x, me.y, x, y) < 40;
    const [px, py] = this.path[0];
    const d = dist(me.x, me.y, px, py);
    input.moveX = (px - me.x) / d;
    input.moveY = (py - me.y) / d;
    input.run = run;
    // stuck detection
    this.stuckTimer += dt;
    if (this.stuckTimer > 0.8) {
      if (dist(this.lastPos.x, this.lastPos.y, me.x, me.y) < 10) { this.path = []; this.repath = 0; input.moveX += this.w.rng.range(-1, 1); input.moveY += this.w.rng.range(-1, 1); }
      this.lastPos = { x: me.x, y: me.y };
      this.stuckTimer = 0;
    }
    return false;
  }

  private lookAround(dt: number, input: InputCommand, range = 1.4) {
    this.lookTimer -= dt;
    if (this.lookTimer <= 0) {
      this.lookTimer = 1.2 + this.w.rng.next() * 1.8;
      this.lookAngle += this.w.rng.range(-range, range);
    }
    input.aimAngle = this.lookAngle;
  }

  private findCover(fromX: number, fromY: number): { x: number; y: number } | null {
    const me = this.me;
    const map = this.w.map;
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (let r = 70; r <= 250; r += 60)
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + r;
        const x = me.x + Math.cos(a) * r, y = me.y + Math.sin(a) * r;
        const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
        if (!map.isWalkable(tx, ty)) continue;
        if (map.lineClear(x, y, fromX, fromY)) continue;
        if (map.enclosureAt(x, y) < 2) continue;
        const d = r + dist(x, y, fromX, fromY) * 0.15;
        if (d < bestD) { bestD = d; best = { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE }; }
      }
    return best;
  }

  // --------------------------------------------------------------- main update
  update(dt: number): InputCommand {
    const me = this.me;
    const w = this.w;
    const input = emptyInput();
    input.aimAngle = me.aim.angle;
    input.aimDist = 220;
    this.stateTimer += dt;
    this.alertness = Math.max(0, this.alertness - dt / 30);
    this.coverCooldown -= dt;

    this.think -= dt;
    if (this.think <= 0) {
      this.perceive(0.1 + Math.max(0, -this.think));
      this.think = 0.1;
    }

    const wi = me.inv.slots[me.inv.active];
    const def = wi ? WEAPONS[wi.def] : null;
    // swap to a loaded weapon if empty
    if (wi && def && wi.mag === 0 && me.inv.reserve[def.caliber] === 0) {
      const other = me.inv.slots[me.inv.active === 0 ? 1 : 0];
      if (other && (other.mag > 0 || me.inv.reserve[WEAPONS[other.def].caliber] > 0)) input.switchSlot = me.inv.active === 0 ? 1 : 0;
    }
    // tactical reload when not engaged
    if (wi && def && this.state !== 'attack' && wi.mag < def.magazine * 0.5 && me.inv.reserve[def.caliber] > 0) input.reload = true;

    switch (this.state) {
      case 'patrol': {
        const route = w.map.layout.patrolRoutes[this.route];
        const [tx, ty] = w.map.nearestWalkable(route[this.wp][0] * TILE, route[this.wp][1] * TILE);
        if (this.waitTimer > 0) {
          this.waitTimer -= dt;
          this.lookAround(dt, input, 1.2);
          if (this.waitTimer <= 0) this.wp = (this.wp + 1) % route.length;
        } else if (this.moveTo(tx, ty, input, false, dt)) {
          this.waitTimer = 0.8 + w.rng.next() * 1.6;
          this.lookAngle = me.aim.angle;
        } else {
          input.aimAngle = Math.atan2(input.moveY, input.moveX);
          this.lookAngle = input.aimAngle;
        }
        break;
      }
      case 'guard': {
        const h = w.hostages.find((x) => x.id === this.guardHostage);
        if (h && h.state === 'following') {
          // hostage is being taken: chase it
          this.investigate = { x: h.x, y: h.y };
          this.alertness = 1;
          this.enter('investigate');
          break;
        }
        if (this.waitTimer > 0) {
          this.waitTimer -= dt;
          this.lookAround(dt, input, 1.6);
        } else {
          const a = w.rng.range(-Math.PI, Math.PI), r = w.rng.range(30, 110);
          const [gx, gy] = w.map.nearestWalkable(this.post.x + Math.cos(a) * r, this.post.y + Math.sin(a) * r);
          this.investigate = { x: gx, y: gy };
          this.waitTimer = 2 + w.rng.next() * 3;
        }
        if (this.waitTimer > 0 && dist(me.x, me.y, this.investigate.x, this.investigate.y) > 20 && this.waitTimer > 1.5) {
          this.moveTo(this.investigate.x, this.investigate.y, input, false, dt);
          if (input.moveX || input.moveY) input.aimAngle = Math.atan2(input.moveY, input.moveX);
        }
        break;
      }
      case 'assault': {
        const t = this.assaultTargets[0];
        if (!t) { this.enter('search'); break; }
        // spot captive hostages along the way
        const hv = w.hostages.find((h) => h.state === 'captive' && dist(me.x, me.y, h.x, h.y) < 320 && w.map.lineClear(me.x, me.y, h.x, h.y));
        if (hv) { this.rescueHostage = hv.id; this.enter('rescue'); break; }
        if (this.moveTo(t.x, t.y, input, false, dt)) this.assaultTargets.shift();
        else input.aimAngle = Math.atan2(input.moveY, input.moveX);
        break;
      }
      case 'rescue': {
        const h = w.hostages.find((x) => x.id === this.rescueHostage);
        if (!h || h.state !== 'captive') {
          if (h && h.state === 'following' && h.follow === me.id) this.enter('escort');
          else this.enter(this.roleState());
          break;
        }
        if (this.moveTo(h.x, h.y, input, false, dt) || dist(me.x, me.y, h.x, h.y) < 40) {
          input.moveX = input.moveY = 0;
          input.interact = true;
          this.lookAround(dt, input, 1);
        }
        break;
      }
      case 'escort': {
        const ex = w.map.layout.extraction;
        const tx = (ex.x + ex.w / 2) * TILE, ty = (ex.y + ex.h / 2) * TILE;
        if (!w.hostages.some((h) => h.follow === me.id && h.state === 'following')) { this.enter('assault'); break; }
        const h = w.hostages.find((x) => x.follow === me.id)!;
        if (dist(me.x, me.y, h.x, h.y) > 150) { input.aimAngle = Math.atan2(h.y - me.y, h.x - me.x); break; }
        this.moveTo(tx, ty, input, false, dt);
        input.aimAngle = Math.atan2(input.moveY, input.moveX) || me.aim.angle;
        break;
      }
      case 'investigate': {
        const arrived = this.moveTo(this.investigate.x, this.investigate.y, input, this.alertness > 0.6, dt);
        if (input.moveX || input.moveY) input.aimAngle = Math.atan2(input.moveY, input.moveX);
        else input.aimAngle = this.lookAngle;
        if (arrived || this.stateTimer > 12) {
          this.makeSearch(this.investigate.x, this.investigate.y);
          this.enter('search');
        }
        break;
      }
      case 'search': {
        const p = this.searchPts[0];
        if (!p || this.stateTimer > 18) {
          this.enter(this.roleState());
          this.suspicionAnnounced.clear();
          break;
        }
        if (this.waitTimer > 0) {
          this.waitTimer -= dt;
          this.lookAround(dt, input, 2.2);
          if (this.waitTimer <= 0) this.searchPts.shift();
        } else if (this.moveTo(p.x, p.y, input, false, dt)) {
          this.waitTimer = 1 + w.rng.next() * 1.2;
          this.lookAngle = me.aim.angle;
        } else if (input.moveX || input.moveY) input.aimAngle = Math.atan2(input.moveY, input.moveX);
        break;
      }
      case 'attack':
        this.attack(dt, input);
        break;
      case 'cover': {
        const t = this.target;
        const arrived = this.moveTo(this.cover.x, this.cover.y, input, true, dt);
        if (t) input.aimAngle = Math.atan2(t.y - me.y, t.x - me.x);
        if (wi && def && wi.mag < def.magazine && me.inv.reserve[def.caliber] > 0) input.reload = true;
        if ((arrived && this.stateTimer > 1.6 && me.reloadTimer <= 0) || this.stateTimer > 4.5) {
          this.coverCooldown = 5;
          this.enter('attack');
        }
        if (t?.visible && this.stateTimer > 0.6 && wi && wi.mag > 0 && me.reloadTimer <= 0) this.shootAt(t, dt, input);
        break;
      }
    }
    input.aimDist = 200;
    return input;
  }

  private makeSearch(x: number, y: number) {
    const w = this.w;
    this.searchPts = [];
    for (let i = 0; i < 4; i++) {
      const a = w.rng.range(-Math.PI, Math.PI), r = w.rng.range(60, 260);
      const [px, py] = w.map.nearestWalkable(x + Math.cos(a) * r, y + Math.sin(a) * r);
      if (w.map.lineClear(x, y, px, py) || i === 0) this.searchPts.push({ x: px, y: py });
    }
  }

  private attack(dt: number, input: InputCommand) {
    const me = this.me;
    const w = this.w;
    const t = this.target;
    const tgt = t ? w.actor(t.id) : undefined;
    if (!t || !tgt || !tgt.alive) {
      this.target = null;
      this.makeSearch(me.x, me.y);
      this.enter('search');
      return;
    }
    const wi = me.inv.slots[me.inv.active];
    const def = wi ? WEAPONS[wi.def] : null;
    const d = dist(me.x, me.y, t.x, t.y);
    const ang = Math.atan2(t.y - me.y, t.x - me.x);
    input.aimAngle = ang;

    if (t.visible) {
      this.reaction -= dt;
      // positioning
      const eff = EFFECTIVE_RANGE[wi?.def ?? 'pistol'];
      if (d > eff) this.moveTo(t.x, t.y, input, true, dt);
      else if (d < 120) { input.moveX = -Math.cos(ang); input.moveY = -Math.sin(ang); }
      else {
        this.strafeTimer -= dt;
        if (this.strafeTimer <= 0) { this.strafe = w.rng.chance(0.5) ? 1 : -1; this.strafeTimer = 0.7 + w.rng.next() * 1.2; }
        const sx = Math.cos(ang + Math.PI / 2) * this.strafe, sy = Math.sin(ang + Math.PI / 2) * this.strafe;
        const tx = Math.floor((me.x + sx * 30) / TILE), ty = Math.floor((me.y + sy * 30) / TILE);
        if (w.map.isWalkable(tx, ty)) { input.moveX = sx * 0.55; input.moveY = sy * 0.55; } else this.strafe *= -1;
      }
      // take cover when hurt or dry
      const needsReload = wi && def && wi.mag === 0;
      if ((me.health < 45 || needsReload) && this.coverCooldown <= 0) {
        const c = this.findCover(t.x, t.y);
        if (c) { this.cover = c; this.coverCooldown = 3; this.enter('cover'); return; }
      }
      if (needsReload && def && me.inv.reserve[def.caliber] > 0) input.reload = true;
      if (this.reaction <= 0) this.shootAt(t, dt, input);
    } else {
      // lost sight: push to last known position, then search
      const since = w.time - t.seenAt;
      if (since > 0.5) {
        const arrived = this.moveTo(t.x, t.y, input, true, dt);
        if (input.moveX || input.moveY) input.aimAngle = since > 2 ? Math.atan2(input.moveY, input.moveX) : ang;
        if (arrived || since > 8) {
          this.makeSearch(t.x, t.y);
          this.enter('search');
        }
      }
    }
  }

  private shootAt(t: Known, dt: number, input: InputCommand) {
    const me = this.me;
    const wi = me.inv.slots[me.inv.active];
    if (!wi) return;
    const def = WEAPONS[wi.def];
    const ang = Math.atan2(t.y - me.y, t.x - me.x);
    const err = Math.abs(angleDiff(me.aim.angle, ang));
    if (err > 0.16 || !this.w.map.lineClear(me.x, me.y, t.x, t.y)) return;
    if (this.burstPause > 0) { this.burstPause -= dt; return; }
    if (def.automatic) {
      if (this.burst <= 0) this.burst = this.w.rng.int(this.w.diff.burst[0], this.w.diff.burst[1]);
      input.fire = true;
      if (me.fireCooldown <= 0.001 && wi.mag > 0) {
        this.burst--;
        if (this.burst <= 0) this.burstPause = 0.25 + this.w.rng.next() * 0.45;
      }
    } else {
      // semi-auto: tap with a cadence
      if (me.fireCooldown <= 0 && !me.triggerHeld) {
        input.fire = true;
        this.burstPause = 0.15 + this.w.rng.next() * 0.35 + (def.id === 'deagle' ? 0.35 : 0);
      }
    }
  }
}
