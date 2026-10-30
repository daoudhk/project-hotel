import { buildLayout, LayoutData, MAP_H, MAP_W } from './hotelLayout';
import { Furniture, Room, Tile, TILE } from './mapTypes';
import { clamp } from '../core/math';

export interface RayHit {
  dist: number;
  x: number;
  y: number;
  /** 'wall' | 'furniture' | 'none' */
  kind: 'wall' | 'furniture' | 'none';
  furniture?: Furniture;
  nx: number; ny: number; // surface normal
}

/**
 * Static hotel map: tile grid, furniture, static lighting and navigation data.
 * Pure TypeScript – no Phaser – so it can run on a dedicated game server.
 */
export class HotelMap {
  readonly w = MAP_W;
  readonly h = MAP_H;
  readonly pxW = MAP_W * TILE;
  readonly pxH = MAP_H * TILE;
  readonly tiles = new Uint8Array(MAP_W * MAP_H);
  /** blocks light & sight (walls + tall furniture) */
  readonly opaque = new Uint8Array(MAP_W * MAP_H);
  /** walkable for navigation (no wall, no solid furniture with clearance) */
  readonly walkable = new Uint8Array(MAP_W * MAP_H);
  readonly roomIndex = new Int16Array(MAP_W * MAP_H).fill(-1);
  /** static light luminance per tile (0..1+) */
  readonly light = new Float32Array(MAP_W * MAP_H);
  /** how enclosed each tile is (count of solid 8-neighbours, furniture counted) */
  readonly enclosure = new Uint8Array(MAP_W * MAP_H);
  readonly layout: LayoutData;
  readonly rooms: Room[];
  readonly furniture: Furniture[];
  private furnGrid: number[][] = [];

  constructor() {
    this.layout = buildLayout();
    this.rooms = this.layout.rooms;
    this.furniture = this.layout.furniture;
    this.build();
  }

  private idx(tx: number, ty: number) {
    return ty * MAP_W + tx;
  }

  private build() {
    const L = this.layout;
    this.tiles.fill(Tile.Void);
    // carve rooms
    L.rooms.forEach((r, ri) => {
      for (let y = r.y; y < r.y + r.h; y++)
        for (let x = r.x; x < r.x + r.w; x++) {
          this.tiles[this.idx(x, y)] = Tile.Floor;
          this.roomIndex[this.idx(x, y)] = ri;
        }
    });
    for (const wl of L.walls)
      for (let y = wl.y; y < wl.y + wl.h; y++)
        for (let x = wl.x; x < wl.x + wl.w; x++) this.tiles[this.idx(x, y)] = Tile.Wall;
    for (const d of L.doors)
      for (let y = d.y; y < d.y + d.h; y++)
        for (let x = d.x; x < d.x + d.w; x++) this.tiles[this.idx(x, y)] = Tile.Floor;
    // void next to floor becomes visible wall
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) {
        if (this.tiles[this.idx(x, y)] !== Tile.Void) continue;
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < MAP_W && ny < MAP_H && this.tiles[this.idx(nx, ny)] === Tile.Floor) near = true;
          }
        if (near) this.tiles[this.idx(x, y)] = Tile.Wall;
      }
    // door tiles get the room index of a neighbouring room for naming
    for (const d of L.doors)
      for (let y = d.y; y < d.y + d.h; y++)
        for (let x = d.x; x < d.x + d.w; x++) {
          if (this.roomIndex[this.idx(x, y)] >= 0) continue;
          for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0], [0, -2], [0, 2], [-2, 0], [2, 0]]) {
            const ri = this.roomIndex[this.idx(clamp(x + dx, 0, MAP_W - 1), clamp(y + dy, 0, MAP_H - 1))];
            if (ri >= 0) { this.roomIndex[this.idx(x, y)] = ri; break; }
          }
        }

    // opacity
    for (let i = 0; i < this.tiles.length; i++) this.opaque[i] = this.tiles[i] !== Tile.Floor ? 1 : 0;
    for (const f of this.furniture) {
      if (!f.tall) continue;
      for (let ty = Math.floor(f.y / TILE); ty < Math.ceil((f.y + f.h) / TILE); ty++)
        for (let tx = Math.floor(f.x / TILE); tx < Math.ceil((f.x + f.w) / TILE); tx++) {
          // tile must be mostly covered
          const ox = Math.min(f.x + f.w, (tx + 1) * TILE) - Math.max(f.x, tx * TILE);
          const oy = Math.min(f.y + f.h, (ty + 1) * TILE) - Math.max(f.y, ty * TILE);
          if (ox * oy > TILE * TILE * 0.5) this.opaque[this.idx(tx, ty)] = 1;
        }
    }

    // furniture spatial grid (by tile)
    this.furnGrid = Array.from({ length: MAP_W * MAP_H }, () => []);
    for (let i = 0; i < this.furniture.length; i++) {
      const f = this.furniture[i];
      if (!f.solid && !f.cover) continue;
      const x0 = Math.floor(f.x / TILE), x1 = Math.floor((f.x + f.w) / TILE);
      const y0 = Math.floor(f.y / TILE), y1 = Math.floor((f.y + f.h) / TILE);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H) this.furnGrid[this.idx(tx, ty)].push(i);
    }

    // walkable with clearance for an actor of radius ~13
    const clear = 11;
    for (let ty = 0; ty < MAP_H; ty++)
      for (let tx = 0; tx < MAP_W; tx++) {
        const i = this.idx(tx, ty);
        if (this.tiles[i] !== Tile.Floor) continue;
        const cx = tx * TILE + TILE / 2, cy = ty * TILE + TILE / 2;
        let ok = true;
        for (const fi of this.furnitureNear(cx, cy, 1)) {
          const f = this.furniture[fi];
          if (!f.solid) continue;
          if (cx > f.x - clear && cx < f.x + f.w + clear && cy > f.y - clear && cy < f.y + f.h + clear) { ok = false; break; }
        }
        this.walkable[i] = ok ? 1 : 0;
      }

    // enclosure (solid neighbours)
    for (let ty = 1; ty < MAP_H - 1; ty++)
      for (let tx = 1; tx < MAP_W - 1; tx++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const j = this.idx(tx + dx, ty + dy);
            if (this.tiles[j] !== Tile.Floor || !this.walkable[j]) n++;
          }
        this.enclosure[this.idx(tx, ty)] = n;
      }

    // static light with shadows
    for (const l of this.layout.lights) {
      const r = Math.ceil(l.radius / TILE);
      const lx = Math.floor(l.x / TILE), ly = Math.floor(l.y / TILE);
      for (let ty = ly - r; ty <= ly + r; ty++)
        for (let tx = lx - r; tx <= lx + r; tx++) {
          if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) continue;
          const cx = tx * TILE + TILE / 2, cy = ty * TILE + TILE / 2;
          const d = Math.hypot(cx - l.x, cy - l.y);
          if (d > l.radius) continue;
          if (!this.lineClear(l.x, l.y, cx, cy)) continue;
          const fall = 1 - d / l.radius;
          this.light[this.idx(tx, ty)] += l.intensity * fall * fall * 1.6;
        }
    }
  }

  // ---------- queries ----------
  inBounds(tx: number, ty: number) {
    return tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H;
  }
  tileAt(px: number, py: number) {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    if (!this.inBounds(tx, ty)) return Tile.Void;
    return this.tiles[this.idx(tx, ty)];
  }
  isSolidTile(tx: number, ty: number) {
    if (!this.inBounds(tx, ty)) return true;
    return this.tiles[this.idx(tx, ty)] !== Tile.Floor;
  }
  isOpaqueTile(tx: number, ty: number) {
    if (!this.inBounds(tx, ty)) return true;
    return this.opaque[this.idx(tx, ty)] === 1;
  }
  isWalkable(tx: number, ty: number) {
    return this.inBounds(tx, ty) && this.walkable[this.idx(tx, ty)] === 1;
  }
  roomAt(px: number, py: number): Room | null {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    if (!this.inBounds(tx, ty)) return null;
    const ri = this.roomIndex[this.idx(tx, ty)];
    return ri >= 0 ? this.rooms[ri] : null;
  }
  floorAt(px: number, py: number) {
    return this.roomAt(px, py)?.floor ?? 'burgundy';
  }
  staticLightAt(px: number, py: number) {
    // bilinear sample across tile centres
    const fx = px / TILE - 0.5, fy = py / TILE - 0.5;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const s = (x: number, y: number) => (this.inBounds(x, y) ? this.light[this.idx(x, y)] : 0);
    return (s(x0, y0) * (1 - tx) + s(x0 + 1, y0) * tx) * (1 - ty) + (s(x0, y0 + 1) * (1 - tx) + s(x0 + 1, y0 + 1) * tx) * ty;
  }
  enclosureAt(px: number, py: number) {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    return this.inBounds(tx, ty) ? this.enclosure[this.idx(tx, ty)] : 8;
  }
  /** furniture indices in tiles around a point */
  furnitureNear(px: number, py: number, radiusTiles = 1): number[] {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    const out: number[] = [];
    for (let y = ty - radiusTiles; y <= ty + radiusTiles; y++)
      for (let x = tx - radiusTiles; x <= tx + radiusTiles; x++) {
        if (!this.inBounds(x, y)) continue;
        for (const fi of this.furnGrid[this.idx(x, y)]) if (!out.includes(fi)) out.push(fi);
      }
    return out;
  }

  /**
   * DDA ray cast through the tile grid. `mode` selects what stops the ray:
   * 'opaque' – walls and tall furniture (light, line of sight)
   * 'solid'  – walls only (bullets; furniture handled separately)
   */
  raycast(ox: number, oy: number, angle: number, maxDist: number, mode: 'opaque' | 'solid' = 'opaque'): number {
    const dx = Math.cos(angle), dy = Math.sin(angle);
    let tx = Math.floor(ox / TILE), ty = Math.floor(oy / TILE);
    const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1;
    const tDeltaX = dx !== 0 ? Math.abs(TILE / dx) : Infinity;
    const tDeltaY = dy !== 0 ? Math.abs(TILE / dy) : Infinity;
    let tMaxX = dx !== 0 ? ((dx > 0 ? (tx + 1) * TILE - ox : ox - tx * TILE) / Math.abs(dx)) : Infinity;
    let tMaxY = dy !== 0 ? ((dy > 0 ? (ty + 1) * TILE - oy : oy - ty * TILE) / Math.abs(dy)) : Infinity;
    const blocked = mode === 'opaque' ? this.opaque : this.tiles;
    const test = mode === 'opaque' ? (i: number) => blocked[i] === 1 : (i: number) => blocked[i] !== Tile.Floor;
    let t = 0;
    while (t < maxDist) {
      if (tMaxX < tMaxY) {
        t = tMaxX; tMaxX += tDeltaX; tx += stepX;
      } else {
        t = tMaxY; tMaxY += tDeltaY; ty += stepY;
      }
      if (t >= maxDist) return maxDist;
      if (!this.inBounds(tx, ty) || test(this.idx(tx, ty))) return t;
    }
    return maxDist;
  }

  /** True if nothing opaque lies between the two points. */
  lineClear(ax: number, ay: number, bx: number, by: number) {
    const d = Math.hypot(bx - ax, by - ay);
    if (d < 1) return true;
    return this.raycast(ax, ay, Math.atan2(by - ay, bx - ax), d, 'opaque') >= d - 0.5;
  }

  /** Walkable straight-line test used for path smoothing. */
  walkLineClear(ax: number, ay: number, bx: number, by: number) {
    const d = Math.hypot(bx - ax, by - ay);
    const steps = Math.ceil(d / 10);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
      if (!this.isWalkable(Math.floor(x / TILE), Math.floor(y / TILE))) return false;
    }
    return true;
  }

  /** Bullet trace: walls via DDA, furniture cover via slab test. */
  traceBullet(ox: number, oy: number, angle: number, maxDist: number): RayHit {
    const wallD = this.raycast(ox, oy, angle, maxDist, 'solid');
    const dx = Math.cos(angle), dy = Math.sin(angle);
    let best = wallD;
    let bestF: Furniture | undefined;
    let nx = 0, ny = 0;
    // walk along the ray collecting nearby furniture candidates
    const seen = new Set<number>();
    for (let t = 0; t <= best + TILE; t += TILE * 0.75) {
      for (const fi of this.furnitureNear(ox + dx * t, oy + dy * t, 0)) {
        if (seen.has(fi)) continue;
        seen.add(fi);
        const f = this.furniture[fi];
        if (!f.cover) continue;
        const hit = raySlab(ox, oy, dx, dy, f.x, f.y, f.w, f.h);
        if (!hit) continue;
        // shooting over cover you are crouched right behind is allowed
        if (hit.t < 30 && !f.tall) continue;
        if (hit.t < best) { best = hit.t; bestF = f; nx = hit.nx; ny = hit.ny; }
      }
    }
    if (!bestF) {
      if (wallD >= maxDist) return { dist: maxDist, x: ox + dx * maxDist, y: oy + dy * maxDist, kind: 'none', nx: 0, ny: 0 };
      // estimate wall normal from the hit tile
      const hx = ox + dx * wallD, hy = oy + dy * wallD;
      const fxp = hx / TILE - Math.round(hx / TILE), fyp = hy / TILE - Math.round(hy / TILE);
      if (Math.abs(fxp) < Math.abs(fyp)) { nx = -Math.sign(dx); ny = 0; } else { nx = 0; ny = -Math.sign(dy); }
      return { dist: wallD, x: hx, y: hy, kind: 'wall', nx, ny };
    }
    return { dist: best, x: ox + dx * best, y: oy + dy * best, kind: 'furniture', furniture: bestF, nx, ny };
  }

  /** Resolve circle movement against walls and solid furniture. */
  moveCircle(x: number, y: number, dx: number, dy: number, r: number): [number, number] {
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 6));
    for (let s = 0; s < steps; s++) {
      x += dx / steps;
      [x, y] = this.pushOut(x, y, r);
      y += dy / steps;
      [x, y] = this.pushOut(x, y, r);
    }
    return [x, y];
  }

  pushOut(x: number, y: number, r: number): [number, number] {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    for (let iy = ty - 1; iy <= ty + 1; iy++)
      for (let ix = tx - 1; ix <= tx + 1; ix++) {
        if (!this.isSolidTile(ix, iy)) continue;
        [x, y] = circleRectPush(x, y, r, ix * TILE, iy * TILE, TILE, TILE);
      }
    for (const fi of this.furnitureNear(x, y, 1)) {
      const f = this.furniture[fi];
      if (!f.solid) continue;
      if (f.type === 'fountain' || f.type === 'roundTable') {
        // round collision
        const cx = f.x + f.w / 2, cy = f.y + f.h / 2, rr = f.w * (f.type === 'roundTable' ? 0.42 : 0.48);
        const ddx = x - cx, ddy = y - cy, d = Math.hypot(ddx, ddy);
        if (d < rr + r && d > 0.001) {
          x = cx + (ddx / d) * (rr + r);
          y = cy + (ddy / d) * (rr + r);
        }
        continue;
      }
      [x, y] = circleRectPush(x, y, r, f.x, f.y, f.w, f.h);
    }
    return [x, y];
  }

  /** Find the nearest walkable tile centre to a pixel position. */
  nearestWalkable(px: number, py: number): [number, number] {
    const sx = Math.floor(px / TILE), sy = Math.floor(py / TILE);
    if (this.isWalkable(sx, sy)) return [px, py];
    for (let r = 1; r < 12; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (this.isWalkable(sx + dx, sy + dy)) return [(sx + dx + 0.5) * TILE, (sy + dy + 0.5) * TILE];
        }
    return [px, py];
  }
}

function circleRectPush(x: number, y: number, r: number, rx: number, ry: number, rw: number, rh: number): [number, number] {
  const cx = clamp(x, rx, rx + rw), cy = clamp(y, ry, ry + rh);
  const dx = x - cx, dy = y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return [x, y];
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    return [cx + (dx / d) * r, cy + (dy / d) * r];
  }
  // centre inside rect: push out along the smallest axis
  const left = x - rx, right = rx + rw - x, top = y - ry, bottom = ry + rh - y;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return [rx - r, y];
  if (m === right) return [rx + rw + r, y];
  if (m === top) return [x, ry - r];
  return [x, ry + rh + r];
}

export function raySlab(ox: number, oy: number, dx: number, dy: number, rx: number, ry: number, rw: number, rh: number) {
  let tmin = -Infinity, tmax = Infinity, nx = 0, ny = 0;
  if (Math.abs(dx) < 1e-9) {
    if (ox < rx || ox > rx + rw) return null;
  } else {
    let t1 = (rx - ox) / dx, t2 = (rx + rw - ox) / dx;
    let n = -1;
    if (t1 > t2) { [t1, t2] = [t2, t1]; n = 1; }
    if (t1 > tmin) { tmin = t1; nx = n; ny = 0; }
    tmax = Math.min(tmax, t2);
  }
  if (Math.abs(dy) < 1e-9) {
    if (oy < ry || oy > ry + rh) return null;
  } else {
    let t1 = (ry - oy) / dy, t2 = (ry + rh - oy) / dy;
    let n = -1;
    if (t1 > t2) { [t1, t2] = [t2, t1]; n = 1; }
    if (t1 > tmin) { tmin = t1; nx = 0; ny = n; }
    tmax = Math.min(tmax, t2);
  }
  if (tmax < Math.max(0, tmin) || tmin < 0) return null;
  return { t: tmin, nx, ny };
}
