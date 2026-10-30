import Phaser from 'phaser';
import { WEAPONS, WeaponId } from '../data/weapons';
import { angleDiff, approach, clamp, lerp } from '../core/math';
import type { Actor, Hostage, Pickup } from '../sim/types';
import { MUZZLE, RES } from './textures';

export const DEPTH = {
  ground: 0, decal: 4, pickup: 6, corpse: 8, hostage: 9, actor: 10, fxLow: 20,
  light: 100, fxHigh: 105, walls: 110, fixtures: 111, aim: 120, marker: 121, text: 125,
};
const INV = 1 / RES;

/** Animated top-down operator. Lower body follows movement; upper body follows the firing line. */
export class ActorView {
  readonly root: Phaser.GameObjects.Container;
  private shadow: Phaser.GameObjects.Image;
  private feet: Phaser.GameObjects.Container;
  private footL: Phaser.GameObjects.Image;
  private footR: Phaser.GameObjects.Image;
  private body: Phaser.GameObjects.Container;
  private torso: Phaser.GameObjects.Image;
  private rig: Phaser.GameObjects.Image;
  private head: Phaser.GameObjects.Image;
  private mag: Phaser.GameObjects.Image;
  private lens: Phaser.GameObjects.Image;
  private hiddenFx?: Phaser.GameObjects.Image;
  private indicator: Phaser.GameObjects.Image;
  private allyMark?: Phaser.GameObjects.Image;
  private phase = 0;
  private kick = 0;
  private kickRot = 0;
  private crouch = 0;
  private lensPulse = 0;
  private dead = false;
  private faction: 'AT' | 'GUARD';
  private rigKey = '';
  alpha = 1;
  pool?: Phaser.GameObjects.Image;

  constructor(private scene: Phaser.Scene, a: Actor, private isLocal: boolean, private isAlly: boolean) {
    this.faction = a.team;
    this.root = scene.add.container(a.x, a.y).setDepth(DEPTH.actor + (isLocal ? 1 : 0));
    this.shadow = scene.add.image(0, 0, 'fx_glow').setTint(0x000000).setAlpha(0.45).setScale(0.75, 0.75);
    this.footL = scene.add.image(0, -5, 'boot').setScale(INV);
    this.footR = scene.add.image(0, 5, 'boot').setScale(INV);
    this.feet = scene.add.container(0, 0, [this.footL, this.footR]);
    this.torso = scene.add.image(0, 0, `torso_${a.team}`).setScale(INV);
    this.rig = scene.add.image(0, 0, `rig_${a.team}_pistol`).setScale(INV).setOrigin(20 / 80, 0.5);
    this.head = scene.add.image(1, 0, `head_${a.team}`).setScale(INV);
    this.mag = scene.add.image(0, 0, 'boot').setScale(INV * 0.6).setTint(0x222222).setVisible(false);
    this.body = scene.add.container(0, 0, [this.torso, this.rig, this.mag, this.head]);
    this.root.add([this.shadow, this.feet, this.body]);
    this.lens = scene.add.image(0, 0, 'fx_glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.fxHigh).setScale(0.18).setTint(0xfff1d8);
    this.indicator = scene.add.image(0, 0, 'ind_q').setDepth(DEPTH.marker).setScale(INV * 1.1).setVisible(false);
    if (isLocal) this.hiddenFx = scene.add.image(0, 0, 'fx_hidden').setDepth(DEPTH.fxHigh).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setScale(0.9);
    if (isAlly && !isLocal) this.allyMark = scene.add.image(0, 0, 'fx_dot').setDepth(DEPTH.marker).setTint(0x6fb2e0).setScale(0.35).setAlpha(0.8);
  }

  onShot(w: WeaponId) {
    const def = WEAPONS[w];
    this.kick = Math.min(1, this.kick + clamp(def.recoilKick * 9, 0.35, 1));
    this.kickRot = (Math.random() - 0.5) * def.recoilKick * 1.6;
  }
  onLight(on: boolean) {
    if (on) this.lensPulse = 1;
  }

  muzzleWorld(a: Actor): [number, number] {
    const wi = a.inv.slots[a.inv.active];
    const [mx, my] = MUZZLE[wi?.def ?? 'pistol'];
    const ang = this.body.rotation;
    return [a.x + Math.cos(ang) * mx - Math.sin(ang) * my, a.y + Math.sin(ang) * mx + Math.cos(ang) * my];
  }

  update(a: Actor, dt: number, visible: boolean, indicator: 'none' | 'q' | 'ex') {
    this.root.setPosition(a.x, a.y);
    this.alpha = lerp(this.alpha, visible ? 1 : 0, approach(visible ? 14 : 6, dt));
    this.root.setAlpha(this.dead ? Math.min(this.alpha, 1) : this.alpha);
    if (this.dead) {
      this.lens.setVisible(false);
      this.indicator.setVisible(false);
      this.allyMark?.setVisible(false);
      this.hiddenFx?.setAlpha(0);
      return;
    }
    const wi = a.inv.slots[a.inv.active];
    const w = wi?.def ?? 'pistol';
    const key = a.plateTimer > 0 ? `rig_${this.faction}_plate` : `rig_${this.faction}_${w}`;
    if (key !== this.rigKey) { this.rig.setTexture(key); this.rigKey = key; }

    // --- locomotion
    const sp = a.speed;
    const k = clamp(sp / 160, 0, 1.5);
    this.phase += (sp * dt) / 24;
    const stride = sp > 200 ? 9 : 6.5;
    const sw = Math.sin(this.phase);
    this.feet.setRotation(a.moveAngle);
    this.footL.setPosition(sw * stride * k, -5);
    this.footR.setPosition(-sw * stride * k, 5);
    this.feet.setVisible(this.crouch < 0.5);

    const bodyAng = a.aim.angle + a.aim.recoil * 0.6;
    const bob = 1 + Math.abs(sw) * 0.018 * k;
    this.crouch = lerp(this.crouch, a.hidden ? 1 : 0, approach(8, dt));
    const sc = bob * (1 - 0.09 * this.crouch);
    this.body.setScale(sc).setRotation(bodyAng + sw * 0.035 * k);
    const lean = sp > 200 ? 1.5 : 0;
    this.body.setPosition(Math.cos(a.moveAngle) * lean, Math.sin(a.moveAngle) * lean);
    this.shadow.setScale(0.72 + this.crouch * 0.06);

    // --- weapon animation
    this.kick = Math.max(0, this.kick - dt * 7);
    this.kickRot *= Math.exp(-dt * 10);
    let rx = -this.kick * (w === 'deagle' ? 7 : w === 'pistol' ? 4.5 : 3.2);
    let rr = this.kickRot;
    let ry = 0;
    this.mag.setVisible(false);
    if (a.reloadTimer > 0 && a.reloadTotal > 0) {
      const p = 1 - a.reloadTimer / a.reloadTotal;
      const s = Math.sin(p * Math.PI);
      rr += s * 0.45;
      rx -= s * 3;
      ry += s * 2;
      // magazine out then in
      const grip = w === 'mp5' || w === 'm4' ? 18 : 15;
      if (p < 0.35) { this.mag.setVisible(true).setPosition(grip - 2, 8 + p * 30).setAlpha(1 - p / 0.35); }
      else if (p > 0.45 && p < 0.7) { const q = (p - 0.45) / 0.25; this.mag.setVisible(true).setPosition(grip - 2, 16 - q * 10).setAlpha(1); }
    }
    if (a.swapTimer > 0) { const s = clamp(a.swapTimer / 0.45, 0, 1); rr += s * 0.8; rx -= s * 5; }
    if (a.plateTimer > 0) { const p = 1 - a.plateTimer / Math.max(0.01, a.plateTotal); rx = Math.sin(p * Math.PI * 3) * 1.2; rr = 0; }
    this.rig.setPosition(rx, ry).setRotation(rr);

    // --- tints: damage flash, stealth darkening
    const hurt = a.hurtTimer > 0;
    const tint = hurt ? 0xff8a7a : a.hidden ? 0x8a96a8 : 0xffffff;
    this.torso.setTint(tint); this.rig.setTint(tint); this.head.setTint(tint);
    if (hurt) this.root.x += (Math.random() - 0.5) * 2;

    // --- flashlight lens
    this.lensPulse = Math.max(0, this.lensPulse - dt * 3);
    if (a.flashlight) {
      const [mx, my] = this.muzzleWorld(a);
      this.lens.setVisible(true).setPosition(mx, my).setAlpha((0.55 + this.lensPulse * 0.45) * this.alpha).setScale(0.16 + this.lensPulse * 0.25);
    } else this.lens.setVisible(false);

    if (this.hiddenFx) {
      this.hiddenFx.setPosition(a.x, a.y).setAlpha(a.hidden ? 0.8 : a.hideTimer > 0 ? a.hideTimer * 0.35 : 0);
    }
    if (indicator !== 'none' && this.alpha > 0.4) {
      this.indicator.setVisible(true).setTexture(indicator === 'q' ? 'ind_q' : 'ind_ex').setPosition(a.x, a.y - 28).setAlpha(this.alpha);
    } else this.indicator.setVisible(false);
    this.allyMark?.setPosition(a.x, a.y - 22).setVisible(true);
  }

  die(a: Actor) {
    if (this.dead) return;
    this.dead = true;
    this.root.setDepth(DEPTH.corpse);
    const spin = (Math.random() - 0.5) * 1.6;
    this.rig.setVisible(false);
    this.feet.setVisible(false);
    this.pool = this.scene.add.image(a.x, a.y, 'fx_pool').setDepth(DEPTH.decal).setScale(0.05).setAlpha(0.9).setRotation(Math.random() * 6);
    this.scene.tweens.add({ targets: this.pool, scale: 0.55 + Math.random() * 0.2, duration: 4000, ease: 'Sine.easeOut' });
    this.scene.tweens.add({
      targets: this.body, rotation: this.body.rotation + spin, scale: 1.06, x: Math.cos(this.body.rotation + Math.PI) * 6, y: Math.sin(this.body.rotation + Math.PI) * 6,
      duration: 380, ease: 'Quad.easeOut',
      onComplete: () => {
        this.torso.setTint(0x8c8c8c); this.head.setTint(0x8c8c8c);
      },
    });
    this.scene.tweens.add({ targets: this.shadow, scaleX: 1.0, scaleY: 0.9, alpha: 0.55, duration: 380 });
  }

  destroy() {
    this.root.destroy();
    this.lens.destroy();
    this.indicator.destroy();
    this.hiddenFx?.destroy();
    this.allyMark?.destroy();
    this.pool?.destroy();
  }
}

export class HostageView {
  readonly root: Phaser.GameObjects.Container;
  private sit: Phaser.GameObjects.Image;
  private walk: Phaser.GameObjects.Image;
  private feet: Phaser.GameObjects.Container;
  private fl: Phaser.GameObjects.Image;
  private fr: Phaser.GameObjects.Image;
  private ring: Phaser.GameObjects.Graphics;
  private marker: Phaser.GameObjects.Image;
  private phase = 0;
  private last = { x: 0, y: 0 };
  discovered = false;

  constructor(private scene: Phaser.Scene, h: Hostage) {
    this.root = scene.add.container(h.x, h.y).setDepth(DEPTH.hostage);
    this.sit = scene.add.image(0, 0, `hostage_sit_${h.variant}`).setScale(INV).setOrigin(20 / 44, 0.5);
    this.walk = scene.add.image(0, 0, `hostage_walk_${h.variant}`).setScale(INV).setVisible(false);
    this.fl = scene.add.image(0, -5, 'boot').setScale(INV);
    this.fr = scene.add.image(0, 5, 'boot').setScale(INV);
    this.feet = scene.add.container(0, 0, [this.fl, this.fr]).setVisible(false);
    this.root.add([this.feet, this.sit, this.walk]);
    this.root.setRotation(h.facing);
    this.ring = scene.add.graphics().setDepth(DEPTH.marker);
    this.marker = scene.add.image(h.x, h.y - 26, 'fx_dot').setDepth(DEPTH.marker).setTint(0xf3c25a).setScale(0.5).setVisible(false);
    this.last = { x: h.x, y: h.y };
  }

  update(h: Hostage, dt: number, visible: boolean, rescueProgress: number, perceived: boolean) {
    if (perceived) this.discovered = true;
    const moved = Math.hypot(h.x - this.last.x, h.y - this.last.y);
    this.last = { x: h.x, y: h.y };
    const walking = h.state === 'following';
    this.root.setPosition(h.x, h.y).setVisible(h.state !== 'rescued');
    this.root.setAlpha(lerp(this.root.alpha, visible ? 1 : 0, approach(8, dt)));
    this.sit.setVisible(!walking);
    this.walk.setVisible(walking);
    this.feet.setVisible(walking);
    if (walking) {
      this.root.setRotation(h.facing);
      this.phase += moved / 4;
      this.fl.x = Math.sin(this.phase) * 6;
      this.fr.x = -Math.sin(this.phase) * 6;
    }
    this.ring.clear();
    if (rescueProgress > 0 && h.state === 'captive') {
      this.ring.lineStyle(3, 0x0b0d10, 0.7).strokeCircle(h.x, h.y, 22);
      this.ring.lineStyle(3, 0xf3c25a, 1).beginPath().arc(h.x, h.y, 22, -Math.PI / 2, -Math.PI / 2 + rescueProgress * Math.PI * 2).strokePath();
    }
    const t = this.scene.time.now / 1000;
    this.marker.setVisible(this.discovered && h.state === 'captive').setPosition(h.x, h.y - 26 + Math.sin(t * 3) * 2).setAlpha(0.6 + Math.sin(t * 3) * 0.25);
  }

  destroy() {
    this.root.destroy();
    this.ring.destroy();
    this.marker.destroy();
  }
}

const PICKUP_COLOR: Record<string, number> = { weapon: 0xffcf6e, crate: 0x8fe3a4, plate: 0x8fc8ff, coin: 0xffc34a };

/**
 * Item lying on the floor. Items are drawn above the darkness (slightly dimmed) with a pulsing
 * coloured ring so they can be spotted across a dark room, and show a name label when close.
 */
export class PickupView {
  readonly img: Phaser.GameObjects.Image;
  private glint: Phaser.GameObjects.Image;
  private ring?: Phaser.GameObjects.Image;
  private label?: Phaser.GameObjects.Text;
  private t = Math.random() * 10;
  private baseScale: number;
  private color: number;

  constructor(private scene: Phaser.Scene, readonly p: Pickup) {
    const key = p.kind === 'weapon' ? `wpn_${p.weapon}` : p.kind === 'coin' ? 'pk_coin' : p.kind === 'plate' ? 'pk_plate' : 'pk_crate';
    this.color = PICKUP_COLOR[p.kind];
    this.baseScale = INV * (p.kind === 'weapon' ? 1.3 : p.kind === 'plate' ? 1.2 : 1);
    this.img = scene.add.image(p.x, p.y, key).setDepth(DEPTH.fxHigh - 1).setScale(0).setTint(0xd9d2c6)
      .setRotation(p.kind === 'crate' ? 0 : Math.random() * Math.PI * 2);
    if (p.kind === 'weapon') this.img.setOrigin(24 / 66, 0.5);
    this.glint = scene.add.image(p.x, p.y, 'fx_glow').setDepth(DEPTH.fxHigh - 1.5).setBlendMode(Phaser.BlendModes.ADD)
      .setTint(this.color).setScale(p.kind === 'coin' ? 0.35 : p.kind === 'crate' ? 0.75 : 0.6).setAlpha(0);
    if (p.kind !== 'coin') {
      this.ring = scene.add.image(p.x, p.y, 'fx_ring').setDepth(DEPTH.fxHigh - 1.6).setBlendMode(Phaser.BlendModes.ADD)
        .setTint(this.color).setAlpha(0);
    }
    scene.tweens.add({ targets: this.img, scale: this.baseScale, duration: 220, ease: 'Back.easeOut' });
  }

  private labelText(usedUp: boolean) {
    const p = this.p;
    if (p.kind === 'weapon') return `${WEAPONS[p.weapon!].short} · ${(p.mag ?? 0) + (p.reserve ?? 0)} rds`;
    if (p.kind === 'crate') return usedUp ? 'Ammo crate · empty' : 'Ammo crate';
    if (p.kind === 'plate') return 'Armor plate';
    return '';
  }

  /** @param playerDist distance from the local player, for the name label */
  update(dt: number, usedUp: boolean, playerDist = Infinity) {
    this.t += dt;
    const p = this.p;
    this.img.setPosition(p.x, p.y);
    if (p.kind === 'coin') {
      this.img.scaleX = INV * Math.abs(Math.cos(this.t * 3.2));
      this.img.y = p.y - 2 + Math.sin(this.t * 4) * 1.5;
    }
    if (p.kind === 'crate') this.img.setTint(usedUp ? 0x6a6a6a : 0xd9d2c6);
    const pulse = 0.5 + 0.5 * Math.sin(this.t * (p.kind === 'coin' ? 5 : 2.4));
    const dim = usedUp ? 0.25 : 1;
    this.glint.setPosition(p.x, p.y).setAlpha((p.kind === 'coin' ? 0.45 : 0.28) * (0.5 + pulse * 0.5) * dim);
    if (this.ring) {
      const s = (p.kind === 'crate' ? 0.42 : 0.32) * (1 + pulse * 0.12);
      this.ring.setPosition(p.x, p.y).setScale(s).setAlpha((0.22 + pulse * 0.28) * dim);
    }
    // name label when the player is close
    const text = this.labelText(usedUp);
    const a = text ? 1 - Math.min(1, Math.max(0, (playerDist - 160) / 120)) : 0;
    if (a > 0.01) {
      if (!this.label) {
        this.label = this.scene.add.text(p.x, p.y, text, {
          fontFamily: '"Barlow Condensed", sans-serif', fontSize: '24px', fontStyle: '600',
          color: '#' + this.color.toString(16).padStart(6, '0'), stroke: '#0a0a0d', strokeThickness: 5,
        }).setOrigin(0.5, 1).setDepth(DEPTH.text - 1).setScale(0.5);
      }
      if (this.label.text !== text) this.label.setText(text);
      this.label.setPosition(p.x, p.y - 16).setAlpha(a).setVisible(true);
    } else this.label?.setVisible(false);
  }

  collect(toX: number, toY: number) {
    this.glint.destroy();
    this.ring?.destroy();
    this.label?.destroy();
    this.scene.tweens.add({ targets: this.img, x: toX, y: toY, scale: 0, alpha: 0, duration: 220, ease: 'Quad.easeIn', onComplete: () => this.img.destroy() });
  }

  destroy() {
    this.glint.destroy();
    this.ring?.destroy();
    this.label?.destroy();
    this.img.destroy();
  }
}

/** Firing line, gliding crosshair, lock progress and target brackets. */
export class AimView {
  private g: Phaser.GameObjects.Graphics;
  private pointer: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(DEPTH.aim);
    this.pointer = scene.add.image(0, 0, 'fx_dot').setDepth(DEPTH.aim + 1).setScale(0.45).setAlpha(0.55);
  }

  update(a: Actor | null, pointerX: number, pointerY: number, target: Actor | null, zoom: number) {
    const g = this.g;
    g.clear();
    this.pointer.setPosition(pointerX, pointerY).setVisible(!!a && a.alive);
    if (!a || !a.alive) return;
    const aim = a.aim;
    const wi = a.inv.slots[a.inv.active];
    const def = WEAPONS[wi?.def ?? 'pistol'];
    const lw = 1.4 / zoom;
    const ang = Math.atan2(aim.cy - a.y, aim.cx - a.x);
    const cd = Math.hypot(aim.cx - a.x, aim.cy - a.y);
    const sx = a.x + Math.cos(ang) * 24, sy = a.y + Math.sin(ang) * 24;
    const lock = aim.lock;
    const col = lock > 0.95 ? 0xff5a48 : lock > 0.05 ? lerpColor(0xffffff, 0xffb648, lock) : 0xffffff;
    const busy = a.reloadTimer > 0 || a.plateTimer > 0 || a.swapTimer > 0;
    const baseA = busy ? 0.18 : 0.42;
    // firing line: fades in from the muzzle towards the crosshair
    const segs = 10;
    for (let i = 0; i < segs; i++) {
      const t0 = i / segs, t1 = (i + 0.6) / segs;
      const d0 = 24 + (cd - 34) * t0, d1 = 24 + (cd - 34) * t1;
      if (d1 <= 24) continue;
      g.lineStyle(lw, col, baseA * (0.25 + 0.75 * t0));
      g.lineBetween(a.x + Math.cos(ang) * d0, a.y + Math.sin(ang) * d0, a.x + Math.cos(ang) * d1, a.y + Math.sin(ang) * d1);
    }
    void sx; void sy;
    // continuation to the obstacle along the line
    const endD = aim.lineEnd;
    for (let d = cd + 14; d < endD; d += 14) {
      g.fillStyle(0xffffff, 0.12);
      g.fillCircle(a.x + Math.cos(aim.angle) * d, a.y + Math.sin(aim.angle) * d, 0.9 / zoom + 0.4);
    }
    if (endD < def.range - 2) {
      g.lineStyle(lw, 0xffffff, 0.25);
      const ex = a.x + Math.cos(aim.angle) * endD, ey = a.y + Math.sin(aim.angle) * endD;
      g.lineBetween(ex - Math.sin(aim.angle) * 5, ey + Math.cos(aim.angle) * 5, ex + Math.sin(aim.angle) * 5, ey - Math.cos(aim.angle) * 5);
    }
    // crosshair: ring sized by current spread
    const moveF = clamp(a.speed / 160, 0, 1.4);
    const spread = def.spread * (1 - 0.55 * lock) + moveF * def.moveSpread + aim.bloom;
    const r = clamp(Math.tan(spread) * cd, 5, 46);
    const cx = aim.cx, cy = aim.cy;
    g.lineStyle(lw * 1.2, 0x000000, 0.35 * (busy ? 0.5 : 1)).strokeCircle(cx, cy, r + 1);
    g.lineStyle(lw, col, busy ? 0.35 : 0.9).strokeCircle(cx, cy, r);
    for (let i = 0; i < 4; i++) {
      const t = aim.angle + (i * Math.PI) / 2;
      g.lineBetween(cx + Math.cos(t) * (r + 2), cy + Math.sin(t) * (r + 2), cx + Math.cos(t) * (r + 6), cy + Math.sin(t) * (r + 6));
    }
    g.fillStyle(col, busy ? 0.4 : 1).fillCircle(cx, cy, 1.4 / zoom + 0.6);
    if (lock > 0.02) {
      g.lineStyle(lw * 2.2, col, 0.95).beginPath().arc(cx, cy, r + 4.5, -Math.PI / 2, -Math.PI / 2 + lock * Math.PI * 2).strokePath();
    }
    // target brackets
    if (target && lock > 0.02) {
      const s = 17 + (1 - lock) * 8;
      const bl = 5;
      g.lineStyle(lw * 1.3, col, 0.4 + lock * 0.6);
      for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const x = target.x + dx * s, y = target.y + dy * s;
        g.lineBetween(x, y, x - dx * bl, y);
        g.lineBetween(x, y, x, y - dy * bl);
      }
    }
    // reload progress around the player
    if (a.reloadTimer > 0 && a.reloadTotal > 0) {
      const p = 1 - a.reloadTimer / a.reloadTotal;
      g.lineStyle(2.4 / zoom + 0.6, 0x9ad0ff, 0.85).beginPath().arc(a.x, a.y, 26, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2).strokePath();
    }
    if (a.plateTimer > 0 && a.plateTotal > 0) {
      const p = 1 - a.plateTimer / a.plateTotal;
      g.lineStyle(2.4 / zoom + 0.6, 0x8fe3a4, 0.9).beginPath().arc(a.x, a.y, 26, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2).strokePath();
    }
  }

  destroy() {
    this.g.destroy();
    this.pointer.destroy();
  }
}

function lerpColor(a: number, b: number, t: number) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return ((ar + (br - ar) * t) << 16) | ((ag + (bg - ag) * t) << 8) | (ab + (bb - ab) * t);
}

export { angleDiff };
