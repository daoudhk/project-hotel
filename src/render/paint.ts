// Shared Canvas2D painting helpers used to illustrate every asset procedurally.
export type Ctx = CanvasRenderingContext2D;

export function canvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return [c, c.getContext('2d')!];
}

export function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function ellipse(ctx: Ctx, cx: number, cy: number, rx: number, ry: number) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, Math.PI * 2);
}

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) {
    r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt;
  } else {
    r *= 1 + amt; g *= 1 + amt; b *= 1 + amt;
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

/** Fill the current path with a soft top-left lit gradient. */
export function litFill(ctx: Ctx, base: string, x: number, y: number, w: number, h: number, hi = 0.18, lo = -0.35) {
  const g = ctx.createLinearGradient(x, y, x + w * 0.6, y + h);
  g.addColorStop(0, shade(base, hi));
  g.addColorStop(0.55, base);
  g.addColorStop(1, shade(base, lo));
  ctx.fillStyle = g;
  ctx.fill();
}

export function radialFill(ctx: Ctx, base: string, cx: number, cy: number, r: number, hi = 0.25, lo = -0.4) {
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.05, cx, cy, r);
  g.addColorStop(0, shade(base, hi));
  g.addColorStop(0.6, base);
  g.addColorStop(1, shade(base, lo));
  ctx.fillStyle = g;
  ctx.fill();
}

export function stroke(ctx: Ctx, color: string, w: number) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
}

/** Small deterministic hash noise. */
export function hash(x: number, y: number, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Sprinkle fibre / grain noise over a region. */
export function grain(ctx: Ctx, w: number, h: number, amount: number, light = 'rgba(255,255,255,', dark = 'rgba(0,0,0,', seed = 1, density = 0.9) {
  const n = Math.floor(w * h * density * 0.02);
  for (let i = 0; i < n; i++) {
    const x = hash(i, 1, seed) * w, y = hash(i, 2, seed) * h;
    const v = hash(i, 3, seed);
    ctx.fillStyle = (v > 0.5 ? light : dark) + (amount * (0.4 + hash(i, 4, seed) * 0.6)).toFixed(3) + ')';
    ctx.fillRect(x, y, 1 + hash(i, 5, seed) * 1.5, 1);
  }
}

export function withShadow(ctx: Ctx, blur: number, ox: number, oy: number, alpha: number, fn: () => void) {
  ctx.save();
  ctx.shadowColor = `rgba(0,0,0,${alpha})`;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = ox;
  ctx.shadowOffsetY = oy;
  fn();
  ctx.restore();
}
