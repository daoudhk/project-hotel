import Phaser from 'phaser';
import type { WeaponId } from '../data/weapons';
import { canvas, Ctx, ellipse, grain, hash, litFill, radialFill, rr, shade, stroke } from './paint';

/** Resolution multiplier for sprites so they stay crisp when the camera zooms in. */
export const RES = 3;

export type Faction = 'AT' | 'GUARD';

export interface Palette {
  sleeve: string; vest: string; pouch: string; head: string; accent: string; glove: string; skin: string; trim: string;
}
export const PALETTES: Record<Faction, Palette> = {
  AT: { sleeve: '#2e353e', vest: '#3e4855', pouch: '#525c6a', head: '#3f4639', accent: '#6fb2e0', glove: '#1b1d20', skin: '#c79a7e', trim: '#20252c' },
  GUARD: { sleeve: '#26262b', vest: '#2f2829', pouch: '#3b3334', head: '#141417', accent: '#b8323c', glove: '#121214', skin: '#b58468', trim: '#18171a' },
};
const HOSTAGE_SHIRTS = ['#d9d4ca', '#7d8ba3', '#a77653'];
const HOSTAGE_HAIR = ['#2b1e16', '#6b4a2e', '#c4ad82'];

function add(scene: Phaser.Scene, key: string, c: HTMLCanvasElement) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, c);
}

/** Make a canvas measured in world units (w x h) with origin translated to (ox, oy). */
function sprite(w: number, h: number, ox: number, oy: number, draw: (ctx: Ctx) => void, res = RES): HTMLCanvasElement {
  const [c, ctx] = canvas(w * res, h * res);
  ctx.scale(res, res);
  ctx.translate(ox, oy);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  draw(ctx);
  return c;
}

// ------------------------------------------------------------------ characters
function drawTorso(ctx: Ctx, p: Palette, faction: Faction) {
  // soft contact shadow
  ctx.save();
  ctx.filter = 'blur(2px)';
  ellipse(ctx, 1, 1.5, 11, 16.5);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fill();
  ctx.restore();
  // shoulders / upper arms base
  ellipse(ctx, 0, 0, 9.5, 15.5);
  radialFill(ctx, p.sleeve, 0, 0, 16, 0.22, -0.45);
  // shoulder caps
  for (const s of [-1, 1]) {
    ellipse(ctx, 0.5, s * 11.5, 5.5, 4.6);
    radialFill(ctx, p.sleeve, 0.5, s * 11.5, 6, 0.3, -0.35);
  }
  // back panel (radio / hydration)
  rr(ctx, -10, -6, 5, 12, 2);
  litFill(ctx, p.pouch, -10, -6, 5, 12, 0.1, -0.4);
  if (faction === 'AT') {
    // antenna
    ctx.beginPath(); ctx.moveTo(-8, -5); ctx.lineTo(-13, -9); stroke(ctx, '#111', 0.8);
  }
  // vest / plate carrier
  rr(ctx, -7.5, -9.5, 15, 19, 4);
  litFill(ctx, p.vest, -7.5, -9.5, 15, 19, 0.2, -0.35);
  stroke(ctx, shade(p.vest, -0.45), 0.6);
  // stitched MOLLE rows
  ctx.strokeStyle = shade(p.vest, -0.3);
  ctx.lineWidth = 0.4;
  for (let i = -6; i <= 6; i += 2.4) {
    ctx.beginPath(); ctx.moveTo(-5.5, i); ctx.lineTo(-1, i); ctx.stroke();
  }
  // front magazine pouches
  for (let i = 0; i < 3; i++) {
    const y = -7.2 + i * 5;
    rr(ctx, 3.5, y, 5, 4.2, 1);
    litFill(ctx, p.pouch, 3.5, y, 5, 4.2, 0.25, -0.35);
    ctx.fillStyle = shade(p.pouch, -0.35);
    ctx.fillRect(6.6, y + 0.4, 0.6, 3.4);
  }
  // shoulder straps
  for (const s of [-1, 1]) {
    rr(ctx, -6, s * 7.5 - 1.6, 11, 3.2, 1.4);
    litFill(ctx, shade(p.vest, -0.12), -6, s * 7.5 - 1.6, 11, 3.2);
  }
  // team accents
  if (faction === 'AT') {
    rr(ctx, -2.5, 11.4, 4.5, 2.6, 0.6); ctx.fillStyle = p.accent; ctx.fill();
    rr(ctx, -2.5, -14, 4.5, 2.6, 0.6); ctx.fillStyle = p.accent; ctx.fill();
  } else {
    ctx.save();
    ellipse(ctx, 0.5, -11.5, 5.6, 4.7); ctx.clip();
    ctx.fillStyle = p.accent; ctx.fillRect(-1.6, -17, 3.2, 12);
    ctx.restore();
  }
  // collar
  ellipse(ctx, 1, 0, 4.5, 5.5);
  ctx.fillStyle = shade(p.trim, 0.05);
  ctx.fill();
}

function drawHead(ctx: Ctx, p: Palette, faction: Faction) {
  if (faction === 'AT') {
    // ear protection
    for (const s of [-1, 1]) { ellipse(ctx, 0, s * 6.2, 2.6, 2); radialFill(ctx, '#2a2d27', 0, s * 6.2, 3); }
    ellipse(ctx, 0, 0, 7, 6.6);
    radialFill(ctx, p.head, 0, 0, 7.5, 0.3, -0.45);
    // helmet seam & rails
    ctx.beginPath(); ctx.arc(0, 0, 5, -1.2, 1.2); stroke(ctx, shade(p.head, -0.35), 0.5);
    ctx.fillStyle = shade(p.head, -0.3);
    ctx.fillRect(-4, -6.3, 7, 0.9); ctx.fillRect(-4, 5.4, 7, 0.9);
    // NVG mount
    rr(ctx, 5, -1.6, 2.8, 3.2, 0.8); litFill(ctx, '#1d1f22', 5, -1.6, 2.8, 3.2);
    // strobe
    ellipse(ctx, -4.6, 0, 1.1, 1.1); ctx.fillStyle = '#7fc6ff'; ctx.fill();
  } else {
    ellipse(ctx, 0.3, 0, 6.3, 6.1);
    radialFill(ctx, p.head, 0, 0, 7, 0.22, -0.3);
    // eye opening (front)
    rr(ctx, 3.6, -3, 2.4, 6, 1.2);
    ctx.fillStyle = p.skin; ctx.fill();
    ctx.fillStyle = '#0b0b0c'; ctx.fillRect(5.1, -2.2, 0.8, 1.4); ctx.fillRect(5.1, 0.8, 0.8, 1.4);
    // knit texture
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 0.4;
    for (let i = -5; i < 4; i += 1.4) { ctx.beginPath(); ctx.moveTo(i, -5); ctx.lineTo(i, 5); ctx.stroke(); }
  }
}

function drawArm(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, sleeve: string, w0: number, w1: number) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  const len = Math.hypot(x1 - x0, y1 - y0);
  ctx.save();
  ctx.translate(x0, y0);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.moveTo(0, -w0 / 2);
  ctx.quadraticCurveTo(len * 0.5, -w0 / 2 - 0.6, len, -w1 / 2);
  ctx.lineTo(len, w1 / 2);
  ctx.quadraticCurveTo(len * 0.5, w0 / 2 + 0.6, 0, w0 / 2);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -w0 / 2, 0, w0 / 2);
  g.addColorStop(0, shade(sleeve, 0.25)); g.addColorStop(0.5, sleeve); g.addColorStop(1, shade(sleeve, -0.45));
  ctx.fillStyle = g;
  ctx.fill();
  // elbow fold
  ctx.beginPath(); ctx.moveTo(len * 0.5, -w0 / 2 + 0.6); ctx.lineTo(len * 0.55, w0 / 2 - 0.6); stroke(ctx, shade(sleeve, -0.35), 0.4);
  ctx.restore();
}

function glove(ctx: Ctx, x: number, y: number, color: string) {
  ellipse(ctx, x, y, 2.6, 2.3);
  radialFill(ctx, color, x, y, 3, 0.35, -0.3);
}

// ------------------------------------------------------------------ weapons (top-down)
/** Draws the weapon along +x with the pistol grip at the origin. */
export function drawWeaponTop(ctx: Ctx, id: WeaponId) {
  const steel = '#2a2c30';
  switch (id) {
    case 'pistol': {
      rr(ctx, -3, -2.3, 17, 4.6, 1.2); litFill(ctx, steel, -3, -2.3, 17, 4.6, 0.3, -0.4);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(-1, -1.6, 13, 0.7);
      ctx.fillStyle = '#111'; for (let i = 0; i < 5; i++) ctx.fillRect(-2 + i * 0.9, -2.3, 0.4, 4.6);
      ctx.fillStyle = '#0c0c0d'; ctx.fillRect(13.4, -0.8, 0.8, 1.6);
      break;
    }
    case 'deagle': {
      rr(ctx, -4, -3.2, 23, 6.4, 1.2); litFill(ctx, '#6b6f75', -4, -3.2, 23, 6.4, 0.45, -0.45);
      ctx.beginPath(); ctx.moveTo(4, -3.2); ctx.lineTo(19, -1.6); ctx.lineTo(19, 1.6); ctx.lineTo(4, 3.2); ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill();
      ctx.fillStyle = '#2b2d30'; ctx.fillRect(-3, -3.2, 5, 6.4);
      ctx.fillStyle = '#121212'; ctx.fillRect(18.2, -1, 1, 2);
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(3, -2.4, 14, 0.5);
      break;
    }
    case 'mp5': {
      // retracted stock struts
      ctx.fillStyle = '#1c1d20'; ctx.fillRect(-17, -2.6, 12, 1.1); ctx.fillRect(-17, 1.5, 12, 1.1);
      rr(ctx, -18.5, -3.2, 2.5, 6.4, 0.8); litFill(ctx, '#202125', -18.5, -3.2, 2.5, 6.4);
      rr(ctx, -6, -3, 18, 6, 1.6); litFill(ctx, steel, -6, -3, 18, 6, 0.25, -0.4);
      // cocking tube
      ctx.fillStyle = '#18191b'; ctx.fillRect(-4, -1, 20, 2);
      // handguard
      rr(ctx, 9, -3.8, 11, 7.6, 3.2); litFill(ctx, '#232428', 9, -3.8, 11, 7.6, 0.2, -0.45);
      ctx.strokeStyle = '#121214'; ctx.lineWidth = 0.4;
      for (let i = 11; i < 19; i += 1.6) { ctx.beginPath(); ctx.moveTo(i, -3.2); ctx.lineTo(i, 3.2); ctx.stroke(); }
      rr(ctx, 19.5, -1.3, 6, 2.6, 0.8); litFill(ctx, '#1a1b1d', 19.5, -1.3, 6, 2.6);
      // rear drum sight
      ellipse(ctx, -3, 0, 1.6, 1.6); ctx.fillStyle = '#121214'; ctx.fill();
      break;
    }
    case 'm4': {
      // collapsible stock
      rr(ctx, -22, -3.2, 9, 6.4, 1.5); litFill(ctx, '#26272a', -22, -3.2, 9, 6.4, 0.2, -0.4);
      ctx.fillStyle = '#18191b'; ctx.fillRect(-14, -1.2, 7, 2.4);
      rr(ctx, -8, -3, 21, 6, 1); litFill(ctx, '#2f3134', -8, -3, 21, 6, 0.2, -0.4);
      // charging handle
      ctx.fillStyle = '#18191b'; ctx.fillRect(-9, -1.6, 2, 3.2);
      // optic
      rr(ctx, -1, -2.6, 8, 5.2, 1.4); litFill(ctx, '#1b1c1f', -1, -2.6, 8, 5.2, 0.3, -0.3);
      ellipse(ctx, 6.6, 0, 0.9, 1.8); ctx.fillStyle = '#5ad3ff'; ctx.globalAlpha = 0.7; ctx.fill(); ctx.globalAlpha = 1;
      // rail handguard
      rr(ctx, 13, -3.4, 18, 6.8, 1.2); litFill(ctx, '#2a2c2f', 13, -3.4, 18, 6.8, 0.2, -0.45);
      ctx.fillStyle = '#17181a';
      for (let i = 14; i < 30; i += 2) ctx.fillRect(i, -0.6, 1, 1.2);
      rr(ctx, 31, -1.2, 7, 2.4, 0.6); litFill(ctx, '#1d1e20', 31, -1.2, 7, 2.4);
      rr(ctx, 37.5, -1.8, 3.4, 3.6, 0.8); litFill(ctx, '#151617', 37.5, -1.8, 3.4, 3.6);
      break;
    }
  }
}

const RIG = {
  pistol: { grip: [16, 0], right: [16, 1.6], left: [16.6, -1.6], pose: 'pistol' },
  deagle: { grip: [15, 0], right: [15, 1.9], left: [15.8, -1.9], pose: 'pistol' },
  mp5: { grip: [12, 4], right: [12, 4.5], left: [24, 3.6], pose: 'rifle' },
  m4: { grip: [12, 4], right: [12, 4.6], left: [27, 3.8], pose: 'rifle' },
} as const;

function drawRig(ctx: Ctx, p: Palette, w: WeaponId) {
  const r = RIG[w];
  // arms
  drawArm(ctx, 1, 11, r.right[0] - 1.5, r.right[1] + 0.8, p.sleeve, 5.6, 4.2);
  drawArm(ctx, 1, -11, r.left[0] - 1.5, r.left[1] - 0.8, p.sleeve, 5.6, 4.2);
  ctx.save();
  ctx.translate(r.grip[0], r.grip[1]);
  drawWeaponTop(ctx, w);
  ctx.restore();
  glove(ctx, r.right[0], r.right[1], p.glove);
  glove(ctx, r.left[0], r.left[1], p.glove);
}

/** Muzzle tip relative to body centre for each weapon rig (used for flash/flashlight placement). */
export const MUZZLE: Record<WeaponId, [number, number]> = {
  pistol: [30.5, 0], deagle: [34.5, 0], mp5: [37.5, 4], m4: [53, 4],
};

// ------------------------------------------------------------------ hostages
function drawHostageSitting(ctx: Ctx, v: number) {
  const shirt = HOSTAGE_SHIRTS[v % 3], hair = HOSTAGE_HAIR[v % 3];
  ctx.save(); ctx.filter = 'blur(2px)'; ellipse(ctx, 4, 1, 16, 14); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill(); ctx.restore();
  // legs folded forward
  for (const s of [-1, 1]) {
    rr(ctx, 2, s * 4.5 - 3, 15, 6, 3); litFill(ctx, '#2c2f3a', 2, s * 4.5 - 3, 15, 6);
    ellipse(ctx, 17.5, s * 4.5, 3, 2.6); radialFill(ctx, '#151515', 17.5, s * 4.5, 3);
  }
  // arms tied behind
  drawArm(ctx, -1, 11, -9, 2, shirt, 5, 4);
  drawArm(ctx, -1, -11, -9, -2, shirt, 5, 4);
  ellipse(ctx, -9.5, 0, 2.6, 3.6); radialFill(ctx, '#b88c6e', -9.5, 0, 3.4);
  ctx.fillStyle = '#e8e3d0'; ctx.fillRect(-10.2, -3, 1.3, 6);
  // torso
  ellipse(ctx, 0, 0, 8.5, 13.5); radialFill(ctx, shirt, 0, 0, 14, 0.25, -0.4);
  ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-6, 0); stroke(ctx, shade(shirt, -0.25), 0.5);
  ellipse(ctx, 1, 0, 4, 4.5); ctx.fillStyle = shade(shirt, -0.15); ctx.fill();
  // head, slightly bowed
  ellipse(ctx, 1.5, 0, 6, 5.8); radialFill(ctx, hair, 1.5, 0, 6.5, 0.25, -0.35);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 0.4;
  for (let i = -4; i < 5; i += 1.2) { ctx.beginPath(); ctx.moveTo(-3, i); ctx.quadraticCurveTo(2, i * 0.8, 6.5, i * 0.6); ctx.stroke(); }
}

function drawHostageStanding(ctx: Ctx, v: number) {
  const shirt = HOSTAGE_SHIRTS[v % 3], hair = HOSTAGE_HAIR[v % 3];
  ctx.save(); ctx.filter = 'blur(2px)'; ellipse(ctx, 1, 1.5, 10, 15); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill(); ctx.restore();
  drawArm(ctx, 0, 10.5, 9, 7, shirt, 5, 4); drawArm(ctx, 0, -10.5, 9, -7, shirt, 5, 4);
  ellipse(ctx, 9.6, 7, 2.4, 2.2); radialFill(ctx, '#b88c6e', 9.6, 7, 3);
  ellipse(ctx, 9.6, -7, 2.4, 2.2); radialFill(ctx, '#b88c6e', 9.6, -7, 3);
  ellipse(ctx, 0, 0, 8.5, 13.5); radialFill(ctx, shirt, 0, 0, 14, 0.25, -0.4);
  ellipse(ctx, 1, 0, 6, 5.8); radialFill(ctx, hair, 1, 0, 6.5, 0.25, -0.35);
}

// ------------------------------------------------------------------ generation entry point
export function generateTextures(scene: Phaser.Scene) {
  for (const f of ['AT', 'GUARD'] as Faction[]) {
    const p = PALETTES[f];
    add(scene, `torso_${f}`, sprite(40, 40, 20, 20, (c) => drawTorso(c, p, f)));
    add(scene, `head_${f}`, sprite(20, 20, 10, 10, (c) => drawHead(c, p, f)));
    for (const w of ['pistol', 'deagle', 'mp5', 'm4'] as WeaponId[]) add(scene, `rig_${f}_${w}`, sprite(80, 40, 20, 20, (c) => drawRig(c, p, w)));
    // hands at chest (armor plate application / unarmed)
    add(scene, `rig_${f}_plate`, sprite(80, 40, 20, 20, (c) => {
      drawArm(c, 1, 11, 9, 4, p.sleeve, 5.6, 4.2); drawArm(c, 1, -11, 9, -4, p.sleeve, 5.6, 4.2);
      rr(c, 6, -6, 6, 12, 1.5); litFill(c, '#4a4f45', 6, -6, 6, 12, 0.3, -0.4);
      glove(c, 10, 4.5, p.glove); glove(c, 10, -4.5, p.glove);
    }));
  }
  add(scene, 'boot', sprite(12, 8, 6, 4, (c) => { ellipse(c, 0, 0, 5, 3.1); radialFill(c, '#18181a', 0, 0, 5, 0.25, -0.2); }));
  for (let v = 0; v < 3; v++) {
    add(scene, `hostage_sit_${v}`, sprite(44, 40, 20, 20, (c) => drawHostageSitting(c, v)));
    add(scene, `hostage_walk_${v}`, sprite(40, 40, 20, 20, (c) => drawHostageStanding(c, v)));
  }
  for (const w of ['pistol', 'deagle', 'mp5', 'm4'] as WeaponId[]) {
    add(scene, `wpn_${w}`, sprite(66, 14, 24, 7, (c) => {
      c.save(); c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 3; c.shadowOffsetY = 1.5; drawWeaponTop(c, w); c.restore();
    }));
  }

  // pickups
  add(scene, 'pk_coin', sprite(18, 18, 9, 9, (c) => {
    ellipse(c, 0, 0, 7.5, 7.5); radialFill(c, '#d9a93a', 0, 0, 8, 0.45, -0.4);
    ellipse(c, 0, 0, 5.6, 5.6); stroke(c, '#8a6418', 0.8);
    c.fillStyle = '#7a5512'; c.font = 'bold 7px Georgia'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('H', 0, 0.4);
    c.fillStyle = 'rgba(255,255,255,0.55)'; ellipse(c, -2.6, -3, 1.6, 0.9); c.fill();
  }));
  add(scene, 'pk_plate', sprite(26, 20, 13, 10, (c) => {
    c.save(); c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 3; c.shadowOffsetY = 1.5;
    rr(c, -10, -8, 20, 16, 3); litFill(c, '#5a5f52', -10, -8, 20, 16, 0.3, -0.45); c.restore();
    rr(c, -8, -6, 16, 12, 2); stroke(c, '#3b3f36', 0.7);
    c.fillStyle = '#2f332c'; c.fillRect(-6, -1, 12, 2);
    c.fillStyle = '#d6c27a'; c.font = 'bold 3.4px sans-serif'; c.textAlign = 'center'; c.fillText('III', 0, -2.5);
  }));
  add(scene, 'pk_crate', sprite(36, 26, 18, 13, (c) => {
    c.save(); c.shadowColor = 'rgba(0,0,0,0.65)'; c.shadowBlur = 5; c.shadowOffsetY = 2;
    rr(c, -15, -10, 30, 20, 2); litFill(c, '#4b5233', -15, -10, 30, 20, 0.25, -0.45); c.restore();
    rr(c, -13, -8, 26, 16, 1.5); stroke(c, '#30351f', 0.8);
    c.fillStyle = '#c9a43d'; c.fillRect(-13, -2, 26, 4);
    c.fillStyle = '#20240f'; c.font = 'bold 3.4px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('AMMUNITION', 0, 0.2);
    for (const s of [-1, 1]) { rr(c, s * 15 - 1.5, -3, 3, 6, 1); c.fillStyle = '#222516'; c.fill(); }
    for (const [x, y] of [[-12, -7], [12, -7], [-12, 7], [12, 7]]) { ellipse(c, x, y, 0.8, 0.8); c.fillStyle = '#8b8f6e'; c.fill(); }
  }));

  // fx
  add(scene, 'fx_flash', sprite(48, 28, 2, 14, (c) => {
    const g = c.createRadialGradient(6, 0, 0, 6, 0, 22);
    g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(0.25, 'rgba(255,214,120,0.95)'); g.addColorStop(0.6, 'rgba(255,140,40,0.4)'); g.addColorStop(1, 'rgba(255,100,20,0)');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(0, 0);
    const pts = [[10, -9], [14, -3], [34, 0], [14, 3], [10, 9], [6, 3], [3, 11], [2, 0], [3, -11], [6, -3]];
    pts.forEach(([x, y]) => c.lineTo(x, y)); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.9)'; ellipse(c, 4, 0, 4, 2.2); c.fill();
  }, 2));
  add(scene, 'fx_glow', sprite(64, 64, 32, 32, (c) => {
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.4)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(-32, -32, 64, 64);
  }, 1));
  add(scene, 'fx_dot', sprite(8, 8, 4, 4, (c) => {
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 4);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(-4, -4, 8, 8);
  }, 4));
  add(scene, 'fx_spark', sprite(10, 3, 5, 1.5, (c) => {
    const g = c.createLinearGradient(-5, 0, 5, 0);
    g.addColorStop(0, 'rgba(255,170,60,0)'); g.addColorStop(0.6, 'rgba(255,220,140,0.9)'); g.addColorStop(1, 'rgba(255,255,230,1)');
    c.fillStyle = g; rr(c, -5, -1, 10, 2, 1); c.fill();
  }, 4));
  add(scene, 'fx_tracer', sprite(64, 3, 0, 1.5, (c) => {
    const g = c.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0, 'rgba(255,200,120,0)'); g.addColorStop(0.8, 'rgba(255,230,170,0.7)'); g.addColorStop(1, 'rgba(255,250,230,1)');
    c.fillStyle = g; rr(c, 0, -0.7, 64, 1.4, 0.7); c.fill();
  }, 2));
  add(scene, 'fx_smoke', sprite(32, 32, 16, 16, (c) => {
    for (let i = 0; i < 7; i++) {
      const x = (hash(i, 1) - 0.5) * 12, y = (hash(i, 2) - 0.5) * 12, r = 6 + hash(i, 3) * 6;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(200,200,205,0.25)'); g.addColorStop(1, 'rgba(200,200,205,0)');
      c.fillStyle = g; c.fillRect(-16, -16, 32, 32);
    }
  }, 2));
  add(scene, 'fx_shell', sprite(5, 2.4, 2.5, 1.2, (c) => { rr(c, -2.2, -0.9, 4.4, 1.8, 0.6); litFill(c, '#c9a046', -2.2, -0.9, 4.4, 1.8, 0.5, -0.3); }, 4));
  for (let v = 0; v < 3; v++) {
    add(scene, `fx_blood_${v}`, sprite(40, 40, 20, 20, (c) => {
      c.fillStyle = 'rgba(70,6,10,0.85)';
      ellipse(c, 0, 0, 7 + v, 6); c.fill();
      for (let i = 0; i < 9; i++) {
        const a = hash(i, v, 7) * Math.PI * 2, d = 5 + hash(i, v, 8) * 11, r = 0.8 + hash(i, v, 9) * 2.6;
        ellipse(c, Math.cos(a) * d, Math.sin(a) * d, r, r * 0.8); c.fill();
      }
    }, 2));
  }
  add(scene, 'fx_pool', sprite(60, 60, 30, 30, (c) => {
    const g = c.createRadialGradient(0, 0, 2, 0, 0, 28);
    g.addColorStop(0, 'rgba(55,4,8,0.92)'); g.addColorStop(0.75, 'rgba(50,4,8,0.8)'); g.addColorStop(1, 'rgba(40,2,6,0)');
    c.fillStyle = g;
    c.beginPath();
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2, r = 20 + hash(i, 3, 3) * 8;
      i === 0 ? c.moveTo(Math.cos(a) * r, Math.sin(a) * r) : c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath(); c.fill();
  }, 2));
  add(scene, 'fx_ring', sprite(64, 64, 32, 32, (c) => { c.beginPath(); c.arc(0, 0, 28, 0, Math.PI * 2); stroke(c, 'rgba(255,255,255,1)', 2); }, 2));
  add(scene, 'fx_hidden', sprite(64, 64, 32, 32, (c) => {
    const g = c.createRadialGradient(0, 0, 10, 0, 0, 30);
    g.addColorStop(0, 'rgba(90,140,220,0)'); g.addColorStop(0.8, 'rgba(90,140,220,0.22)'); g.addColorStop(1, 'rgba(90,140,220,0)');
    c.fillStyle = g; c.fillRect(-32, -32, 64, 64);
  }, 2));
  const badge = (txt: string, col: string) => sprite(16, 16, 8, 8, (c) => {
    ellipse(c, 0, 0, 6.5, 6.5); c.fillStyle = 'rgba(10,10,14,0.85)'; c.fill(); stroke(c, col, 1);
    c.fillStyle = col; c.font = 'bold 9px "Barlow Condensed", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, 0, 0.6);
  });
  add(scene, 'ind_q', badge('?', '#f3c25a'));
  add(scene, 'ind_ex', badge('!', '#ff5148'));
}

// ------------------------------------------------------------------ carpets & floors (world-space patterns)
export function carpetPattern(kind: string): HTMLCanvasElement {
  const S = 128;
  const [c, ctx] = canvas(S, S);
  const gold = 'rgba(196,160,92,';
  const fill = (col: string) => { ctx.fillStyle = col; ctx.fillRect(0, 0, S, S); };
  switch (kind) {
    case 'burgundy': {
      fill('#5a1622');
      grain(ctx, S, S, 0.06, 'rgba(255,200,200,', 'rgba(0,0,0,', 11, 3);
      // damask medallions on a diamond grid
      for (const [cx, cy] of [[0, 0], [S, 0], [0, S], [S, S], [S / 2, S / 2]]) {
        ctx.save(); ctx.translate(cx, cy);
        for (let i = 0; i < 8; i++) {
          ctx.rotate(Math.PI / 4);
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(8, -6, 20, -4, 26, 0); ctx.bezierCurveTo(20, 4, 8, 6, 0, 0);
          ctx.fillStyle = gold + '0.28)'; ctx.fill();
        }
        ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fillStyle = gold + '0.4)'; ctx.fill();
        ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.strokeStyle = gold + '0.3)'; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.restore();
      }
      for (const [cx, cy] of [[S / 2, 0], [0, S / 2], [S, S / 2], [S / 2, S]]) {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4);
        ctx.strokeStyle = gold + '0.22)'; ctx.lineWidth = 1; ctx.strokeRect(-6, -6, 12, 12);
        ctx.restore();
      }
      break;
    }
    case 'red': {
      fill('#6a1216');
      grain(ctx, S, S, 0.07, 'rgba(255,190,170,', 'rgba(0,0,0,', 21, 3);
      ctx.strokeStyle = gold + '0.32)'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, S / 2); ctx.lineTo(S / 2, 0); ctx.lineTo(S, S / 2); ctx.lineTo(S / 2, S); ctx.closePath();
      ctx.moveTo(0, 0); ctx.lineTo(0, 0);
      ctx.stroke();
      for (const [x, y] of [[0, 0], [S, 0], [0, S], [S, S], [S / 2, S / 2]]) {
        ctx.save(); ctx.translate(x, y);
        for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.ellipse(0, -8, 3, 7, 0, 0, Math.PI * 2); ctx.fillStyle = gold + '0.32)'; ctx.fill(); }
        ctx.restore();
      }
      for (const [x, y] of [[S / 4, S / 4], [3 * S / 4, S / 4], [S / 4, 3 * S / 4], [3 * S / 4, 3 * S / 4]]) {
        ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fillStyle = gold + '0.35)'; ctx.fill();
      }
      break;
    }
    case 'blue': {
      fill('#16234a');
      grain(ctx, S, S, 0.06, 'rgba(190,210,255,', 'rgba(0,0,0,', 31, 3);
      for (const [cx, cy] of [[S / 2, S / 2], [0, 0], [S, 0], [0, S], [S, S]]) {
        ctx.save(); ctx.translate(cx, cy);
        ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.strokeStyle = gold + '0.3)'; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.strokeStyle = gold + '0.18)'; ctx.lineWidth = 3; ctx.stroke();
        ctx.beginPath();
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2, r = i % 2 ? 5 : 12;
          i === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath(); ctx.fillStyle = gold + '0.34)'; ctx.fill();
        ctx.restore();
      }
      ctx.strokeStyle = gold + '0.12)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(S / 2, 0); ctx.lineTo(S / 2, S); ctx.moveTo(0, S / 2); ctx.lineTo(S, S / 2); ctx.stroke();
      break;
    }
    case 'runner': {
      fill('#4f1320');
      grain(ctx, S, S, 0.06, 'rgba(255,200,200,', 'rgba(0,0,0,', 41, 3);
      ctx.strokeStyle = gold + '0.28)'; ctx.lineWidth = 1.2;
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        for (let x = 0; x <= S; x += 4) {
          const y = S / 2 + Math.sin((x / S) * Math.PI * 4 + i * Math.PI) * 18;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      for (const x of [S / 4, 3 * S / 4]) { ctx.beginPath(); ctx.arc(x, S / 2, 4, 0, Math.PI * 2); ctx.fillStyle = gold + '0.35)'; ctx.fill(); }
      break;
    }
    case 'tile': {
      const T = 32;
      for (let y = 0; y < S; y += T) for (let x = 0; x < S; x += T) {
        const odd = ((x + y) / T) % 2;
        ctx.fillStyle = odd ? '#2e3338' : '#454b51';
        ctx.fillRect(x, y, T, T);
        const g = ctx.createLinearGradient(x, y, x + T, y + T);
        g.addColorStop(0, 'rgba(255,255,255,0.06)'); g.addColorStop(1, 'rgba(0,0,0,0.12)');
        ctx.fillStyle = g; ctx.fillRect(x, y, T, T);
      }
      ctx.strokeStyle = 'rgba(15,17,19,0.9)'; ctx.lineWidth = 1.5;
      for (let i = 0; i <= S; i += T) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, S); ctx.moveTo(0, i); ctx.lineTo(S, i); ctx.stroke(); }
      grain(ctx, S, S, 0.05, 'rgba(255,255,255,', 'rgba(0,0,0,', 51, 1);
      break;
    }
    case 'utility': {
      fill('#2b313d');
      grain(ctx, S, S, 0.12, 'rgba(180,190,210,', 'rgba(0,0,0,', 61, 4);
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1;
      for (let i = 0; i < S; i += 8) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, S); ctx.stroke(); }
      break;
    }
    case 'marble': {
      fill('#bfb6a6');
      for (let k = 0; k < 6; k++) {
        ctx.beginPath();
        let x = hash(k, 1, 9) * S, y = 0;
        ctx.moveTo(x, y);
        while (y < S) { x += (hash(k, y, 3) - 0.5) * 18; y += 8; ctx.lineTo(x, y); }
        ctx.strokeStyle = `rgba(90,80,70,${0.15 + hash(k, 2) * 0.2})`; ctx.lineWidth = 0.6 + hash(k, 4) * 1.2; ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(80,70,60,0.35)'; ctx.lineWidth = 1;
      for (let i = 0; i <= S; i += 64) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, S); ctx.moveTo(0, i); ctx.lineTo(S, i); ctx.stroke(); }
      break;
    }
  }
  return c;
}

// ------------------------------------------------------------------ UI weapon icons (side view)
export function weaponIcon(id: WeaponId, w = 260, h = 100): string {
  const [c, ctx] = canvas(w, h);
  ctx.translate(w / 2, h / 2);
  const s = { pistol: 3.5, deagle: 2.95, mp5: 2.25, m4: 1.85 }[id] * Math.min(w / 260, h / 100);
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  const metal = (x: number, y: number, ww: number, hh: number, col = '#2c2e33') => {
    const g = ctx.createLinearGradient(0, y, 0, y + hh);
    g.addColorStop(0, shade(col, 0.35)); g.addColorStop(0.4, col); g.addColorStop(1, shade(col, -0.5));
    ctx.fillStyle = g;
  };
  const poly = (pts: number[][], col: string) => {
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
    const ys = pts.map((p) => p[1]);
    metal(0, Math.min(...ys), 0, Math.max(...ys) - Math.min(...ys), col); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 0.5; ctx.stroke();
  };
  switch (id) {
    case 'pistol':
      poly([[-18, -9], [20, -9], [21, -3], [-18, -3]], '#34363b');
      poly([[-16, -3], [12, -3], [10, 1], [2, 2], [1, 6], [-3, 6], [-6, 2], [-16, 2]], '#26272b');
      poly([[-14, 1], [-5, 1], [-3, 17], [-13, 18], [-16, 4]], '#1d1e21');
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; for (let i = 0; i < 6; i++) ctx.fillRect(-15 + i * 1.6, -8.5, 0.6, 5);
      break;
    case 'deagle':
      poly([[-20, -11], [26, -11], [27, -3], [-20, -3]], '#8d9198');
      poly([[-18, -3], [16, -3], [14, 2], [3, 3], [2, 8], [-3, 8], [-6, 2], [-18, 2]], '#5a5e64');
      poly([[-16, 1], [-6, 1], [-4, 20], [-15, 21], [-18, 4]], '#2a2b2e');
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-18, -10, 43, 1.2);
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(-2, -8, 24, 2);
      break;
    case 'mp5':
      poly([[-50, -6], [-30, -6], [-30, 4], [-50, 10]], '#202124');
      poly([[-30, -9], [14, -9], [14, 2], [-30, 2]], '#2d2f33');
      poly([[14, -8], [32, -8], [33, 0], [14, 1]], '#1f2023');
      poly([[32, -6], [44, -6], [44, -2], [32, -2]], '#18191b');
      poly([[-10, 2], [-2, 2], [4, 22], [-2, 24]], '#26272b');
      poly([[-24, 2], [-17, 2], [-15, 15], [-22, 16]], '#1c1d20');
      ctx.fillStyle = '#121214'; ctx.fillRect(-28, -12, 6, 3); ctx.fillRect(8, -12, 4, 3);
      break;
    case 'm4':
      poly([[-62, -7], [-40, -9], [-40, 6], [-58, 10], [-62, 4]], '#2a2b2f');
      poly([[-40, -4], [-30, -4], [-30, 1], [-40, 1]], '#1c1d20');
      poly([[-30, -9], [8, -9], [8, 3], [-30, 3]], '#34363a');
      poly([[8, -9], [40, -9], [40, 2], [8, 2]], '#2a2c30');
      poly([[40, -6], [58, -6], [58, -2], [40, -2]], '#1b1c1e');
      poly([[56, -7.5], [64, -7.5], [64, -0.5], [56, -0.5]], '#141516');
      poly([[-6, 3], [2, 3], [5, 24], [-2, 25]], '#26272b');
      poly([[-26, 3], [-16, 3], [-17, 12], [-24, 12]], '#1c1d20');
      poly([[-20, -16], [-4, -16], [-4, -9], [-20, -9]], '#18191c');
      ctx.fillStyle = 'rgba(90,211,255,0.8)'; ctx.fillRect(-5, -15, 1.2, 5);
      ctx.fillStyle = '#121214'; for (let i = 10; i < 40; i += 3) ctx.fillRect(i, -10.5, 1.6, 1.6);
      break;
  }
  return c.toDataURL();
}
