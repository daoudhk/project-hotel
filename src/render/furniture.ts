import type { Furniture } from '../sim/mapTypes';
import { Ctx, ellipse, grain, hash, litFill, radialFill, rr, shade, stroke } from './paint';

const WOOD = ['#5a3420', '#3d2416', '#6b4428'];
const VELVET = ['#6b1a26', '#1f3a5c', '#3c2a4a'];
const LINEN = '#e6dfd0';

/** Run fn in a local frame where the furniture "faces" +y and spans [-w/2,w/2]x[-h/2,h/2]. */
function local(ctx: Ctx, f: Furniture, fn: (w: number, h: number) => void) {
  ctx.save();
  ctx.translate(f.x + f.w / 2, f.y + f.h / 2);
  const rot = [0, Math.PI / 2, Math.PI, -Math.PI / 2][f.rot];
  ctx.rotate(rot);
  const sw = f.rot % 2 === 1;
  fn(sw ? f.h : f.w, sw ? f.w : f.h);
  ctx.restore();
}

function drop(ctx: Ctx, blur = 10, oy = 4, a = 0.55) {
  ctx.shadowColor = `rgba(0,0,0,${a})`;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = oy;
}
function noDrop(ctx: Ctx) {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = ctx.shadowOffsetY = 0;
}

function woodGrain(ctx: Ctx, x: number, y: number, w: number, h: number, base: string, seed = 1, vertical = false) {
  ctx.save();
  rr(ctx, x, y, w, h, 2);
  ctx.clip();
  litFill(ctx, base, x, y, w, h, 0.18, -0.3);
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = shade(base, -0.35);
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 0.8;
  const n = Math.max(3, Math.floor((vertical ? w : h) / 4));
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    if (vertical) {
      const xx = x + (i + hash(i, seed)) * (w / n);
      ctx.moveTo(xx, y); ctx.bezierCurveTo(xx + 2, y + h * 0.3, xx - 2, y + h * 0.7, xx + 1, y + h);
    } else {
      const yy = y + (i + hash(i, seed)) * (h / n);
      ctx.moveTo(x, yy); ctx.bezierCurveTo(x + w * 0.3, yy + 2, x + w * 0.7, yy - 2, x + w, yy + 1);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function cushion(ctx: Ctx, x: number, y: number, w: number, h: number, col: string, r = 5) {
  rr(ctx, x, y, w, h, r);
  const g = ctx.createRadialGradient(x + w * 0.4, y + h * 0.35, 1, x + w / 2, y + h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, shade(col, 0.22)); g.addColorStop(0.7, col); g.addColorStop(1, shade(col, -0.35));
  ctx.fillStyle = g;
  ctx.fill();
  stroke(ctx, shade(col, -0.45), 0.8);
}

function chairTop(ctx: Ctx, x: number, y: number, a: number, col: string, wood: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  drop(ctx, 5, 2, 0.5);
  rr(ctx, -7, -7, 14, 14, 3); litFill(ctx, wood, -7, -7, 14, 14);
  noDrop(ctx);
  cushion(ctx, -5.5, -5.5, 11, 10, col, 3);
  rr(ctx, -7.5, 5, 15, 3.5, 1.5); litFill(ctx, shade(wood, -0.1), -7.5, 5, 15, 3.5);
  ctx.restore();
}

function plant(ctx: Ctx, cx: number, cy: number, r: number, variant: number) {
  drop(ctx, 8, 3);
  ellipse(ctx, cx, cy, r * 0.62, r * 0.62);
  radialFill(ctx, variant ? '#3a3633' : '#8b6f3e', cx, cy, r * 0.65, 0.35, -0.35);
  noDrop(ctx);
  ellipse(ctx, cx, cy, r * 0.5, r * 0.5);
  ctx.fillStyle = '#1e1712'; ctx.fill();
  const leaves = 11 + variant * 3;
  for (let i = 0; i < leaves; i++) {
    const a = (i / leaves) * Math.PI * 2 + hash(i, variant) * 0.5;
    const len = r * (0.75 + hash(i, 3, variant) * 0.45);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.5, -len * 0.22, len, 0);
    ctx.quadraticCurveTo(len * 0.5, len * 0.22, 0, 0);
    const g = ctx.createLinearGradient(0, 0, len, 0);
    const base = i % 3 === 0 ? '#2f5a32' : i % 3 === 1 ? '#3d6e3a' : '#264a2c';
    g.addColorStop(0, shade(base, -0.4)); g.addColorStop(0.7, base); g.addColorStop(1, shade(base, 0.25));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(len * 0.9, 0); stroke(ctx, 'rgba(180,220,160,0.25)', 0.5);
    ctx.restore();
  }
}

function monitor(ctx: Ctx, x: number, y: number, w: number, glow = '#3d78c9') {
  rr(ctx, x, y, w, 3, 1); ctx.fillStyle = '#121316'; ctx.fill();
  ctx.fillStyle = glow; ctx.globalAlpha = 0.8; ctx.fillRect(x + 1, y + 0.6, w - 2, 1.4); ctx.globalAlpha = 1;
  rr(ctx, x + w / 2 - 2.5, y + 3, 5, 3, 1); ctx.fillStyle = '#1a1b1e'; ctx.fill();
}

export function drawFurniture(ctx: Ctx, f: Furniture) {
  const v = Math.floor(Math.abs(f.variant)) || 0;
  ctx.save();
  switch (f.type) {
    case 'rug':
      local(ctx, f, (w, h) => {
        const base = ['#3b1d2a', '#1d2a44', '#2e2433'][v % 3];
        rr(ctx, -w / 2, -h / 2, w, h, 3);
        ctx.fillStyle = base; ctx.fill();
        ctx.strokeStyle = 'rgba(200,165,95,0.55)'; ctx.lineWidth = 2; rr(ctx, -w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 2); ctx.stroke();
        ctx.lineWidth = 1; rr(ctx, -w / 2 + 11, -h / 2 + 11, w - 22, h - 22, 2); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(0, 0, w * 0.28, h * 0.26, 0, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(200,165,95,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
        for (let i = 0; i < 8; i++) {
          ctx.save(); ctx.rotate((i / 8) * Math.PI * 2);
          ctx.beginPath(); ctx.ellipse(0, -h * 0.13, 4, h * 0.1, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(200,165,95,0.25)'; ctx.fill();
          ctx.restore();
        }
        // fringe
        ctx.strokeStyle = 'rgba(220,205,170,0.5)'; ctx.lineWidth = 0.8;
        for (let x = -w / 2 + 3; x < w / 2; x += 3) { ctx.beginPath(); ctx.moveTo(x, -h / 2); ctx.lineTo(x, -h / 2 - 3); ctx.moveTo(x, h / 2); ctx.lineTo(x, h / 2 + 3); ctx.stroke(); }
        ctx.save(); rr(ctx, -w / 2, -h / 2, w, h, 3); ctx.clip(); grain(ctx, w * 2, h * 2, 0.05, 'rgba(255,255,255,', 'rgba(0,0,0,', 3, 2); ctx.restore();
      });
      break;
    case 'danceFloor':
      local(ctx, f, (w, h) => {
        const s = 16;
        for (let y = -h / 2; y < h / 2; y += s)
          for (let x = -w / 2; x < w / 2; x += s) {
            const odd = ((x + y) / s) & 1;
            woodGrain(ctx, x, y, s, s, odd ? '#6e4a2c' : '#5a3b23', x * 3 + y, !!odd);
          }
        rr(ctx, -w / 2, -h / 2, w, h, 2); stroke(ctx, 'rgba(200,165,95,0.7)', 2.5);
      });
      break;
    case 'stage':
      local(ctx, f, (w, h) => {
        drop(ctx, 14, 6, 0.6);
        rr(ctx, -w / 2, -h / 2, w, h, 4); ctx.fillStyle = '#3a2416'; ctx.fill();
        noDrop(ctx);
        for (let x = -w / 2; x < w / 2; x += 20) woodGrain(ctx, x, -h / 2, 20, h, '#4e3220', x, true);
        ctx.fillStyle = '#1b0f0a'; ctx.fillRect(-w / 2, h / 2 - 5, w, 5);
        for (let x = -w / 2 + 20; x < w / 2; x += 40) { ellipse(ctx, x, h / 2 - 2.5, 2, 1.5); ctx.fillStyle = '#ffd890'; ctx.fill(); }
        // curtain hint
        const g = ctx.createLinearGradient(0, -h / 2, 0, -h / 2 + 14);
        g.addColorStop(0, '#5c0f18'); g.addColorStop(1, 'rgba(92,15,24,0)');
        ctx.fillStyle = g; ctx.fillRect(-w / 2, -h / 2, w, 14);
      });
      break;
    case 'sofa':
      local(ctx, f, (w, h) => {
        const col = VELVET[v % 3];
        drop(ctx);
        rr(ctx, -w / 2, -h / 2, w, h, 8); litFill(ctx, shade(col, -0.2), -w / 2, -h / 2, w, h);
        noDrop(ctx);
        // backrest
        rr(ctx, -w / 2 + 2, -h / 2 + 1, w - 4, h * 0.32, 6); litFill(ctx, shade(col, 0.05), -w / 2, -h / 2, w, h * 0.32);
        // tufting
        ctx.fillStyle = shade(col, -0.45);
        for (let x = -w / 2 + 10; x < w / 2 - 6; x += 9) { ellipse(ctx, x, -h / 2 + h * 0.17, 0.9, 0.9); ctx.fill(); }
        // arms
        rr(ctx, -w / 2, -h / 2 + 2, 8, h - 3, 4); litFill(ctx, col, -w / 2, -h / 2, 8, h);
        rr(ctx, w / 2 - 8, -h / 2 + 2, 8, h - 3, 4); litFill(ctx, col, w / 2 - 8, -h / 2, 8, h);
        const n = Math.max(2, Math.round((w - 16) / 34));
        const cw = (w - 18) / n;
        for (let i = 0; i < n; i++) cushion(ctx, -w / 2 + 9 + i * cw, -h / 2 + h * 0.34, cw - 1.5, h * 0.6, col, 5);
        // throw pillow
        ctx.save(); ctx.translate(-w / 2 + 16, -h / 2 + h * 0.4); ctx.rotate(0.3); cushion(ctx, -5, -4, 10, 8, '#c9a45c', 2); ctx.restore();
      });
      break;
    case 'armchair':
      local(ctx, f, (w, h) => {
        const col = VELVET[v % 3];
        drop(ctx);
        rr(ctx, -w / 2, -h / 2, w, h, 9); litFill(ctx, shade(col, -0.25), -w / 2, -h / 2, w, h);
        noDrop(ctx);
        rr(ctx, -w / 2 + 2, -h / 2 + 1, w - 4, h * 0.34, 7); litFill(ctx, col, -w / 2, -h / 2, w, h * 0.34);
        rr(ctx, -w / 2, -h / 2 + 4, 7, h - 6, 4); litFill(ctx, col, -w / 2, -h / 2, 7, h);
        rr(ctx, w / 2 - 7, -h / 2 + 4, 7, h - 6, 4); litFill(ctx, col, w / 2 - 7, -h / 2, 7, h);
        cushion(ctx, -w / 2 + 7.5, -h / 2 + h * 0.36, w - 15, h * 0.56, shade(col, 0.06), 5);
      });
      break;
    case 'coffeeTable':
      local(ctx, f, (w, h) => {
        drop(ctx, 8, 3);
        rr(ctx, -w / 2, -h / 2, w, h, v ? w / 2 : 4);
        if (v) { radialFill(ctx, '#2a1a12', 0, 0, w / 2); } else litFill(ctx, '#2a1a12', -w / 2, -h / 2, w, h);
        noDrop(ctx);
        // glass / marble inset
        rr(ctx, -w / 2 + 4, -h / 2 + 4, w - 8, h - 8, v ? w / 2 : 2);
        const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
        g.addColorStop(0, 'rgba(220,215,205,0.9)'); g.addColorStop(0.5, 'rgba(180,170,160,0.9)'); g.addColorStop(1, 'rgba(140,130,120,0.9)');
        ctx.fillStyle = g; ctx.fill();
        // decor: books + vase
        rr(ctx, -w * 0.25, -h * 0.15, 12, 8, 1); ctx.fillStyle = '#3a4a5c'; ctx.fill();
        rr(ctx, -w * 0.25 + 1, -h * 0.15 - 2, 11, 7, 1); ctx.fillStyle = '#7a2c2c'; ctx.fill();
        ellipse(ctx, w * 0.2, 0, 3.5, 3.5); radialFill(ctx, '#d9d2c2', w * 0.2, 0, 4);
      });
      break;
    case 'roundTable':
      {
        const cx = f.x + f.w / 2, cy = f.y + f.h / 2, R = f.w / 2;
        const cloth = ['#e8e2d4', '#d9cfbd', '#efe9de'][v % 3];
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + 0.3;
          chairTop(ctx, cx + Math.cos(a) * (R * 0.82), cy + Math.sin(a) * (R * 0.82), a + Math.PI / 2, '#7a1e2a', '#c9a45c');
        }
        drop(ctx, 10, 4);
        ellipse(ctx, cx, cy, R * 0.62, R * 0.62); radialFill(ctx, cloth, cx, cy, R * 0.66, 0.15, -0.25);
        noDrop(ctx);
        ellipse(ctx, cx, cy, R * 0.6, R * 0.6); stroke(ctx, 'rgba(160,140,110,0.6)', 0.8);
        // place settings
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + 0.3;
          ellipse(ctx, cx + Math.cos(a) * R * 0.45, cy + Math.sin(a) * R * 0.45, 4, 4); ctx.fillStyle = '#fbfaf6'; ctx.fill(); stroke(ctx, '#c9b98f', 0.5);
          ellipse(ctx, cx + Math.cos(a + 0.25) * R * 0.38, cy + Math.sin(a + 0.25) * R * 0.38, 1.4, 1.4); ctx.fillStyle = 'rgba(200,220,240,0.8)'; ctx.fill();
        }
        // centrepiece with candle
        ellipse(ctx, cx, cy, 6, 6); radialFill(ctx, '#6e2a3a', cx, cy, 7);
        for (let i = 0; i < 6; i++) { const a = i; ellipse(ctx, cx + Math.cos(a) * 4, cy + Math.sin(a) * 4, 2.2, 2.2); ctx.fillStyle = '#c9425a'; ctx.fill(); }
        ellipse(ctx, cx, cy, 1.6, 1.6); ctx.fillStyle = '#ffe2a0'; ctx.fill();
      }
      break;
    case 'diningTable':
      local(ctx, f, (w, h) => {
        const wood = WOOD[v % 3];
        const chairs: [number, number, number][] = w > h * 1.4
          ? [[-w / 4, -h / 2 - 5, 0], [w / 4, -h / 2 - 5, 0], [-w / 4, h / 2 + 5, Math.PI], [w / 4, h / 2 + 5, Math.PI]]
          : [[0, -h / 2 - 5, 0], [0, h / 2 + 5, Math.PI], [-w / 2 - 5, 0, -Math.PI / 2], [w / 2 + 5, 0, Math.PI / 2]];
        for (const [x, y, a] of chairs) chairTop(ctx, x, y, a + Math.PI, '#5c1d26', '#3a2316');
        drop(ctx, 9, 4);
        rr(ctx, -w / 2, -h / 2, w, h, 3); ctx.fillStyle = wood; ctx.fill();
        noDrop(ctx);
        woodGrain(ctx, -w / 2, -h / 2, w, h, wood, f.id);
        rr(ctx, -w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 2); ctx.fillStyle = 'rgba(240,235,225,0.85)'; ctx.fill();
        ellipse(ctx, 0, 0, 3, 3); ctx.fillStyle = '#ffe2a0'; ctx.fill();
        for (const [x, y] of chairs) { ellipse(ctx, x * 0.55, y * 0.5, 3.4, 3.4); ctx.fillStyle = '#fbfaf6'; ctx.fill(); stroke(ctx, '#c9b98f', 0.4); }
      });
      break;
    case 'banquetTable':
      local(ctx, f, (w, h) => {
        const n = Math.floor(w / 34);
        for (let i = 0; i < n; i++) {
          const x = -w / 2 + 17 + i * ((w - 34) / (n - 1));
          chairTop(ctx, x, -h / 2 - 6, Math.PI, '#6b1a26', '#3a2316');
          chairTop(ctx, x, h / 2 + 6, 0, '#6b1a26', '#3a2316');
        }
        chairTop(ctx, -w / 2 - 6, 0, Math.PI / 2, '#6b1a26', '#3a2316');
        chairTop(ctx, w / 2 + 6, 0, -Math.PI / 2, '#6b1a26', '#3a2316');
        drop(ctx, 12, 5);
        rr(ctx, -w / 2, -h / 2, w, h, 4); litFill(ctx, LINEN, -w / 2, -h / 2, w, h, 0.1, -0.2);
        noDrop(ctx);
        ctx.fillStyle = 'rgba(120,20,30,0.85)'; ctx.fillRect(-w / 2, -6, w, 12);
        for (let i = 0; i < n; i++) {
          const x = -w / 2 + 17 + i * ((w - 34) / (n - 1));
          for (const s of [-1, 1]) { ellipse(ctx, x, s * h * 0.3, 4.5, 4.5); ctx.fillStyle = '#fdfcf8'; ctx.fill(); stroke(ctx, '#c9b98f', 0.5); }
        }
        for (let x = -w / 2 + 40; x < w / 2 - 20; x += 64) { ellipse(ctx, x, 0, 2.5, 2.5); ctx.fillStyle = '#ffe2a0'; ctx.fill(); ellipse(ctx, x, 0, 5, 5); stroke(ctx, '#c9a45c', 1); }
      });
      break;
    case 'booth':
      local(ctx, f, (w, h) => {
        drop(ctx);
        rr(ctx, -w / 2, -h / 2, w, h, 5); litFill(ctx, '#3a2316', -w / 2, -h / 2, w, h);
        noDrop(ctx);
        // U-shaped bench around a small table (opening faces +y => rotated per facing)
        cushion(ctx, -w / 2 + 2, -h / 2 + 2, w - 4, 12, '#6b1a26', 5);
        cushion(ctx, -w / 2 + 2, h / 2 - 14, w - 4, 12, '#6b1a26', 5);
        rr(ctx, -w / 2 + 6, -h / 2 + 18, w - 14, h - 36, 3); litFill(ctx, '#2a1a12', -w / 2, -h / 2 + 18, w, h - 36);
        ellipse(ctx, 0, 0, 3, 3); ctx.fillStyle = '#ffe2a0'; ctx.fill();
        ellipse(ctx, -6, -8, 3.4, 3.4); ctx.fillStyle = '#fbfaf6'; ctx.fill();
        ellipse(ctx, 6, 8, 3.4, 3.4); ctx.fillStyle = '#fbfaf6'; ctx.fill();
      });
      break;
    case 'plant':
      plant(ctx, f.x + f.w / 2, f.y + f.h / 2, f.w * 0.75, v);
      break;
    case 'fountain': {
      const cx = f.x + f.w / 2, cy = f.y + f.h / 2, R = f.w / 2;
      drop(ctx, 18, 6, 0.6);
      ellipse(ctx, cx, cy, R, R); radialFill(ctx, '#a39886', cx, cy, R, 0.3, -0.45);
      noDrop(ctx);
      ellipse(ctx, cx, cy, R * 0.86, R * 0.86);
      const wg = ctx.createRadialGradient(cx - R * 0.2, cy - R * 0.2, 4, cx, cy, R * 0.86);
      wg.addColorStop(0, '#3b6e86'); wg.addColorStop(0.7, '#1d3d55'); wg.addColorStop(1, '#0f2233');
      ctx.fillStyle = wg; ctx.fill();
      ctx.strokeStyle = 'rgba(190,230,255,0.25)'; ctx.lineWidth = 1;
      for (let r = 10; r < R * 0.8; r += 9) { ellipse(ctx, cx, cy, r, r); ctx.stroke(); }
      ellipse(ctx, cx, cy, R * 0.3, R * 0.3); radialFill(ctx, '#b8ad99', cx, cy, R * 0.32, 0.35, -0.4);
      ellipse(ctx, cx, cy, R * 0.16, R * 0.16); radialFill(ctx, '#c9a45c', cx, cy, R * 0.18, 0.4, -0.3);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ellipse(ctx, cx + Math.cos(a) * R * 0.93, cy + Math.sin(a) * R * 0.93, 3, 3); ctx.fillStyle = '#c9a45c'; ctx.fill(); }
      break;
    }
    case 'receptionDesk':
      local(ctx, f, (w, h) => {
        drop(ctx, 12, 5);
        rr(ctx, -w / 2, -h / 2, w, h, 3); ctx.fillStyle = '#2b1a10'; ctx.fill();
        noDrop(ctx);
        woodGrain(ctx, -w / 2, -h / 2, w, h, '#3a2416', f.id, w < h);
        // marble top band
        rr(ctx, -w / 2 + 2, -h / 2 + 2, w - 4, h - 4, 2);
        const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
        g.addColorStop(0, '#d8d0c2'); g.addColorStop(0.5, '#efe8dc'); g.addColorStop(1, '#c9bfae');
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = 'rgba(120,100,80,0.35)'; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(-w / 2 + 8, -h / 4); ctx.bezierCurveTo(-w / 6, h / 3, w / 6, -h / 3, w / 2 - 6, h / 5); ctx.stroke();
        rr(ctx, -w / 2, -h / 2, w, h, 3); stroke(ctx, '#c9a45c', 1.2);
        if (v === 0) {
          for (let y = -h / 2 + 30; y < h / 2 - 20; y += 90) { monitor(ctx, -6, y, 14, '#5aa0ff'); ellipse(ctx, 4, y + 30, 3, 3); radialFill(ctx, '#c9a45c', 4, y + 30, 3.5); }
        }
      });
      break;
    case 'barCounter':
      local(ctx, f, (w, h) => {
        drop(ctx, 12, 5);
        rr(ctx, -w / 2, -h / 2, w, h, h / 2); ctx.fillStyle = '#2b1a10'; ctx.fill();
        noDrop(ctx);
        woodGrain(ctx, -w / 2, -h / 2, w, h, '#4a2c18', 77);
        rr(ctx, -w / 2 + 2, -h / 2 + 2, w - 4, h - 4, h / 2); stroke(ctx, '#d4b06a', 1.5);
        // bottles & glasses
        for (let x = -w / 2 + 14; x < w / 2 - 10; x += 13) {
          const c = ['#2f6a3c', '#7a3d1c', '#c9c2a0', '#3b2a5c'][Math.floor(hash(x, 1) * 4)];
          ellipse(ctx, x, -h * 0.15, 2.4, 2.4); radialFill(ctx, c, x, -h * 0.15, 3, 0.5, -0.3);
          if (hash(x, 2) > 0.5) { ellipse(ctx, x + 5, h * 0.18, 2, 2); ctx.fillStyle = 'rgba(210,230,250,0.7)'; ctx.fill(); }
        }
      });
      break;
    case 'barStools':
      local(ctx, f, (w) => {
        for (let x = -w / 2 + 12; x < w / 2; x += 30) { drop(ctx, 4, 2); ellipse(ctx, x, 0, 6, 6); radialFill(ctx, '#6b1a26', x, 0, 6.5); noDrop(ctx); ellipse(ctx, x, 0, 6, 6); stroke(ctx, '#c9a45c', 1); }
      });
      break;
    case 'counter':
    case 'stove':
    case 'sink':
      local(ctx, f, (w, h) => {
        drop(ctx, 10, 4);
        rr(ctx, -w / 2, -h / 2, w, h, 2);
        const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
        g.addColorStop(0, '#9aa1a8'); g.addColorStop(0.5, '#6f767d'); g.addColorStop(1, '#4b5157');
        ctx.fillStyle = g; ctx.fill();
        noDrop(ctx);
        ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 0.6;
        for (let x = -w / 2; x < w / 2; x += 2.5) { ctx.beginPath(); ctx.moveTo(x, -h / 2); ctx.lineTo(x, h / 2); ctx.stroke(); }
        rr(ctx, -w / 2, -h / 2, w, h, 2); stroke(ctx, '#2c3034', 1.2);
        if (f.type === 'stove') {
          for (let x = -w / 2 + 16; x < w / 2; x += 32)
            for (const y of [-h / 4, h / 4]) {
              ellipse(ctx, x, y, 7, 7); ctx.fillStyle = '#16181a'; ctx.fill();
              ellipse(ctx, x, y, 4.5, 4.5); stroke(ctx, '#3a3e42', 1.4);
            }
          ellipse(ctx, -w / 2 + 48, -h / 4, 9, 9); radialFill(ctx, '#8d9399', -w / 2 + 48, -h / 4, 9.5, 0.4, -0.4);
        } else if (f.type === 'sink') {
          for (let y = -h / 2 + 22; y < h / 2 - 10; y += 44) { rr(ctx, -w / 2 + 6, y - 14, w - 12, 28, 6); ctx.fillStyle = '#3d4247'; ctx.fill(); stroke(ctx, '#adb3b8', 1); ellipse(ctx, 0, y, 1.6, 1.6); ctx.fillStyle = '#111'; ctx.fill(); }
        } else {
          // prep items
          for (let i = 0; i < Math.floor(w / 40); i++) {
            const x = -w / 2 + 20 + i * 40, y = (hash(i, f.id) - 0.5) * h * 0.4;
            if (hash(i, 2, f.id) > 0.5) { rr(ctx, x - 9, y - 6, 18, 12, 2); woodGrain(ctx, x - 9, y - 6, 18, 12, '#8a6440', i); }
            else { ellipse(ctx, x, y, 7, 7); radialFill(ctx, '#b9bfc4', x, y, 7.5, 0.4, -0.4); ellipse(ctx, x, y, 5, 5); ctx.fillStyle = '#4b5157'; ctx.fill(); }
          }
        }
      });
      break;
    case 'fridge':
    case 'locker':
    case 'serverRack':
    case 'vending':
    case 'monitorWall':
    case 'cabinet':
    case 'safe':
      local(ctx, f, (w, h) => {
        const base = f.type === 'locker' ? '#4a5560' : f.type === 'cabinet' ? (v ? '#3a2416' : '#4b4f55') : f.type === 'vending' ? '#7a1e2a' : f.type === 'safe' ? '#2f3338' : f.type === 'monitorWall' ? '#141518' : f.type === 'serverRack' ? '#1a1c20' : '#a9afb4';
        drop(ctx, 12, 5, 0.65);
        rr(ctx, -w / 2, -h / 2, w, h, 2); litFill(ctx, base, -w / 2, -h / 2, w, h, 0.25, -0.4);
        noDrop(ctx);
        rr(ctx, -w / 2, -h / 2, w, h, 2); stroke(ctx, shade(base, -0.5), 1.2);
        if (f.type === 'locker') {
          for (let x = -w / 2; x < w / 2; x += 16) {
            ctx.strokeStyle = shade(base, -0.45); ctx.lineWidth = 1; ctx.strokeRect(x + 1, -h / 2 + 1, 14, h - 2);
            for (let k = 0; k < 3; k++) ctx.fillRect(x + 4 + k * 3, -h / 2 + 4, 1.6, 0.8);
          }
        } else if (f.type === 'serverRack') {
          for (let y = -h / 2 + 4; y < h / 2 - 2; y += 5) {
            ctx.fillStyle = '#25282d'; ctx.fillRect(-w / 2 + 3, y, w - 6, 3.6);
            ctx.fillStyle = hash(y, 3, f.id) > 0.4 ? '#4dff9a' : '#ffb347'; ctx.fillRect(w / 2 - 7, y + 1.2, 1.4, 1.2);
          }
        } else if (f.type === 'monitorWall') {
          for (let x = -w / 2 + 3; x < w / 2 - 6; x += 32) {
            rr(ctx, x, -h / 2 + 3, 29, h - 6, 1.5); ctx.fillStyle = '#0d1a2c'; ctx.fill();
            const g = ctx.createLinearGradient(x, 0, x + 29, 0);
            g.addColorStop(0, 'rgba(70,140,230,0.7)'); g.addColorStop(1, 'rgba(40,90,170,0.5)');
            ctx.fillStyle = g; ctx.fillRect(x + 1.5, -h / 2 + 4.5, 26, h - 9);
          }
        } else if (f.type === 'vending') {
          rr(ctx, -w / 2 + 4, -h / 2 + 5, w - 8, h * 0.6, 2); ctx.fillStyle = 'rgba(160,220,255,0.6)'; ctx.fill();
          for (let y = -h / 2 + 10; y < h * 0.1; y += 8) for (let x = -w / 2 + 7; x < w / 2 - 5; x += 6) { ctx.fillStyle = ['#e04848', '#e0c048', '#48a0e0'][Math.floor(hash(x, y) * 3)]; ctx.fillRect(x, y, 3.5, 4); }
        } else if (f.type === 'safe') {
          ellipse(ctx, 0, 0, w * 0.22, w * 0.22); radialFill(ctx, '#8d9399', 0, 0, w * 0.24, 0.4, -0.4);
          for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * w * 0.08, Math.sin(a) * w * 0.08); ctx.lineTo(Math.cos(a) * w * 0.2, Math.sin(a) * w * 0.2); stroke(ctx, '#3a3e42', 0.8); }
        } else if (f.type === 'cabinet') {
          for (let x = -w / 2 + 4; x < w / 2 - 4; x += 16) { ctx.fillStyle = '#c9a45c'; ctx.fillRect(x + 4, -1, 6, 1.6); }
          if (!v) { ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(-w / 2 + 2, -h / 2 + 2, w - 4, 2); }
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-w / 2 + 3, -h / 2 + 3, 2, h - 6);
          ctx.fillStyle = '#5a6066'; ctx.fillRect(w / 2 - 6, -h * 0.25, 2, h * 0.5);
        }
      });
      break;
    case 'shelf':
      local(ctx, f, (w, h) => {
        drop(ctx, 12, 5, 0.65);
        rr(ctx, -w / 2, -h / 2, w, h, 1.5); litFill(ctx, '#5b6068', -w / 2, -h / 2, w, h, 0.25, -0.4);
        noDrop(ctx);
        const vertical = h > w;
        const len = vertical ? h : w;
        for (let i = 0; i < len - 6; i += 10) {
          const s = 5 + hash(i, f.id) * 4;
          const kind = hash(i, 2, f.id);
          const col = kind > 0.66 ? '#e8e2d6' : kind > 0.33 ? '#8a6a44' : '#a8b4c0';
          const [x, y, ww, hh] = vertical ? [-w / 2 + 4, -h / 2 + 3 + i, w - 8, s] : [-w / 2 + 3 + i, -h / 2 + 4, s, h - 8];
          rr(ctx, x, y, ww, hh, 1); litFill(ctx, col, x, y, ww, hh, 0.2, -0.35);
        }
      });
      break;
    case 'crates':
      local(ctx, f, (w, h) => {
        const parts: [number, number, number, number][] = [[-w / 2, -h / 2, w * 0.55, h * 0.55], [-w / 2 + w * 0.5, -h / 2 + h * 0.1, w * 0.5, h * 0.45], [-w / 2 + w * 0.15, -h / 2 + h * 0.55, w * 0.6, h * 0.45]];
        for (const [x, y, ww, hh] of parts) {
          drop(ctx, 8, 3, 0.6);
          rr(ctx, x, y, ww, hh, 1.5); ctx.fillStyle = v ? '#8a6a44' : '#a07a4a'; ctx.fill();
          noDrop(ctx);
          woodGrain(ctx, x, y, ww, hh, v ? '#8a6a44' : '#a07a4a', x + y);
          ctx.strokeStyle = 'rgba(40,25,10,0.7)'; ctx.lineWidth = 1.2; ctx.strokeRect(x + 1.5, y + 1.5, ww - 3, hh - 3);
          ctx.beginPath(); ctx.moveTo(x + 2, y + 2); ctx.lineTo(x + ww - 2, y + hh - 2); ctx.stroke();
        }
      });
      break;
    case 'desk':
      local(ctx, f, (w, h) => {
        drop(ctx, 10, 4);
        rr(ctx, -w / 2, -h / 2, w, h, 2); ctx.fillStyle = WOOD[1]; ctx.fill();
        noDrop(ctx);
        woodGrain(ctx, -w / 2, -h / 2, w, h, v === 2 ? '#2b2f36' : WOOD[1], f.id);
        const nm = Math.max(1, Math.floor(w / 46));
        for (let i = 0; i < nm; i++) monitor(ctx, -w / 2 + 8 + i * (w - 16) / nm, -h / 2 + 3, Math.min(22, (w - 16) / nm - 4), v === 2 ? '#3dbb88' : '#4a8ee0');
        rr(ctx, -w / 2 + 10, h / 2 - 12, 14, 9, 1); ctx.fillStyle = '#f0ece2'; ctx.fill();
        rr(ctx, w / 2 - 22, h / 2 - 11, 12, 6, 1); ctx.fillStyle = '#26272b'; ctx.fill();
        // chair
        chairTop(ctx, 0, h / 2 + 9, 0, '#26272b', '#1a1a1c');
      });
      break;
    case 'piano':
      local(ctx, f, (w, h) => {
        drop(ctx, 14, 5, 0.65);
        ctx.beginPath();
        ctx.moveTo(-w / 2, -h / 2);
        ctx.lineTo(w / 2 - 6, -h / 2);
        ctx.lineTo(w / 2 - 6, -h / 2 + h * 0.25);
        ctx.bezierCurveTo(w / 2, h * 0.1, w * 0.1, h / 2, -w * 0.15, h / 2);
        ctx.lineTo(-w / 2, h / 2);
        ctx.closePath();
        const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
        g.addColorStop(0, '#3a3a40'); g.addColorStop(0.4, '#0d0d10'); g.addColorStop(1, '#1d1d22');
        ctx.fillStyle = g; ctx.fill();
        noDrop(ctx);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 0.8; ctx.stroke();
        // keys
        ctx.fillStyle = '#f2efe6'; ctx.fillRect(-w / 2 + 2, -h / 2 + 2, w - 12, 6);
        ctx.fillStyle = '#111'; for (let x = -w / 2 + 4; x < w / 2 - 12; x += 3.2) ctx.fillRect(x, -h / 2 + 2, 1.4, 3.6);
        ctx.beginPath(); ctx.moveTo(-w / 2 + 6, -h / 2 + 12); ctx.lineTo(w * 0.15, h * 0.3); stroke(ctx, 'rgba(255,255,255,0.15)', 1);
      });
      break;
    case 'luggageCart':
    case 'laundryCart':
      local(ctx, f, (w, h) => {
        drop(ctx, 10, 4);
        rr(ctx, -w / 2, -h / 2, w, h, 3); ctx.fillStyle = f.type === 'luggageCart' ? '#3a2416' : '#50565e'; ctx.fill();
        noDrop(ctx);
        if (f.type === 'luggageCart') {
          const cols = ['#5a3a28', '#2c3e50', '#6b1a26'];
          for (let i = 0; i < 3; i++) { rr(ctx, -w / 2 + 4 + i * (w - 8) / 3, -h / 2 + 4, (w - 8) / 3 - 2, h - 8, 2); litFill(ctx, cols[i], -w / 2, -h / 2, w, h); }
          rr(ctx, -w / 2, -h / 2, w, h, 3); stroke(ctx, '#d4b06a', 2);
        } else {
          rr(ctx, -w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 2); ctx.fillStyle = '#e6e2da'; ctx.fill();
          for (let i = 0; i < 5; i++) { ellipse(ctx, -w / 2 + 8 + hash(i, f.id) * (w - 16), -h / 2 + 7 + hash(i, 2, f.id) * (h - 14), 6, 4); ctx.fillStyle = '#f7f5f0'; ctx.fill(); stroke(ctx, '#cfc9bd', 0.5); }
        }
      });
      break;
    case 'console':
    case 'sideboard':
    case 'buffet':
    case 'hostStand':
    case 'bench':
      local(ctx, f, (w, h) => {
        drop(ctx, 9, 4);
        if (f.type === 'bench') {
          rr(ctx, -w / 2, -h / 2, w, h, 5); litFill(ctx, '#6b1a26', -w / 2, -h / 2, w, h);
          noDrop(ctx);
          ctx.fillStyle = 'rgba(0,0,0,0.35)'; for (let x = -w / 2 + 8; x < w / 2 - 4; x += 10) { ellipse(ctx, x, 0, 0.9, 0.9); ctx.fill(); }
          rr(ctx, -w / 2, -h / 2, w, h, 5); stroke(ctx, '#c9a45c', 1);
          return;
        }
        rr(ctx, -w / 2, -h / 2, w, h, 2); ctx.fillStyle = WOOD[0]; ctx.fill();
        noDrop(ctx);
        if (f.type === 'buffet') {
          rr(ctx, -w / 2, -h / 2, w, h, 2); litFill(ctx, LINEN, -w / 2, -h / 2, w, h, 0.1, -0.2);
          for (let x = -w / 2 + 14; x < w / 2 - 6; x += 30) { rr(ctx, x - 9, -h / 4, 18, h / 2, 3); ctx.fillStyle = '#b9bfc4'; ctx.fill(); stroke(ctx, '#7a8086', 0.6); }
          return;
        }
        woodGrain(ctx, -w / 2, -h / 2, w, h, WOOD[f.type === 'hostStand' ? 2 : 0], f.id);
        rr(ctx, -w / 2, -h / 2, w, h, 2); stroke(ctx, '#c9a45c', 0.8);
        if (f.type === 'console') {
          // table lamp + vase
          const lx = -w / 4;
          ellipse(ctx, lx, 0, 6, 6); radialFill(ctx, '#e8dcc0', lx, 0, 6.5, 0.4, -0.2);
          ellipse(ctx, w / 4, 0, 4, 4); radialFill(ctx, '#2c4a6b', w / 4, 0, 4.5);
          for (let i = 0; i < 5; i++) { ellipse(ctx, w / 4 + Math.cos(i * 1.3) * 3.5, Math.sin(i * 1.3) * 3.5, 1.8, 1.8); ctx.fillStyle = '#e8e2d6'; ctx.fill(); }
        } else if (f.type === 'hostStand') {
          rr(ctx, -w / 4, -h / 4, w / 2, h / 2, 1); ctx.fillStyle = '#f0ece2'; ctx.fill();
        }
      });
      break;
    default:
      rr(ctx, f.x, f.y, f.w, f.h, 3);
      litFill(ctx, '#4a3a2e', f.x, f.y, f.w, f.h);
  }
  ctx.restore();
}
