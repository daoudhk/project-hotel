import Phaser from 'phaser';
import { DEPTH } from './views';
import { RES } from './textures';

interface Particle {
  img: Phaser.GameObjects.Image;
  vx: number; vy: number; vr: number;
  life: number; max: number;
  drag: number;
  fade: boolean;
  grow: number;
  baseScale: number;
  active: boolean;
}

/** Pooled particle / decal system. Every effect reuses Images to avoid GC hitches. */
export class Fx {
  private pools = new Map<string, Particle[]>();
  private texts: Phaser.GameObjects.Text[] = [];
  private decals: Phaser.GameObjects.Image[] = [];
  private decalIdx = 0;

  constructor(private scene: Phaser.Scene) {}

  private get(key: string, depth: number, blend = Phaser.BlendModes.NORMAL): Particle {
    let pool = this.pools.get(key + depth + blend);
    if (!pool) { pool = []; this.pools.set(key + depth + blend, pool); }
    let p = pool.find((q) => !q.active);
    if (!p) {
      if (pool.length > 220) p = pool[0];
      else {
        p = { img: this.scene.add.image(0, 0, key).setDepth(depth).setBlendMode(blend), vx: 0, vy: 0, vr: 0, life: 0, max: 1, drag: 0, fade: true, grow: 0, baseScale: 1, active: false };
        pool.push(p);
      }
    }
    p.active = true;
    p.img.setVisible(true).setAlpha(1).setTint(0xffffff);
    return p;
  }

  private spawn(key: string, x: number, y: number, o: { depth?: number; blend?: number; vx?: number; vy?: number; vr?: number; life: number; scale?: number; rot?: number; drag?: number; grow?: number; tint?: number; alpha?: number; fade?: boolean; originX?: number }) {
    const p = this.get(key, o.depth ?? DEPTH.fxHigh, o.blend ?? Phaser.BlendModes.NORMAL);
    p.img.setPosition(x, y).setRotation(o.rot ?? 0).setScale(o.scale ?? 1).setAlpha(o.alpha ?? 1).setOrigin(o.originX ?? 0.5, 0.5);
    if (o.tint !== undefined) p.img.setTint(o.tint);
    p.img.setData('a0', o.alpha ?? 1);
    p.vx = o.vx ?? 0; p.vy = o.vy ?? 0; p.vr = o.vr ?? 0;
    p.life = p.max = o.life;
    p.drag = o.drag ?? 0;
    p.grow = o.grow ?? 0;
    p.baseScale = o.scale ?? 1;
    p.fade = o.fade ?? true;
    return p;
  }

  update(dt: number) {
    for (const pool of this.pools.values())
      for (const p of pool) {
        if (!p.active) continue;
        p.life -= dt;
        if (p.life <= 0) { p.active = false; p.img.setVisible(false); continue; }
        const k = Math.exp(-p.drag * dt);
        p.vx *= k; p.vy *= k;
        p.img.x += p.vx * dt;
        p.img.y += p.vy * dt;
        p.img.rotation += p.vr * dt;
        const t = 1 - p.life / p.max;
        if (p.grow) p.img.setScale(p.baseScale * (1 + p.grow * t));
        if (p.fade) p.img.setAlpha((1 - t) * (p.img.getData('a0') ?? 1));
      }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      if (!t.active) this.texts.splice(i, 1);
    }
  }

  muzzle(x: number, y: number, angle: number, scale: number) {
    this.spawn('fx_flash', x, y, { blend: Phaser.BlendModes.ADD, life: 0.05, scale: 0.42 * scale * (0.85 + Math.random() * 0.3), rot: angle, originX: 2 / 48, fade: true });
    this.spawn('fx_glow', x, y, { blend: Phaser.BlendModes.ADD, life: 0.07, scale: 1.2 * scale, tint: 0xffc070, alpha: 0.5 });
    for (let i = 0; i < 2; i++) {
      this.spawn('fx_smoke', x + Math.cos(angle) * 6, y + Math.sin(angle) * 6, {
        depth: DEPTH.fxLow, life: 0.6 + Math.random() * 0.4, scale: 0.35, grow: 1.6, drag: 3, alpha: 0.5,
        vx: Math.cos(angle) * 60 + (Math.random() - 0.5) * 30, vy: Math.sin(angle) * 60 + (Math.random() - 0.5) * 30, vr: (Math.random() - 0.5) * 2,
      });
    }
  }

  shell(x: number, y: number, angle: number) {
    const a = angle + Math.PI / 2 + (Math.random() - 0.5) * 0.6;
    const sp = 120 + Math.random() * 80;
    this.spawn('fx_shell', x, y, { depth: DEPTH.decal + 1, life: 2.5, scale: 1 / 4 * 1.4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vr: (Math.random() - 0.5) * 30, drag: 6, fade: false });
  }

  tracer(x0: number, y0: number, x1: number, y1: number) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const ang = Math.atan2(y1 - y0, x1 - x0);
    const len = Math.min(110, d);
    const speed = 5200;
    const life = Math.max(0.02, (d - len) / speed + 0.03);
    const p = this.spawn('fx_tracer', x0, y0, { blend: Phaser.BlendModes.ADD, life, rot: ang, originX: 1, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, alpha: 0.85, fade: false });
    p.img.setScale(len / 64, 0.7);
    p.img.x += Math.cos(ang) * len;
    p.img.y += Math.sin(ang) * len;
  }

  impact(x: number, y: number, nx: number, ny: number, kind: 'wall' | 'furniture') {
    const base = Math.atan2(ny, nx);
    const n = kind === 'wall' ? 5 : 4;
    for (let i = 0; i < n; i++) {
      const a = (nx || ny ? base : Math.random() * 6.28) + (Math.random() - 0.5) * 1.6;
      const sp = 140 + Math.random() * 220;
      this.spawn('fx_spark', x, y, { blend: Phaser.BlendModes.ADD, life: 0.12 + Math.random() * 0.15, rot: a, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 8, scale: 0.18 + Math.random() * 0.12 });
    }
    this.spawn('fx_smoke', x, y, { depth: DEPTH.fxLow, life: 0.7, scale: 0.25, grow: 1.4, alpha: kind === 'wall' ? 0.7 : 0.45, vx: nx * 40, vy: ny * 40, drag: 4, tint: kind === 'wall' ? 0xd8d0c4 : 0xa08060 });
  }

  blood(x: number, y: number, angle: number) {
    for (let i = 0; i < 3; i++) {
      const a = angle + (Math.random() - 0.5) * 0.9;
      const sp = 60 + Math.random() * 120;
      this.spawn('fx_dot', x, y, { depth: DEPTH.fxLow, life: 0.25, tint: 0x7a0a10, scale: 0.6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 9 });
    }
    // persistent splat decal (ring buffer)
    const key = `fx_blood_${Math.floor(Math.random() * 3)}`;
    const dx = x + Math.cos(angle) * (10 + Math.random() * 14), dy = y + Math.sin(angle) * (10 + Math.random() * 14);
    let d = this.decals[this.decalIdx];
    if (!d) { d = this.scene.add.image(dx, dy, key).setDepth(DEPTH.decal); this.decals[this.decalIdx] = d; }
    d.setTexture(key).setPosition(dx, dy).setRotation(Math.random() * 6.28).setScale(0.32 + Math.random() * 0.2).setAlpha(0.8);
    this.decalIdx = (this.decalIdx + 1) % 80;
  }

  armorSpark(x: number, y: number) {
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * 6.28, sp = 100 + Math.random() * 120;
      this.spawn('fx_spark', x, y, { blend: Phaser.BlendModes.ADD, life: 0.15, rot: a, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 8, scale: 0.16, tint: 0x9ad0ff });
    }
  }

  ring(x: number, y: number, color: number, scale = 1, life = 0.5) {
    this.spawn('fx_ring', x, y, { blend: Phaser.BlendModes.ADD, life, scale: 0.15 * scale, grow: 3, tint: color, alpha: 0.9 });
  }

  sparkle(x: number, y: number, color: number) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * 6.28, sp = 60 + Math.random() * 40;
      this.spawn('fx_dot', x, y, { blend: Phaser.BlendModes.ADD, life: 0.45, tint: color, scale: 0.5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 5 });
    }
  }

  floatText(x: number, y: number, text: string, color = '#f3e2b8', size = 15) {
    const t = this.scene.add.text(x, y, text, {
      fontFamily: '"Barlow Condensed", sans-serif', fontSize: `${size * 2}px`, fontStyle: '600', color,
      stroke: '#0a0a0d', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(DEPTH.text).setScale(0.5).setResolution(1);
    this.texts.push(t);
    t.setAlpha(0);
    this.scene.tweens.add({ targets: t, y: y - 34, alpha: { from: 1, to: 0 }, duration: 1300, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
    this.scene.tweens.add({ targets: t, scale: { from: 0.35, to: 0.5 }, duration: 200, ease: 'Back.easeOut' });
  }
}

export { RES };
