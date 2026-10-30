import Phaser from 'phaser';
import type { HotelMap } from '../sim/map';
import { canvas } from './paint';

export interface LightSource {
  kind: 'cone' | 'point';
  x: number; y: number;
  angle: number;
  range: number;
  half: number; // half-angle for cones
  intensity: number;
  color?: [number, number, number];
}

export type LightQuality = 'high' | 'low';

const AMBIENT = 'rgb(15,18,28)';
const CONE_RES = 256;

/**
 * Screen-space light map rendered with Canvas2D each frame and composited over the world
 * with MULTIPLY blending. Every light is clipped by a visibility polygon ray-cast against
 * the map's opaque tiles, so walls and tall furniture cast real shadows.
 */
export class Lighting {
  private work: HTMLCanvasElement;
  private wctx: CanvasRenderingContext2D;
  private out: HTMLCanvasElement;
  private octx: CanvasRenderingContext2D;
  private tex!: Phaser.Textures.CanvasTexture;
  private image!: Phaser.GameObjects.Image;
  private glow!: Phaser.GameObjects.Image;
  private staticCanvas: HTMLCanvasElement;
  private staticScale = 0.25;
  private cone: HTMLCanvasElement;
  private spill: HTMLCanvasElement;
  private scale = 0.5;
  private blur = true;
  private key = 'lightmap';
  private rays = 60;

  constructor(private scene: Phaser.Scene, private map: HotelMap, depth: number, quality: LightQuality) {
    [this.work, this.wctx] = canvas(16, 16);
    [this.out, this.octx] = canvas(16, 16);
    this.cone = makeCone();
    this.spill = makeSpill();
    this.staticCanvas = this.bakeStatic();
    this.setQuality(quality);
    this.tex = scene.textures.addCanvas(this.key, this.out)!;
    this.image = scene.add.image(0, 0, this.key).setOrigin(0).setDepth(depth).setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.glow = scene.add.image(0, 0, this.key).setOrigin(0).setDepth(depth + 0.5).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.05);
  }

  setQuality(q: LightQuality) {
    this.scale = q === 'high' ? 0.5 : 0.34;
    this.blur = q === 'high';
    this.rays = q === 'high' ? 64 : 40;
  }

  destroy() {
    this.image.destroy();
    this.glow.destroy();
    if (this.scene.textures.exists(this.key)) this.scene.textures.remove(this.key);
  }

  private bakeStatic() {
    const s = this.staticScale;
    const [c, ctx] = canvas(this.map.pxW * s, this.map.pxH * s);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.globalCompositeOperation = 'lighter';
    for (const l of this.map.layout.lights) {
      const poly = this.polygon(l.x, l.y, 0, Math.PI, l.radius, 140);
      ctx.save();
      ctx.beginPath();
      poly.forEach(([x, y], i) => (i ? ctx.lineTo(x * s, y * s) : ctx.moveTo(x * s, y * s)));
      ctx.closePath();
      ctx.clip();
      const g = ctx.createRadialGradient(l.x * s, l.y * s, 0, l.x * s, l.y * s, l.radius * s);
      const [r, gg, b] = l.color;
      const k = l.intensity * 1.25;
      g.addColorStop(0, `rgba(${r},${gg},${b},${Math.min(1, k)})`);
      g.addColorStop(0.35, `rgba(${r},${gg},${b},${k * 0.45})`);
      g.addColorStop(1, `rgba(${r},${gg},${b},0)`);
      ctx.fillStyle = g;
      ctx.fillRect((l.x - l.radius) * s, (l.y - l.radius) * s, l.radius * 2 * s, l.radius * 2 * s);
      ctx.restore();
    }
    return c;
  }

  /** Visibility polygon (world coords) for a cone or full circle. */
  polygon(x: number, y: number, angle: number, half: number, range: number, rays = this.rays): [number, number][] {
    const pts: [number, number][] = [];
    const full = half >= Math.PI - 0.01;
    if (!full) pts.push([x, y]);
    const a0 = angle - half - 0.05, a1 = angle + half + 0.05;
    const n = full ? rays : Math.max(12, Math.round(rays * (half / 0.45)));
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      const d = Math.min(range, this.map.raycast(x, y, a, range, 'opaque') + 8);
      pts.push([x + Math.cos(a) * d, y + Math.sin(a) * d]);
    }
    return pts;
  }

  render(cam: Phaser.Cameras.Scene2D.Camera, lights: LightSource[]) {
    const v = cam.worldView;
    const s = this.scale;
    const w = Math.ceil(v.width * s) + 2, h = Math.ceil(v.height * s) + 2;
    if (this.work.width !== w || this.work.height !== h) {
      this.work.width = this.out.width = w;
      this.work.height = this.out.height = h;
      this.tex.setSize(w, h);
    }
    const ctx = this.wctx;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.fillStyle = AMBIENT;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    const ss = this.staticScale;
    ctx.drawImage(this.staticCanvas, v.x * ss, v.y * ss, v.width * ss, v.height * ss, 0, 0, v.width * s, v.height * s);

    const margin = 460;
    for (const l of lights) {
      if (l.x < v.x - margin || l.x > v.right + margin || l.y < v.y - margin || l.y > v.bottom + margin) continue;
      const lx = (l.x - v.x) * s, ly = (l.y - v.y) * s;
      if (l.kind === 'cone') {
        const poly = this.polygon(l.x, l.y, l.angle, l.half, l.range);
        ctx.save();
        ctx.beginPath();
        poly.forEach(([x, y], i) => (i ? ctx.lineTo((x - v.x) * s, (y - v.y) * s) : ctx.moveTo((x - v.x) * s, (y - v.y) * s)));
        ctx.closePath();
        ctx.clip();
        ctx.globalAlpha = Math.min(1, l.intensity);
        ctx.translate(lx, ly);
        ctx.rotate(l.angle);
        const L = l.range * s;
        ctx.drawImage(this.cone, 0, -L / 2, L, L);
        ctx.restore();
        // spill around the holder
        ctx.globalAlpha = 0.32 * l.intensity;
        const r = 70 * s;
        ctx.drawImage(this.spill, lx - r, ly - r, r * 2, r * 2);
        ctx.globalAlpha = 1;
      } else {
        const poly = this.polygon(l.x, l.y, 0, Math.PI, l.range, 36);
        ctx.save();
        ctx.beginPath();
        poly.forEach(([x, y], i) => (i ? ctx.lineTo((x - v.x) * s, (y - v.y) * s) : ctx.moveTo((x - v.x) * s, (y - v.y) * s)));
        ctx.closePath();
        ctx.clip();
        ctx.globalAlpha = Math.min(1, l.intensity);
        const r = l.range * s;
        ctx.drawImage(this.spill, lx - r, ly - r, r * 2, r * 2);
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    }

    const o = this.octx;
    o.globalCompositeOperation = 'copy';
    o.filter = this.blur ? 'blur(1.6px)' : 'none';
    o.drawImage(this.work, 0, 0);
    o.filter = 'none';
    this.tex.refresh();

    const ox = v.x, oy = v.y;
    const dw = w / s, dh = h / s;
    this.image.setPosition(ox, oy).setDisplaySize(dw, dh);
    this.glow.setPosition(ox, oy).setDisplaySize(dw, dh);
  }
}

function makeCone() {
  const [c, ctx] = canvas(CONE_RES, CONE_RES);
  const img = ctx.createImageData(CONE_RES, CONE_RES);
  const half = 0.42;
  for (let y = 0; y < CONE_RES; y++)
    for (let x = 0; x < CONE_RES; x++) {
      const dx = x / CONE_RES, dy = (y - CONE_RES / 2) / CONE_RES;
      const d = Math.hypot(dx, dy);
      const a = Math.abs(Math.atan2(dy, dx));
      let ang = 1 - smooth(half * 0.55, half + 0.04, a);
      const rad = Math.pow(Math.max(0, 1 - d), 1.35);
      const hot = Math.exp(-d * 9) * 0.6;
      let v = Math.min(1.4, rad * ang * 1.25 + hot * ang);
      // faint lens rings
      v *= 1 - 0.06 * Math.sin(d * 40) * ang;
      const i = (y * CONE_RES + x) * 4;
      img.data[i] = Math.min(255, 255 * v);
      img.data[i + 1] = Math.min(255, 242 * v);
      img.data[i + 2] = Math.min(255, 218 * v);
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  return c;
}

function makeSpill() {
  const [c, ctx] = canvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,236,205,1)');
  g.addColorStop(0.4, 'rgba(255,220,180,0.45)');
  g.addColorStop(1, 'rgba(255,210,170,0)');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return c;
}

function smooth(e0: number, e1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
