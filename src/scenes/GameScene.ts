import Phaser from 'phaser';
import { approach, clamp, lerp, wrapAngle } from '../core/math';
import { WEAPONS } from '../data/weapons';
import { HotelMap } from '../sim/map';
import { FLASH_HALF, FLASH_RANGE, World } from '../sim/world';
import { Actor, emptyInput, InputCommand, MatchConfig, SimEvent } from '../sim/types';
import { MapRenderer } from '../render/mapRenderer';
import { Lighting, LightSource } from '../render/lighting';
import { Fx } from '../render/fx';
import { ActorView, AimView, DEPTH, HostageView, PickupView } from '../render/views';
import { AudioManager, SoundKey } from '../audio/audio';
import { settings } from '../progression/settings';
import { profile } from '../progression/profile';
import { uiBus } from '../core/emitter';
import type { Hud } from '../ui/hud';

export interface SceneData {
  mode: 'attract' | 'match';
  config?: MatchConfig;
}

const STEP = 1 / 60;
let sharedMap: HotelMap | null = null;

export class GameScene extends Phaser.Scene {
  world!: World;
  private mode: 'attract' | 'match' = 'attract';
  private lighting!: Lighting;
  private fx!: Fx;
  audio!: AudioManager;
  private aimView?: AimView;
  private actorViews = new Map<number, ActorView>();
  private hostageViews = new Map<number, HostageView>();
  private pickupViews = new Map<number, PickupView>();
  private fixtures: Phaser.GameObjects.Image[] = [];
  private localId = -1;
  private acc = 0;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private edges = { reload: false, interact: false, slot: null as 0 | 1 | null, light: false, plate: false };
  private lastAim = 0;
  private lastPointer = { x: 0, y: 0 };
  private flashes: { x: number; y: number; t: number; s: number }[] = [];
  private camCenter = { x: 0, y: 0 };
  private attractT = 0;
  private alertCooldown = new Map<number, number>();
  paused = false;
  private ended = false;
  hud?: Hud;
  private fpsAcc = 0;
  private fpsFrames = 0;
  private unsub: (() => void)[] = [];

  constructor() {
    super('game');
  }

  init(data: SceneData) {
    this.mode = data.mode ?? 'attract';
    const cfg: MatchConfig = data.config ?? { playerTeam: 'AT', difficulty: 'normal', allies: 0, seed: Date.now() % 100000, hostages: 0, timeLimit: 9999, attract: true };
    if (!sharedMap) sharedMap = new HotelMap();
    this.world = new World(cfg, profile.get().skills, sharedMap);
    this.localId = this.world.humanIds[0] ?? -1;
    this.actorViews.clear();
    this.hostageViews.clear();
    this.pickupViews.clear();
    this.fixtures = [];
    this.flashes = [];
    this.acc = 0;
    this.paused = false;
    this.ended = false;
    this.alertCooldown.clear();
  }

  create() {
    const map = this.world.map;
    const mr = new MapRenderer(this, map);
    mr.build(DEPTH.ground, DEPTH.walls);
    for (const f of mr.fixtures) {
      this.fixtures.push(this.add.image(f.x, f.y, 'fx_glow').setDepth(DEPTH.fixtures).setBlendMode(Phaser.BlendModes.ADD).setTint(f.color).setScale(f.scale * 0.5).setAlpha(f.alpha));
    }
    this.lighting = new Lighting(this, map, DEPTH.light, settings.get().lighting);
    this.fx = new Fx(this);
    this.audio = new AudioManager(this);
    this.audio.startAmbience();

    for (const a of this.world.actors) {
      const local = a.id === this.localId;
      const ally = !!this.local() && a.team === this.local()!.team;
      this.actorViews.set(a.id, new ActorView(this, a, local, ally));
    }
    for (const h of this.world.hostages) this.hostageViews.set(h.id, new HostageView(this, h));

    const cam = this.cameras.main;
    cam.setBackgroundColor('#050507');
    cam.setBounds(-200, -200, map.pxW + 400, map.pxH + 400);
    this.applyZoom();
    this.scale.on('resize', this.applyZoom, this);

    const p = this.local();
    if (p) {
      this.camCenter = { x: p.x, y: p.y };
      this.aimView = new AimView(this);
      this.keys = this.input.keyboard!.addKeys('W,A,S,D,SPACE,E,R,ONE,TWO,F,Q,SHIFT,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
      this.input.keyboard!.addCapture('SPACE,TAB,UP,DOWN,LEFT,RIGHT');
      this.input.keyboard!.on('keydown-R', () => (this.edges.reload = true));
      this.input.keyboard!.on('keydown-E', () => (this.edges.interact = true));
      this.input.keyboard!.on('keydown-ONE', () => (this.edges.slot = 0));
      this.input.keyboard!.on('keydown-TWO', () => (this.edges.slot = 1));
      this.input.keyboard!.on('keydown-F', () => (this.edges.light = true));
      this.input.keyboard!.on('keydown-Q', () => (this.edges.plate = true));
      this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
        const a = this.local();
        if (!a) return;
        const other = a.inv.active === 0 ? 1 : 0;
        if (Math.abs(dy) > 0 && a.inv.slots[other]) this.edges.slot = other;
      });
      this.input.setDefaultCursor('none');
    } else {
      this.camCenter = { x: 50 * 32, y: 52 * 32 };
      this.input.setDefaultCursor('default');
    }
    this.cameras.main.centerOn(this.camCenter.x, this.camCenter.y);
    this.unsub.push(settings.onChange((s) => { this.lighting.setQuality(s.lighting); this.audio.refreshVolumes(); }));
    this.events.once('shutdown', () => this.cleanup());
    uiBus.emit('scene-ready', this);
  }

  private cleanup() {
    this.audio.stopAmbience();
    this.lighting.destroy();
    this.scale.off('resize', this.applyZoom, this);
    this.unsub.forEach((u) => u());
    this.unsub = [];
    this.input.setDefaultCursor('default');
  }

  private applyZoom() {
    const h = this.scale.height;
    const w = this.scale.width;
    const zoom = clamp(Math.min(h / 800, w / 1300), 0.7, 2.2);
    this.cameras.main.setZoom(this.mode === 'attract' ? zoom * 0.9 : zoom);
  }

  local(): Actor | undefined {
    return this.localId >= 0 ? this.world.actor(this.localId) : undefined;
  }

  // ------------------------------------------------------------------ input
  private readInput(): InputCommand {
    const inp = emptyInput();
    const a = this.local();
    if (!a || this.paused) return inp;
    const k = this.keys;
    inp.moveX = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    inp.moveY = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    inp.run = k.SHIFT.isDown;
    const ptr = this.input.activePointer;
    const wp = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
    inp.aimAngle = Math.atan2(wp.y - a.y, wp.x - a.x);
    inp.aimDist = Math.hypot(wp.x - a.x, wp.y - a.y);
    const moved = Math.hypot(ptr.x - this.lastPointer.x, ptr.y - this.lastPointer.y);
    inp.aimMoved = Math.abs(wrapAngle(inp.aimAngle - this.lastAim)) > 0.05 || moved > 14;
    if (inp.aimMoved) { this.lastAim = inp.aimAngle; this.lastPointer = { x: ptr.x, y: ptr.y }; }
    inp.fire = k.SPACE.isDown;
    inp.interact = k.E.isDown;
    inp.interactPressed = this.edges.interact;
    inp.reload = this.edges.reload;
    inp.switchSlot = this.edges.slot;
    inp.toggleLight = this.edges.light;
    inp.applyPlate = this.edges.plate;
    return inp;
  }

  // ------------------------------------------------------------------ frame
  perf = { sim: 0, light: 0, views: 0 };

  update(_time: number, deltaMs: number) {
    const dt = Math.min(0.05, deltaMs / 1000);
    const t0 = performance.now();
    if (!this.paused) {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= STEP && steps < 4) {
        const inp = this.readInput();
        this.world.step(STEP, new Map([[this.localId, inp]]));
        this.edges = { reload: false, interact: false, slot: null, light: false, plate: false };
        this.acc -= STEP;
        steps++;
      }
      if (steps === 4) this.acc = 0;
      this.processEvents(this.world.drainEvents());
    }
    const t1 = performance.now();
    this.updateCamera(dt);
    this.syncViews(dt);
    if (!this.paused) this.fx.update(dt);
    const t2 = performance.now();
    this.renderLights(dt);
    const t3 = performance.now();
    const k = 0.1;
    this.perf.sim = lerp(this.perf.sim, t1 - t0, k);
    this.perf.views = lerp(this.perf.views, t2 - t1, k);
    this.perf.light = lerp(this.perf.light, t3 - t2, k);
    this.updateHud(dt);
  }

  private updateCamera(dt: number) {
    const cam = this.cameras.main;
    const a = this.local();
    let tx = this.camCenter.x, ty = this.camCenter.y;
    if (this.mode === 'attract') {
      this.attractT += dt * 0.05;
      tx = 52 * 32 + Math.cos(this.attractT) * 900;
      ty = 34 * 32 + Math.sin(this.attractT * 1.3) * 600;
      this.camCenter.x = lerp(this.camCenter.x, tx, approach(0.6, dt));
      this.camCenter.y = lerp(this.camCenter.y, ty, approach(0.6, dt));
    } else {
      let focus = a;
      if (a && !a.alive) focus = this.world.actors.find((o) => o.alive && o.team === a.team) ?? a;
      if (focus) {
        const look = focus === a ? Math.min(a!.aim.freeDist, 340) * 0.28 : 0;
        tx = focus.x + Math.cos(focus.aim.angle) * look;
        ty = focus.y + Math.sin(focus.aim.angle) * look;
      }
      this.camCenter.x = lerp(this.camCenter.x, tx, approach(7, dt));
      this.camCenter.y = lerp(this.camCenter.y, ty, approach(7, dt));
    }
    cam.centerOn(this.camCenter.x, this.camCenter.y);
    this.audio.setListener(a?.x ?? this.camCenter.x, a?.y ?? this.camCenter.y);
  }

  private syncViews(dt: number) {
    const w = this.world;
    const me = this.local();
    for (const a of w.actors) {
      const v = this.actorViews.get(a.id)!;
      let visible = true;
      if (me && a.team !== me.team) {
        // the player only sees enemies in line of sight
        visible = me.alive ? w.map.lineClear(me.x, me.y, a.x, a.y) : true;
      }
      let ind: 'none' | 'q' | 'ex' = 'none';
      const brain = w.brains.get(a.id);
      if (me && brain && a.team !== me.team && a.alive) {
        const d = brain.detectionOf(me.id);
        if (d >= 1 && brain.state === 'attack') ind = 'ex';
        else if (d >= 0.3 || brain.state === 'investigate' || brain.state === 'search') ind = d >= 0.3 ? 'q' : 'none';
      }
      v.update(a, dt, visible, ind);
    }
    for (const h of w.hostages) {
      const hv = this.hostageViews.get(h.id)!;
      let visible = true;
      if (me && me.alive) visible = w.map.lineClear(me.x, me.y, h.x, h.y) && Math.hypot(me.x - h.x, me.y - h.y) < 900;
      // to count as found the hostage must actually be seen: close by or lit
      const perceived = visible && !!me && (Math.hypot(me.x - h.x, me.y - h.y) < 170 || w.lightAt(h.x, h.y) > 0.35);
      const prog = me && me.interactTarget === h.id ? me.interactTimer / 1.6 : 0;
      if (perceived && !hv.discovered && me && h.state === 'captive' && me.team === 'AT') {
        this.hud?.notice(`Hostage located — ${h.room}`, 'info');
        this.audio.ui('objective', 0.6);
      }
      hv.update(h, dt, visible || h.state === 'following', prog, perceived);
    }
    // pickups
    const live = new Set<number>();
    for (const p of w.pickups) {
      live.add(p.id);
      let pv = this.pickupViews.get(p.id);
      if (!pv) { pv = new PickupView(this, p); this.pickupViews.set(p.id, pv); }
      const used = p.kind === 'crate' && !!me && p.taken!.length > 0 && me.inv.slots.every((s) => !s || p.taken!.includes(`${me.id}:${WEAPONS[s.def].caliber}`));
      pv.update(dt, used, me && me.alive ? Math.hypot(p.x - me.x, p.y - me.y) : Infinity);
    }
    for (const [id, pv] of this.pickupViews) {
      if (live.has(id)) continue;
      if (me && Math.hypot(pv.p.x - me.x, pv.p.y - me.y) < 80) pv.collect(me.x, me.y);
      else pv.destroy();
      this.pickupViews.delete(id);
    }
    // aim
    if (this.aimView) {
      const ptr = this.input.activePointer;
      const wp = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
      const tgt = me && me.aim.lockTarget >= 0 ? w.actor(me.aim.lockTarget) ?? null : null;
      this.aimView.update(me && !this.paused && !this.ended ? me : null, wp.x, wp.y, tgt, this.cameras.main.zoom);
    }
    // fixture flicker
    const t = this.time.now / 1000;
    this.fixtures.forEach((f, i) => f.setAlpha((f.getData('a') ?? (f.setData('a', f.alpha), f.alpha)) * (0.92 + 0.08 * Math.sin(t * (1.3 + (i % 5) * 0.4) + i))));
  }

  private renderLights(dt: number) {
    const lights: LightSource[] = [];
    const me = this.local();
    for (const a of this.world.actors) {
      if (!a.alive) continue;
      if (a.flashlight) {
        const ang = a.aim.angle + a.aim.recoil * 0.6;
        lights.push({ kind: 'cone', x: a.x + Math.cos(ang) * 8, y: a.y + Math.sin(ang) * 8, angle: ang, range: FLASH_RANGE, half: FLASH_HALF, intensity: a.isBot ? 0.92 : 1 });
      }
    }
    if (me && me.alive) lights.push({ kind: 'point', x: me.x, y: me.y, angle: 0, half: Math.PI, range: 90, intensity: me.hidden ? 0.14 : 0.3 });
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.t -= dt;
      if (f.t <= 0) { this.flashes.splice(i, 1); continue; }
      lights.push({ kind: 'point', x: f.x, y: f.y, angle: 0, half: Math.PI, range: 220 * f.s, intensity: 0.9 * (f.t / 0.07) });
    }
    this.lighting.render(this.cameras.main, lights);
  }

  // ------------------------------------------------------------------ events
  private snd(key: SoundKey, x: number, y: number, volume = 1, range = 1300) {
    this.audio.play(key, { x, y, volume, range, detune: (Math.random() - 0.5) * 120 });
  }

  private processEvents(events: SimEvent[]) {
    const w = this.world;
    const me = this.local();
    for (const e of events) {
      switch (e.type) {
        case 'shot': {
          const a = w.actor(e.actor)!;
          const v = this.actorViews.get(e.actor)!;
          const def = WEAPONS[e.weapon];
          v.onShot(e.weapon);
          const [mx, my] = v.muzzleWorld(a);
          if (v.alpha > 0.3 || a.team === me?.team) this.fx.muzzle(mx, my, e.angle, def.flash);
          this.flashes.push({ x: mx, y: my, t: 0.07, s: def.flash });
          this.fx.tracer(mx, my, e.tx, e.ty);
          this.fx.shell(a.x + Math.cos(e.angle) * 10, a.y + Math.sin(e.angle) * 10, e.angle);
          if (e.hit === 'wall' || e.hit === 'furniture') {
            this.fx.impact(e.tx, e.ty, e.nx, e.ny, e.hit);
            this.snd(e.hit === 'wall' ? 'impact_wall' : 'impact_wood', e.tx, e.ty, 0.6, 700);
          }
          this.snd(def.sound as SoundKey, mx, my, a.id === this.localId ? 0.85 : 1, 2200);
          if (a.id === this.localId && settings.get().screenShake) this.cameras.main.shake(70, def.shake);
          break;
        }
        case 'damage': {
          if (e.armor) { this.fx.armorSpark(e.x, e.y); this.snd('impact_armor', e.x, e.y, 0.7, 700); }
          else this.fx.blood(e.x, e.y, e.angle);
          this.snd('impact_flesh', e.x, e.y, 0.7, 700);
          if (e.target === this.localId) {
            this.audio.play('hurt', { volume: 0.8 });
            const src = w.actor(e.source);
            this.hud?.damage(src && me ? Math.atan2(src.y - me.y, src.x - me.x) : null, e.amount);
            if (settings.get().screenShake) this.cameras.main.shake(110, 0.004);
          }
          if (e.source === this.localId) this.hud?.hitMarker(false);
          break;
        }
        case 'death': {
          const a = w.actor(e.actor)!;
          this.actorViews.get(e.actor)?.die(a);
          this.snd('body_fall', a.x, a.y, 0.8, 900);
          const k = w.actor(e.killer);
          this.hud?.killfeed(k?.name ?? '—', a.name, e.weapon ? WEAPONS[e.weapon].short : '', k?.team ?? a.team, a.team, e.killer === this.localId || e.actor === this.localId);
          if (e.killer === this.localId) this.hud?.hitMarker(true);
          if (e.actor === this.localId) this.hud?.notice('You were eliminated', 'bad');
          break;
        }
        case 'reload': {
          const a = w.actor(e.actor)!;
          const d = e.duration * 1000;
          const play = (k: SoundKey, t: number) => this.time.delayedCall(t, () => { if (a.reloadTimer > 0 || k === 'slide_rack') this.snd(k, a.x, a.y, 0.7, 700); });
          play('mag_out', d * 0.08);
          play('mag_in', d * 0.58);
          this.time.delayedCall(d * 0.9, () => { if (a.alive && a.reloadTimer <= 0.2) this.snd('slide_rack', a.x, a.y, 0.7, 700); });
          break;
        }
        case 'dryFire': { const a = w.actor(e.actor)!; this.snd('dry_fire', a.x, a.y, 0.8, 500); if (e.actor === this.localId) this.hud?.notice('Out of ammunition', 'bad'); break; }
        case 'swap': { const a = w.actor(e.actor)!; this.snd('weapon_swap', a.x, a.y, 0.6, 500); break; }
        case 'pickup': {
          if (e.actor === this.localId) {
            this.fx.floatText(e.x, e.y - 14, e.label);
            this.fx.sparkle(e.x, e.y, 0xffe2a8);
            this.audio.play(e.kind === 'weapon' ? 'pickup_weapon' : e.kind === 'plate' ? 'pickup_plate' : 'pickup_ammo', { volume: 0.9 });
          }
          break;
        }
        case 'coin': {
          if (e.actor === this.localId) {
            this.fx.floatText(e.x, e.y - 16, `+${e.amount}`, '#ffd36a', 17);
            this.fx.sparkle(e.x, e.y, 0xffc34a);
            this.fx.ring(e.x, e.y, 0xffc34a, 0.8, 0.4);
            this.audio.play('coin', { volume: 0.8 });
            this.hud?.coinPulse();
          }
          break;
        }
        case 'flashlight': {
          const a = w.actor(e.actor)!;
          this.actorViews.get(e.actor)?.onLight(e.on);
          this.snd('flashlight', a.x, a.y, 0.6, 400);
          break;
        }
        case 'stealth': {
          if (e.actor === this.localId) {
            const a = w.actor(e.actor)!;
            if (e.hidden) { this.fx.ring(a.x, a.y, 0x6f9ad8, 1.2, 0.7); this.audio.ui('suspicious', 0.25); }
            this.hud?.stealth(e.hidden);
          }
          break;
        }
        case 'plateStart': { const a = w.actor(e.actor)!; this.snd('armor', a.x, a.y, 0.8, 500); break; }
        case 'plateDone': {
          const a = w.actor(e.actor)!;
          this.snd('pickup_plate', a.x, a.y, 0.8, 500);
          if (e.actor === this.localId) { this.fx.floatText(a.x, a.y - 22, '+50 ARMOR', '#9ad0ff'); this.fx.ring(a.x, a.y, 0x9ad0ff, 1, 0.5); }
          break;
        }
        case 'alert': {
          if (e.target === this.localId) {
            const last = this.alertCooldown.get(e.bot) ?? -99;
            if (this.time.now / 1000 - last > 8) { this.audio.play('alert', { volume: 0.7 }); this.alertCooldown.set(e.bot, this.time.now / 1000); }
            this.hud?.detected();
          }
          break;
        }
        case 'suspicious': if (e.target === this.localId) this.audio.play('suspicious', { volume: 0.5, throttle: 1500 }); break;
        case 'footstep': {
          const a = w.actor(e.actor)!;
          const tile = w.map.floorAt(a.x, a.y) === 'tile' || w.map.floorAt(a.x, a.y) === 'marble';
          const key = (tile ? `step_tile_${Math.floor(Math.random() * 2)}` : `step_carpet_${Math.floor(Math.random() * 3)}`) as SoundKey;
          const vol = (e.run ? 0.75 : 0.42) * (a.id === this.localId ? 0.55 : 1) * (a.id === this.localId ? a.mods.footstepNoise : 1);
          this.snd(key, a.x, a.y, vol, e.run ? 700 : 450);
          break;
        }
        case 'hostageFreed': { const h = w.hostages.find((x) => x.id === e.hostage)!; this.snd('hostage_free', h.x, h.y, 1, 600); this.audio.ui('objective', 0.7); this.fx.ring(h.x, h.y, 0xf3c25a, 1.3, 0.6); break; }
        case 'hostageRescued': this.audio.ui('objective', 0.9); break;
        case 'notice': this.hud?.notice(e.text, e.tone); break;
        case 'matchEnd': this.onMatchEnd(e.winner, e.reason); break;
      }
    }
  }

  private onMatchEnd(winner: string, reason: string) {
    if (this.ended) return;
    this.ended = true;
    const me = this.local();
    if (!me) return;
    const won = winner === me.team;
    this.audio.ui(won ? 'mission_complete' : 'mission_fail', 0.9);
    this.hud?.banner(won, reason);
    const r = profile.recordMatch({
      won, team: me.team, difficulty: this.world.config.difficulty, kills: me.stats.kills, deaths: me.stats.deaths, shots: me.stats.shots, hits: me.stats.hits,
      coinsCollected: me.stats.coins, rescues: me.stats.rescues, ghostRescues: me.stats.ghostRescues, hiddenSeconds: me.stats.hiddenTime,
      duration: this.world.match.time, weaponKills: me.stats.weaponKills,
    });
    this.time.delayedCall(1600, () => uiBus.emit('match-ended', { won, reason, rewards: r, stats: me.stats, time: this.world.match.time, team: me.team, difficulty: this.world.config.difficulty, scoreboard: this.world.scoreboard() }));
  }

  private updateHud(dt: number) {
    this.fpsAcc += dt;
    this.fpsFrames++;
    if (this.fpsAcc > 0.5) {
      this.hud?.fps(this.fpsFrames / this.fpsAcc, this.perf);
      this.fpsAcc = 0;
      this.fpsFrames = 0;
    }
    if (this.mode !== 'match') return;
    const me = this.local();
    if (me && this.hud) {
      const cam = this.cameras.main;
      const v = cam.worldView;
      this.hud.placeHit((me.aim.cx - v.x) * cam.zoom, (me.aim.cy - v.y) * cam.zoom);
    }
    this.hud?.update(this.world, me, dt);
  }

  setPaused(p: boolean) {
    this.paused = p;
    if (p) this.sound.pauseAll(); else this.sound.resumeAll();
  }
}
