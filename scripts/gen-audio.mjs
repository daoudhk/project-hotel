// Procedural audio generator for Project Hotel.
// Synthesizes every sound effect and the ambience loop into 16-bit WAV files
// inside public/audio so the game ships with local audio assets and needs no
// network access. Run with: npm run gen:audio
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'audio');
mkdirSync(OUT, { recursive: true });

// Deterministic RNG so regenerating gives identical files.
let seed = 1337;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const noise = () => rnd() * 2 - 1;

function buffer(seconds, rate = 44100) {
  return { rate, data: new Float32Array(Math.ceil(seconds * rate)) };
}

function writeWav(name, buf, gain = 1) {
  const { rate, data } = buf;
  // normalise to a peak of ~0.9 * gain
  let peak = 0;
  for (const v of data) peak = Math.max(peak, Math.abs(v));
  const k = peak > 0 ? (0.9 * gain) / peak : 1;
  const bytes = Buffer.alloc(44 + data.length * 2);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(36 + data.length * 2, 4);
  bytes.write('WAVE', 8);
  bytes.write('fmt ', 12);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24);
  bytes.writeUInt32LE(rate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(data.length * 2, 40);
  for (let i = 0; i < data.length; i++) {
    const s = Math.max(-1, Math.min(1, data[i] * k));
    bytes.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  writeFileSync(join(OUT, name + '.wav'), bytes);
  console.log('wrote', name, (bytes.length / 1024).toFixed(0) + 'kB');
}

// ---------- DSP helpers ----------
class Biquad {
  constructor(type, freq, q, rate) {
    this.type = type; this.rate = rate; this.q = q;
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
    this.set(freq);
  }
  set(freq) {
    const w = (2 * Math.PI * Math.min(freq, this.rate * 0.45)) / this.rate;
    const cos = Math.cos(w), alpha = Math.sin(w) / (2 * this.q);
    let b0, b1, b2, a0, a1, a2;
    if (this.type === 'low') {
      b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2;
    } else if (this.type === 'high') {
      b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2;
    } else { // band
      b0 = alpha; b1 = 0; b2 = -alpha;
    }
    a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

function reverb(buf, { wet = 0.3, size = 1, damp = 0.4 } = {}) {
  const { rate, data } = buf;
  const combs = [1557, 1617, 1491, 1422].map((d) => ({
    len: Math.floor(d * size * (rate / 44100)), idx: 0, store: 0, buf: null,
  }));
  combs.forEach((c) => (c.buf = new Float32Array(c.len)));
  const aps = [225, 556].map((d) => ({ len: Math.floor(d * (rate / 44100)), idx: 0, buf: null }));
  aps.forEach((a) => (a.buf = new Float32Array(a.len)));
  const fb = 0.78;
  const out = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const x = data[i];
    let s = 0;
    for (const c of combs) {
      const y = c.buf[c.idx];
      c.store = y * (1 - damp) + c.store * damp;
      c.buf[c.idx] = x + c.store * fb;
      c.idx = (c.idx + 1) % c.len;
      s += y;
    }
    s *= 0.25;
    for (const a of aps) {
      const y = a.buf[a.idx];
      a.buf[a.idx] = s + y * 0.5;
      a.idx = (a.idx + 1) % a.len;
      s = y - s * 0.5;
    }
    out[i] = x * (1 - wet) + s * wet;
  }
  buf.data = out;
  return buf;
}

const env = (t, attack, decay) => (t < attack ? t / attack : Math.exp(-(t - attack) / decay));

function mixInto(dst, src, at = 0, gain = 1) {
  const off = Math.floor(at * dst.rate);
  for (let i = 0; i < src.data.length && off + i < dst.data.length; i++) dst.data[off + i] += src.data[i] * gain;
}

// ---------- Weapons ----------
function gunshot({ len, body, bodyDecay, crack, crackDecay, lp, lpEnd, thump, thumpDecay, verb }) {
  const b = buffer(len);
  const lpF = new Biquad('low', lp, 0.7, b.rate);
  const hpF = new Biquad('high', 2500, 0.7, b.rate);
  for (let i = 0; i < b.data.length; i++) {
    const t = i / b.rate;
    lpF.set(lpEnd + (lp - lpEnd) * Math.exp(-t / 0.05));
    const n = noise();
    const bodyN = lpF.run(n) * env(t, 0.001, bodyDecay) * body;
    const crackN = hpF.run(n) * env(t, 0.0003, crackDecay) * crack;
    const f = thump * (1 + 1.5 * Math.exp(-t / 0.02));
    const th = Math.sin(2 * Math.PI * f * t) * env(t, 0.001, thumpDecay) * 0.9;
    b.data[i] = bodyN + crackN + th;
  }
  return reverb(b, verb);
}

writeWav('shot_pistol', gunshot({ len: 0.9, body: 1, bodyDecay: 0.06, crack: 0.5, crackDecay: 0.012, lp: 6000, lpEnd: 900, thump: 95, thumpDecay: 0.05, verb: { wet: 0.28, size: 1.1, damp: 0.45 } }));
writeWav('shot_mp5', gunshot({ len: 0.6, body: 0.9, bodyDecay: 0.035, crack: 0.45, crackDecay: 0.008, lp: 5000, lpEnd: 1100, thump: 110, thumpDecay: 0.03, verb: { wet: 0.22, size: 0.9, damp: 0.5 } }), 0.85);
writeWav('shot_m4', gunshot({ len: 1.0, body: 1, bodyDecay: 0.07, crack: 0.9, crackDecay: 0.015, lp: 8000, lpEnd: 1200, thump: 80, thumpDecay: 0.06, verb: { wet: 0.3, size: 1.2, damp: 0.4 } }));
writeWav('shot_deagle', gunshot({ len: 1.6, body: 1.2, bodyDecay: 0.13, crack: 0.8, crackDecay: 0.02, lp: 4500, lpEnd: 500, thump: 55, thumpDecay: 0.14, verb: { wet: 0.38, size: 1.4, damp: 0.35 } }));

function click({ freq = 3000, decay = 0.004, len = 0.05, gain = 1, rate = 44100 }) {
  const b = buffer(len, rate);
  const bp = new Biquad('band', freq, 4, b.rate);
  for (let i = 0; i < b.data.length; i++) {
    const t = i / b.rate;
    b.data[i] = bp.run(noise()) * env(t, 0.0002, decay) * gain;
  }
  return b;
}
function friction(len, freq, gain = 0.3) {
  const b = buffer(len);
  const bp = new Biquad('band', freq, 1.5, b.rate);
  for (let i = 0; i < b.data.length; i++) {
    const t = i / b.rate;
    const e = Math.sin(Math.PI * Math.min(1, t / len));
    b.data[i] = bp.run(noise()) * e * gain;
  }
  return b;
}

{
  const b = buffer(0.35);
  mixInto(b, friction(0.12, 1800, 0.25), 0);
  mixInto(b, click({ freq: 2200, decay: 0.006 }), 0.1);
  mixInto(b, click({ freq: 900, decay: 0.012, gain: 0.6 }), 0.13);
  writeWav('mag_out', reverb(b, { wet: 0.12 }), 0.6);
}
{
  const b = buffer(0.35);
  mixInto(b, friction(0.08, 1400, 0.2), 0);
  mixInto(b, click({ freq: 1500, decay: 0.01 }), 0.07);
  mixInto(b, click({ freq: 600, decay: 0.02, gain: 0.8 }), 0.075);
  writeWav('mag_in', reverb(b, { wet: 0.12 }), 0.7);
}
{
  const b = buffer(0.4);
  mixInto(b, click({ freq: 2600, decay: 0.006 }), 0);
  mixInto(b, friction(0.07, 2400, 0.2), 0.01);
  mixInto(b, click({ freq: 1800, decay: 0.009, gain: 0.9 }), 0.09);
  mixInto(b, click({ freq: 700, decay: 0.015, gain: 0.5 }), 0.095);
  writeWav('slide_rack', reverb(b, { wet: 0.12 }), 0.7);
}
writeWav('dry_fire', click({ freq: 2400, decay: 0.006, len: 0.12 }), 0.5);
{
  const b = buffer(0.3);
  mixInto(b, friction(0.15, 600, 0.3), 0);
  mixInto(b, click({ freq: 1200, decay: 0.01 }), 0.13);
  writeWav('weapon_swap', b, 0.5);
}

// ---------- Footsteps ----------
for (let v = 0; v < 3; v++) {
  const b = buffer(0.18);
  const lp = new Biquad('low', 420 + v * 70, 0.9, b.rate);
  for (let i = 0; i < b.data.length; i++) {
    const t = i / b.rate;
    b.data[i] = lp.run(noise()) * env(t, 0.004, 0.025) + Math.sin(2 * Math.PI * (70 + v * 8) * t) * env(t, 0.003, 0.02) * 0.4;
  }
  writeWav('step_carpet_' + v, b, 0.5);
}
for (let v = 0; v < 2; v++) {
  const b = buffer(0.2);
  const bp = new Biquad('band', 1600 + v * 300, 1.2, b.rate);
  const lp = new Biquad('low', 500, 0.8, b.rate);
  for (let i = 0; i < b.data.length; i++) {
    const t = i / b.rate;
    const n = noise();
    b.data[i] = bp.run(n) * env(t, 0.001, 0.012) * 0.7 + lp.run(n) * env(t, 0.002, 0.03);
  }
  writeWav('step_tile_' + v, reverb(b, { wet: 0.15 }), 0.5);
}

// ---------- Impacts ----------
{
  const b = buffer(0.4);
  const lp = new Biquad('low', 1800, 0.7, b.rate);
  const hp = new Biquad('high', 3000, 0.7, b.rate);
  for (let i = 0; i < b.data.length; i++) {
    const t = i / b.rate;
    const n = noise();
    b.data[i] = lp.run(n) * env(t, 0.001, 0.03) + hp.run(n) * env(t, 0.01, 0.06) * 0.25 * (rnd() < 0.3 ? 1 : 0.3);
  }
  writeWav('impact_wall', reverb(b, { wet: 0.15 }), 0.55);
}
{
  const b = buffer(0.3);
  const lp = new Biquad('low', 600, 1.2, b.rate);
  for (let i = 0; i < b.data.length; i++) {
    const t = i / b.rate;
    b.data[i] = lp.run(noise()) * env(t, 0.002, 0.04) + Math.sin(2 * Math.PI * 120 * t * (1 - t)) * env(t, 0.002, 0.03) * 0.5;
  }
  writeWav('impact_flesh', b, 0.6);
}
{
  const b = buffer(0.35);
  for (let i = 0; i < b.data.length; i++) {
    const t = i / b.rate;
    b.data[i] = (Math.sin(2 * Math.PI * 340 * t) * 0.6 + Math.sin(2 * Math.PI * 520 * t) * 0.3) * env(t, 0.001, 0.035) + noise() * env(t, 0.001, 0.01) * 0.4;
  }
  writeWav('impact_wood', reverb(b, { wet: 0.12 }), 0.5);
}
{
  const b = buffer(0.35);
  for (let i = 0; i < b.data.length; i++) {
    const t = i / b.rate;
    b.data[i] = (Math.sin(2 * Math.PI * 1700 * t) + Math.sin(2 * Math.PI * 2650 * t) * 0.5) * env(t, 0.0005, 0.03) + noise() * env(t, 0.0005, 0.005);
  }
  writeWav('impact_armor', b, 0.55);
}
{ // body fall
  const b = buffer(0.6);
  const lp = new Biquad('low', 300, 0.9, b.rate);
  for (let i = 0; i < b.data.length; i++) {
    const t = i / b.rate;
    b.data[i] = lp.run(noise()) * (env(t, 0.005, 0.06) + env(Math.max(0, t - 0.14), 0.005, 0.05) * 0.6 * (t > 0.14 ? 1 : 0));
  }
  writeWav('body_fall', reverb(b, { wet: 0.2 }), 0.7);
}
{ // player hurt
  const b = buffer(0.4);
  const lp = new Biquad('low', 250, 1, b.rate);
  for (let i = 0; i < b.data.length; i++) {
    const t = i / b.rate;
    b.data[i] = lp.run(noise()) * env(t, 0.002, 0.05) + Math.sin(2 * Math.PI * 55 * t) * env(t, 0.004, 0.09);
  }
  writeWav('hurt', b, 0.75);
}

// ---------- Equipment ----------
{
  const b = buffer(0.2);
  mixInto(b, click({ freq: 3200, decay: 0.003 }), 0);
  mixInto(b, click({ freq: 2000, decay: 0.005, gain: 0.7 }), 0.035);
  writeWav('flashlight', b, 0.45);
}
{
  const b = buffer(0.6);
  for (let k = 0; k < 5; k++) mixInto(b, click({ freq: 2500 + rnd() * 2500, decay: 0.01, gain: 0.5 + rnd() * 0.5 }), 0.03 + k * 0.05 + rnd() * 0.02);
  mixInto(b, friction(0.2, 900, 0.3), 0);
  writeWav('pickup_ammo', reverb(b, { wet: 0.12 }), 0.55);
}
{
  const b = buffer(0.7);
  mixInto(b, friction(0.18, 700, 0.35), 0);
  mixInto(b, click({ freq: 1400, decay: 0.02 }), 0.16);
  mixInto(b, click({ freq: 2600, decay: 0.008, gain: 0.8 }), 0.26);
  mixInto(b, click({ freq: 1800, decay: 0.01, gain: 0.7 }), 0.33);
  writeWav('pickup_weapon', reverb(b, { wet: 0.14 }), 0.6);
}
function bell(freqs, len, decay, gain = 1) {
  const b = buffer(len);
  for (let i = 0; i < b.data.length; i++) {
    const t = i / b.rate;
    let s = 0;
    freqs.forEach((f, k) => (s += Math.sin(2 * Math.PI * f * t) * Math.exp(-t / (decay / (1 + k * 0.6))) / (1 + k)));
    b.data[i] = s * Math.min(1, t / 0.002) * gain;
  }
  return b;
}
{
  const b = buffer(0.6);
  mixInto(b, bell([1975, 3950, 5925], 0.5, 0.12), 0);
  mixInto(b, bell([2637, 5274], 0.5, 0.18, 0.8), 0.06);
  writeWav('coin', reverb(b, { wet: 0.18 }), 0.5);
}
{ // armor: velcro + plate thunk
  const b = buffer(0.9);
  const bp = new Biquad('band', 2500, 0.8, b.rate);
  for (let i = 0; i < 0.35 * b.rate; i++) {
    const t = i / b.rate;
    const am = 0.5 + 0.5 * Math.sin(2 * Math.PI * 70 * t + Math.sin(t * 40));
    b.data[i] += bp.run(noise()) * am * Math.sin(Math.PI * t / 0.35) * 0.6;
  }
  mixInto(b, click({ freq: 500, decay: 0.03, len: 0.2 }), 0.5);
  mixInto(b, click({ freq: 1600, decay: 0.01, len: 0.1, gain: 0.5 }), 0.52);
  writeWav('armor', reverb(b, { wet: 0.12 }), 0.6);
}
{
  const b = buffer(0.4);
  mixInto(b, click({ freq: 700, decay: 0.03, len: 0.2 }), 0);
  mixInto(b, friction(0.15, 1500, 0.2), 0.02);
  writeWav('pickup_plate', b, 0.55);
}
{ // zip tie cut
  const b = buffer(0.4);
  mixInto(b, click({ freq: 4200, decay: 0.004 }), 0);
  mixInto(b, friction(0.08, 3500, 0.3), 0.01);
  mixInto(b, click({ freq: 3000, decay: 0.006 }), 0.1);
  writeWav('hostage_free', b, 0.55);
}

// ---------- Tension / UI ----------
{ // enemy alert stinger
  const b = buffer(1.2);
  const lp = new Biquad('low', 900, 1.5, b.rate);
  for (let i = 0; i < b.data.length; i++) {
    const t = i / b.rate;
    const saw = (f) => ((f * t) % 1) * 2 - 1;
    const s = saw(110) + saw(110.7) + saw(164.8) * 0.6;
    lp.set(400 + 1400 * Math.exp(-t / 0.25));
    b.data[i] = lp.run(s) * env(t, 0.01, 0.35) * 0.4 + Math.sin(2 * Math.PI * 1320 * t) * env(t, 0.002, 0.08) * 0.3;
  }
  writeWav('alert', reverb(b, { wet: 0.35, size: 1.3 }), 0.55);
}
{ // suspicious tick
  const b = bell([880, 1320], 0.3, 0.06, 0.6);
  writeWav('suspicious', b, 0.35);
}
function chord(freqs, len, gain, decay) {
  const b = buffer(len);
  for (let i = 0; i < b.data.length; i++) {
    const t = i / b.rate;
    let s = 0;
    freqs.forEach((f, k) => {
      const st = k * 0.07;
      if (t < st) return;
      const tt = t - st;
      s += (Math.sin(2 * Math.PI * f * tt) + 0.3 * Math.sin(4 * Math.PI * f * tt)) * Math.min(1, tt / 0.04) * Math.exp(-tt / decay);
    });
    b.data[i] = s * gain;
  }
  return b;
}
writeWav('mission_complete', reverb(chord([261.6, 329.6, 392, 523.3, 659.3], 3.2, 0.3, 0.9), { wet: 0.4, size: 1.4 }), 0.65);
writeWav('mission_fail', reverb(chord([220, 261.6, 311.1, 196], 3.0, 0.3, 0.8), { wet: 0.4, size: 1.4 }), 0.6);
writeWav('objective', reverb(chord([523.3, 784, 1046.5], 1.4, 0.3, 0.35), { wet: 0.3 }), 0.5);
writeWav('ui_hover', bell([2400], 0.08, 0.012, 0.5), 0.18);
{
  const b = buffer(0.15);
  mixInto(b, click({ freq: 1800, decay: 0.006 }), 0);
  mixInto(b, bell([1200], 0.1, 0.02, 0.4), 0);
  writeWav('ui_click', b, 0.35);
}
{ // upgrade shimmer
  const b = buffer(1.4);
  [523.3, 659.3, 784, 1046.5, 1318.5].forEach((f, k) => mixInto(b, bell([f, f * 2.01], 1.0, 0.25, 0.5), k * 0.06));
  writeWav('upgrade', reverb(b, { wet: 0.35, size: 1.2 }), 0.55);
}

// ---------- Ambience loop ----------
{
  const rate = 22050;
  const len = 32;
  const b = buffer(len, rate);
  const lp1 = new Biquad('low', 180, 0.7, rate);
  const lp2 = new Biquad('low', 900, 0.5, rate);
  let brown = 0;
  for (let i = 0; i < b.data.length; i++) {
    const t = i / rate;
    brown = (brown + noise() * 0.02) * 0.995;
    const hvac = lp1.run(brown * 6) * (0.8 + 0.2 * Math.sin(2 * Math.PI * t / 8));
    const hum = Math.sin(2 * Math.PI * 50 * t) * 0.05 + Math.sin(2 * Math.PI * 100 * t) * 0.025;
    const air = lp2.run(noise()) * 0.03;
    b.data[i] = hvac + hum + air;
  }
  // distant, muffled lounge piano phrases
  const notes = [
    [0.5, 220.0], [1.2, 277.2], [1.9, 329.6], [3.5, 246.9], [4.3, 293.7],
    [8.0, 196.0], [8.7, 246.9], [9.4, 293.7], [11.2, 220.0],
    [16.0, 174.6], [16.6, 220.0], [17.3, 261.6], [19.0, 329.6], [19.6, 293.7],
    [24.0, 196.0], [24.8, 246.9], [25.6, 293.7], [27.4, 220.0], [28.2, 164.8],
  ];
  const piano = buffer(len, rate);
  for (const [at, f] of notes) {
    const start = Math.floor(at * rate);
    for (let i = 0; i < 3.5 * rate && start + i < piano.data.length; i++) {
      const t = i / rate;
      const s = Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(4 * Math.PI * f * t) + 0.15 * Math.sin(6 * Math.PI * f * t);
      piano.data[start + i] += s * Math.min(1, t / 0.01) * Math.exp(-t / 1.1) * 0.06;
    }
  }
  const lpP = new Biquad('low', 700, 0.7, rate);
  for (let i = 0; i < piano.data.length; i++) piano.data[i] = lpP.run(piano.data[i]);
  reverb(piano, { wet: 0.7, size: 1.6, damp: 0.5 });
  for (let i = 0; i < b.data.length; i++) b.data[i] += piano.data[i];
  // crossfade tail into head for a seamless loop
  const fade = Math.floor(2 * rate);
  for (let i = 0; i < fade; i++) {
    const k = i / fade;
    b.data[i] = b.data[i] * k + b.data[b.data.length - fade + i] * (1 - k);
  }
  b.data = b.data.slice(0, b.data.length - fade);
  writeWav('ambience', b, 0.7);
}
console.log('audio generation complete');
