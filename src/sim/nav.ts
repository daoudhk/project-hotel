import type { HotelMap } from './map';
import { TILE } from './mapTypes';

/** Binary-heap A* over the map's walkable grid with 8-way movement and path smoothing. */
export class Navigator {
  private g: Float32Array;
  private f: Float32Array;
  private parent: Int32Array;
  private stamp: Uint32Array;
  private closed: Uint32Array;
  private run = 1;
  private heap: number[] = [];

  constructor(private map: HotelMap) {
    const n = map.w * map.h;
    this.g = new Float32Array(n);
    this.f = new Float32Array(n);
    this.parent = new Int32Array(n);
    this.stamp = new Uint32Array(n);
    this.closed = new Uint32Array(n);
  }

  findPath(sx: number, sy: number, gx: number, gy: number): [number, number][] | null {
    const m = this.map;
    [sx, sy] = m.nearestWalkable(sx, sy);
    [gx, gy] = m.nearestWalkable(gx, gy);
    const W = m.w;
    const s = Math.floor(sy / TILE) * W + Math.floor(sx / TILE);
    const goal = Math.floor(gy / TILE) * W + Math.floor(gx / TILE);
    const gtx = goal % W, gty = (goal / W) | 0;
    const run = ++this.run;
    const heap = this.heap;
    heap.length = 0;
    const h = (i: number) => {
      const dx = Math.abs((i % W) - gtx), dy = Math.abs(((i / W) | 0) - gty);
      return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
    };
    this.stamp[s] = run;
    this.g[s] = 0;
    this.f[s] = h(s);
    this.parent[s] = -1;
    this.push(s);
    let found = false;
    let iter = 0;
    while (heap.length && iter++ < 12000) {
      const cur = this.pop();
      if (cur === goal) { found = true; break; }
      if (this.closed[cur] === run) continue;
      this.closed[cur] = run;
      const cx = cur % W, cy = (cur / W) | 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = cx + dx, ny = cy + dy;
          if (!m.isWalkable(nx, ny)) continue;
          if (dx && dy && (!m.isWalkable(cx + dx, cy) || !m.isWalkable(cx, cy + dy))) continue;
          const ni = ny * W + nx;
          if (this.closed[ni] === run) continue;
          const ng = this.g[cur] + (dx && dy ? Math.SQRT2 : 1);
          if (this.stamp[ni] !== run || ng < this.g[ni]) {
            this.stamp[ni] = run;
            this.g[ni] = ng;
            this.f[ni] = ng + h(ni);
            this.parent[ni] = cur;
            this.push(ni);
          }
        }
    }
    if (!found) return null;
    const raw: [number, number][] = [];
    for (let i = goal; i !== -1; i = this.parent[i]) raw.push([(i % W + 0.5) * TILE, (((i / W) | 0) + 0.5) * TILE]);
    raw.reverse();
    raw[raw.length - 1] = [gx, gy];
    // string pulling
    const out: [number, number][] = [];
    let a = 0;
    while (a < raw.length - 1) {
      let b = raw.length - 1;
      while (b > a + 1 && !m.walkLineClear(raw[a][0], raw[a][1], raw[b][0], raw[b][1])) b--;
      out.push(raw[b]);
      a = b;
    }
    return out;
  }

  private push(i: number) {
    const heap = this.heap, f = this.f;
    heap.push(i);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (f[heap[p]] <= f[heap[k]]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      k = p;
    }
  }
  private pop(): number {
    const heap = this.heap, f = this.f;
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1, r = l + 1;
        let m = k;
        if (l < heap.length && f[heap[l]] < f[heap[m]]) m = l;
        if (r < heap.length && f[heap[r]] < f[heap[m]]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top;
  }
}
