// Fixed-point math helpers. Everything in the simulation uses integers only,
// so the same inputs always produce the same state on every machine.

export const FX = 256;            // sub-pixel units per pixel
export const TRIG_ONE = 4096;     // sin/cos results are scaled by this

// Convert a pixel value written in data files (may be fractional) to fixed-point.
export const px = (v) => Math.round(v * FX);
// Fixed-point to whole pixels (rounded to nearest).
export const toPx = (v) => (v + (FX >> 1)) >> 8;

// Quarter-wave sine table, 0..90 degrees, literal integers (no Math.sin at runtime).
const QUARTER = [0,71,143,214,286,357,428,499,570,641,711,782,852,921,991,1060,1129,1198,1266,1334,1401,1468,1534,1600,1666,1731,1796,1860,1923,1986,2048,2110,2171,2231,2290,2349,2408,2465,2522,2578,2633,2687,2741,2793,2845,2896,2946,2996,3044,3091,3138,3183,3228,3271,3314,3355,3396,3435,3474,3511,3547,3582,3617,3650,3681,3712,3742,3770,3798,3824,3849,3873,3896,3917,3937,3956,3974,3991,4006,4021,4034,4046,4056,4065,4074,4080,4086,4090,4094,4095,4096];

export function sinDeg(d) {
  d = ((d % 360) + 360) % 360;
  if (d <= 90) return QUARTER[d];
  if (d <= 180) return QUARTER[180 - d];
  if (d <= 270) return -QUARTER[d - 180];
  return -QUARTER[360 - d];
}
export const cosDeg = (d) => sinDeg(d + 90);

// length (fixed-point) * trig value -> fixed-point, truncated toward zero.
export const mulTrig = (len, t) => Math.trunc((len * t) / TRIG_ONE);

export function approach(v, target, amt) {
  if (v < target) return Math.min(v + amt, target);
  if (v > target) return Math.max(v - amt, target);
  return v;
}
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// Seeded RNG (xorshift32). The seed lives in the game state so it is part of the hash.
export function rngNext(state) {
  let x = state.rng | 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  state.rng = x | 0;
  return x >>> 0;
}
export const rngInt = (state, n) => rngNext(state) % n;
