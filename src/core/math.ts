export const TAU = Math.PI * 2;
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
export const wrapAngle = (a: number) => {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
};
export const angleDiff = (from: number, to: number) => wrapAngle(to - from);
export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(bx - ax, by - ay);
export const dist2 = (ax: number, ay: number, bx: number, by: number) => (bx - ax) ** 2 + (by - ay) ** 2;
/** Frame-rate independent exponential approach factor. */
export const approach = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);
export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export const rotateTowards = (a: number, target: number, maxStep: number) => {
  const d = angleDiff(a, target);
  if (Math.abs(d) <= maxStep) return target;
  return wrapAngle(a + Math.sign(d) * maxStep);
};
