import Phaser from 'phaser';
import type { HotelMap } from '../sim/map';
import { Tile, TILE, WallDecor } from '../sim/mapTypes';
import { drawFurniture } from './furniture';
import { canvas, Ctx, ellipse, hash, litFill, radialFill, rr, stroke } from './paint';
import { carpetPattern } from './textures';

const CHUNK = 1024;
const LUX = new Set(['burgundy', 'red', 'blue', 'runner']);

export interface Fixture { x: number; y: number; color: number; scale: number; alpha: number }

/** Bakes the static hotel into chunked textures: ground (below lighting) and walls (above lighting). */
export class MapRenderer {
  readonly fixtures: Fixture[] = [];
  private patterns = new Map<string, HTMLCanvasElement>();
  private wallPath = new Path2D();

  constructor(private scene: Phaser.Scene, private map: HotelMap) {
    for (const k of ['burgundy', 'red', 'blue', 'runner', 'tile', 'utility', 'marble']) this.patterns.set(k, carpetPattern(k));
    for (let y = 0; y < map.h; y++)
      for (let x = 0; x < map.w; x++) if (map.tiles[y * map.w + x] !== Tile.Floor) this.wallPath.rect(x * TILE, y * TILE, TILE, TILE);
  }

  build(groundDepth: number, wallDepth: number) {
    const map = this.map;
    const nx = Math.ceil(map.pxW / CHUNK), ny = Math.ceil(map.pxH / CHUNK);
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const cx = i * CHUNK, cy = j * CHUNK;
        const w = Math.min(CHUNK, map.pxW - cx), h = Math.min(CHUNK, map.pxH - cy);
        const g = this.bakeGround(cx, cy, w, h);
        const gk = `ground_${i}_${j}`;
        if (this.scene.textures.exists(gk)) this.scene.textures.remove(gk);
        this.scene.textures.addCanvas(gk, g);
        this.scene.add.image(cx, cy, gk).setOrigin(0).setDepth(groundDepth);
        const wc = this.bakeWalls(cx, cy, w, h);
        const wk = `walls_${i}_${j}`;
        if (this.scene.textures.exists(wk)) this.scene.textures.remove(wk);
        this.scene.textures.addCanvas(wk, wc);
        this.scene.add.image(cx, cy, wk).setOrigin(0).setDepth(wallDepth);
      }
    this.collectFixtures();
  }

  private bakeGround(cx: number, cy: number, w: number, h: number) {
    const map = this.map;
    const [c, ctx] = canvas(w, h);
    ctx.translate(-cx, -cy);
    ctx.fillStyle = '#060608';
    ctx.fillRect(cx, cy, w, h);
    const overlaps = (x: number, y: number, ww: number, hh: number, m = 64) => x - m < cx + w && x + ww + m > cx && y - m < cy + h && y + hh + m > cy;

    for (const r of map.rooms) {
      const x = r.x * TILE, y = r.y * TILE, ww = r.w * TILE, hh = r.h * TILE;
      if (!overlaps(x, y, ww, hh)) continue;
      ctx.fillStyle = ctx.createPattern(this.patterns.get(r.floor)!, 'repeat')!;
      ctx.fillRect(x, y, ww, hh);
    }
    for (const d of map.layout.doors) {
      const x = d.x * TILE, y = d.y * TILE, ww = d.w * TILE, hh = d.h * TILE;
      if (!overlaps(x, y, ww, hh)) continue;
      ctx.fillStyle = ctx.createPattern(this.patterns.get(d.floor)!, 'repeat')!;
      ctx.fillRect(x, y, ww, hh);
      // brass threshold strip
      ctx.fillStyle = 'rgba(190,150,80,0.55)';
      if (d.w >= d.h) { ctx.fillRect(x, y + hh / 2 - 1.5, ww, 3); } else { ctx.fillRect(x + ww / 2 - 1.5, y, 3, hh); }
    }
    // ornate carpet borders
    for (const r of map.rooms) {
      if (!LUX.has(r.floor)) continue;
      const x = r.x * TILE, y = r.y * TILE, ww = r.w * TILE, hh = r.h * TILE;
      if (!overlaps(x, y, ww, hh)) continue;
      const inset = r.floor === 'runner' ? 8 : 14;
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, ww, hh); ctx.clip();
      ctx.strokeStyle = 'rgba(20,6,8,0.55)'; ctx.lineWidth = 18;
      ctx.strokeRect(x + inset + 4, y + inset + 4, ww - 2 * inset - 8, hh - 2 * inset - 8);
      ctx.strokeStyle = 'rgba(205,168,98,0.55)'; ctx.lineWidth = 1.6;
      ctx.strokeRect(x + inset - 5, y + inset - 5, ww - 2 * inset + 10, hh - 2 * inset + 10);
      ctx.strokeRect(x + inset + 13, y + inset + 13, ww - 2 * inset - 26, hh - 2 * inset - 26);
      // repeating motif inside the border band
      ctx.fillStyle = 'rgba(205,168,98,0.35)';
      const step = 22;
      const band = inset + 4;
      for (let px = x + band + 10; px < x + ww - band - 6; px += step) {
        diamond(ctx, px, y + band, 3.2); diamond(ctx, px, y + hh - band, 3.2);
      }
      for (let py = y + band + 10; py < y + hh - band - 6; py += step) {
        diamond(ctx, x + band, py, 3.2); diamond(ctx, x + ww - band, py, 3.2);
      }
      ctx.restore();
    }
    // ambient occlusion: walls cast a soft shadow onto the floor
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 26;
    ctx.fillStyle = '#000';
    ctx.fill(this.wallPath);
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.fill(this.wallPath);
    ctx.restore();

    // furniture: flat decor first
    const order = ['rug', 'danceFloor', 'stage'];
    const sorted = [...map.furniture].sort((a, b) => (order.includes(b.type) ? 1 : 0) - (order.includes(a.type) ? 1 : 0));
    for (const f of sorted) if (overlaps(f.x, f.y, f.w, f.h, 40)) drawFurniture(ctx, f);

    // subtle vignette per room for depth
    for (const r of map.rooms) {
      const x = r.x * TILE, y = r.y * TILE, ww = r.w * TILE, hh = r.h * TILE;
      if (!overlaps(x, y, ww, hh)) continue;
      const g = ctx.createRadialGradient(x + ww / 2, y + hh / 2, Math.min(ww, hh) * 0.2, x + ww / 2, y + hh / 2, Math.max(ww, hh) * 0.75);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.28)');
      ctx.fillStyle = g; ctx.fillRect(x, y, ww, hh);
    }
    return c;
  }

  private bakeWalls(cx: number, cy: number, w: number, h: number) {
    const map = this.map;
    const [c, ctx] = canvas(w, h);
    ctx.translate(-cx, -cy);
    const tx0 = Math.max(0, Math.floor(cx / TILE) - 1), ty0 = Math.max(0, Math.floor(cy / TILE) - 1);
    const tx1 = Math.min(map.w - 1, Math.ceil((cx + w) / TILE)), ty1 = Math.min(map.h - 1, Math.ceil((cy + h) / TILE));
    const floor = (x: number, y: number) => map.inBounds(x, y) && map.tiles[y * map.w + x] === Tile.Floor;
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) {
        const t = map.tiles[ty * map.w + tx];
        if (t === Tile.Floor) continue;
        const x = tx * TILE, y = ty * TILE;
        if (t === Tile.Void) {
          // solid building mass between and around rooms
          ctx.fillStyle = '#0d0c10';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.strokeStyle = 'rgba(255,255,255,0.018)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
          continue;
        }
        const g = ctx.createLinearGradient(x, y, x + TILE, y + TILE);
        g.addColorStop(0, '#1d1b21'); g.addColorStop(1, '#141217');
        ctx.fillStyle = g;
        ctx.fillRect(x, y, TILE, TILE);
        // wainscot trim on faces adjacent to floor
        const trim = (x0: number, y0: number, x1: number, y1: number) => {
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
          ctx.strokeStyle = 'rgba(176,140,82,0.75)'; ctx.lineWidth = 2.2; ctx.stroke();
        };
        const inner = (x0: number, y0: number, x1: number, y1: number) => {
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
          ctx.strokeStyle = 'rgba(70,58,44,0.9)'; ctx.lineWidth = 3; ctx.stroke();
        };
        if (floor(tx, ty + 1)) { inner(x, y + TILE - 4, x + TILE, y + TILE - 4); trim(x, y + TILE - 1, x + TILE, y + TILE - 1); }
        if (floor(tx, ty - 1)) { inner(x, y + 4, x + TILE, y + 4); trim(x, y + 1, x + TILE, y + 1); }
        if (floor(tx + 1, ty)) { inner(x + TILE - 4, y, x + TILE - 4, y + TILE); trim(x + TILE - 1, y, x + TILE - 1, y + TILE); }
        if (floor(tx - 1, ty)) { inner(x + 4, y, x + 4, y + TILE); trim(x + 1, y, x + 1, y + TILE); }
      }
    for (const d of map.layout.decor) if (d.x > cx - 80 && d.x < cx + w + 80 && d.y > cy - 80 && d.y < cy + h + 80) drawDecor(ctx, d);
    return c;
  }

  private collectFixtures() {
    const map = this.map;
    for (const l of map.layout.lights) {
      const col = (l.color[0] << 16) | (l.color[1] << 8) | l.color[2];
      this.fixtures.push({ x: l.x, y: l.y, color: col, scale: 0.5 + l.intensity, alpha: 0.35 });
    }
    for (const d of map.layout.decor) {
      if (d.type === 'exitSign') this.fixtures.push({ x: d.x, y: d.y, color: 0xff4436, scale: 0.6, alpha: 0.6 });
    }
    for (const f of map.furniture) {
      if (f.type === 'monitorWall') this.fixtures.push({ x: f.x + f.w / 2, y: f.y + f.h / 2, color: 0x4a8ee0, scale: 2.2, alpha: 0.35 });
      if (f.type === 'vending') this.fixtures.push({ x: f.x + f.w / 2, y: f.y + f.h / 2, color: 0x88ccff, scale: 1, alpha: 0.35 });
      if (f.type === 'serverRack') this.fixtures.push({ x: f.x + f.w / 2, y: f.y + f.h / 2, color: 0x4dff9a, scale: 0.6, alpha: 0.25 });
    }
  }
}

function diamond(ctx: Ctx, x: number, y: number, s: number) {
  ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.closePath(); ctx.fill();
}

const ART = [
  ['#2c4a6b', '#c9a45c', '#8a3b2c'], ['#5a6b3a', '#d8c9a0', '#2b2b3a'], ['#7a2c3a', '#e0b070', '#1f2f45'], ['#3b5a6e', '#a8b8a0', '#6b4a2e'],
];

function drawDecor(ctx: Ctx, d: WallDecor) {
  ctx.save();
  ctx.translate(d.x, d.y);
  // rotate so the decor's room side is +y
  const rot = { n: 0, s: Math.PI, w: -Math.PI / 2, e: Math.PI / 2 }[d.side];
  ctx.rotate(rot);
  switch (d.type) {
    case 'painting': {
      const a = ART[d.variant % 4];
      rr(ctx, -22, -9, 44, 9, 1); litFill(ctx, '#b08a48', -22, -9, 44, 9, 0.4, -0.4);
      ctx.fillStyle = a[0]; ctx.fillRect(-19, -7, 38, 5);
      ctx.fillStyle = a[1]; ctx.fillRect(-12 + d.variant * 3, -7, 9, 5);
      ctx.fillStyle = a[2]; ctx.fillRect(4, -7, 7, 5);
      break;
    }
    case 'mirror':
      rr(ctx, -20, -8, 40, 8, 1); litFill(ctx, '#b08a48', -20, -8, 40, 8, 0.4, -0.4);
      ctx.fillStyle = '#9fb3c4'; ctx.fillRect(-17, -6, 34, 4);
      break;
    case 'elevator':
      rr(ctx, -30, -10, 60, 10, 1); litFill(ctx, '#8d7a55', -30, -10, 60, 10, 0.5, -0.4);
      ctx.fillStyle = '#5e5a52'; ctx.fillRect(-26, -7, 25, 6); ctx.fillRect(1, -7, 25, 6);
      ctx.fillStyle = '#111'; ctx.fillRect(-1, -7, 2, 6);
      ctx.fillStyle = '#ff5a3a'; ctx.fillRect(-4, -12, 8, 2);
      ctx.save(); ctx.rotate(Math.PI); ctx.fillStyle = 'rgba(230,200,150,0.75)'; ctx.font = 'bold 6px "Barlow Condensed", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('OUT OF SERVICE', 0, 14); ctx.restore();
      break;
    case 'sconce':
      ellipse(ctx, 0, -3, 5, 3); radialFill(ctx, '#c9a45c', 0, -3, 5, 0.5, -0.3);
      ellipse(ctx, 0, -1, 2.5, 2.5); ctx.fillStyle = '#ffe0a0'; ctx.fill();
      break;
    case 'clock':
      ellipse(ctx, 0, -4, 7, 4); radialFill(ctx, '#d8d0c2', 0, -4, 7);
      stroke(ctx, '#b08a48', 1.2);
      break;
    case 'exitSign':
      rr(ctx, -9, -5, 18, 5, 1); ctx.fillStyle = '#7a1612'; ctx.fill();
      ctx.fillStyle = '#ffcfc4'; ctx.font = 'bold 4px sans-serif'; ctx.textAlign = 'center'; ctx.save(); ctx.rotate(Math.PI); ctx.fillText('EXIT', 0, 3.6); ctx.restore();
      break;
    case 'revolvingDoor':
      ctx.beginPath(); ctx.arc(0, 0, 26, Math.PI, 0, false); ctx.closePath();
      ctx.fillStyle = 'rgba(120,150,170,0.35)'; ctx.fill(); stroke(ctx, '#b08a48', 2);
      for (let i = 0; i < 4; i++) { const a = Math.PI + (i / 4) * Math.PI + 0.4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 25, Math.sin(a) * 25); stroke(ctx, 'rgba(200,220,235,0.8)', 1.4); }
      ellipse(ctx, 0, 0, 3, 3); ctx.fillStyle = '#b08a48'; ctx.fill();
      break;
    case 'stairsClosed':
      rr(ctx, -18, -8, 36, 8, 1); ctx.fillStyle = '#2a2a2e'; ctx.fill();
      for (let x = -16; x < 16; x += 6) { ctx.beginPath(); ctx.moveTo(x, -1); ctx.lineTo(x + 5, -7); stroke(ctx, '#d4a83a', 1.6); }
      break;
  }
  ctx.restore();
}

export { hash };
