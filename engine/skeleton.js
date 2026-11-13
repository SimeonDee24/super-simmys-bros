// Paper-doll skeleton. Poses are joint angles in whole degrees; this file turns
// a pose into joint positions using integer math only, because hurtboxes follow
// the body parts and must be identical on every machine.
//
// Conventions (character facing RIGHT, y grows downward, origin at the feet):
//   limb angle 0 = hanging straight down, positive = swings forward (+x)
//   lower arm / lower leg angles are relative to the upper part
//     (elbows bend with positive values, knees with negative values)
//   torso / head angle 0 = upright, positive = leans forward
//   foot angle is absolute (0 = flat on the ground)
//   rot turns the WHOLE body around its middle (positive = forward roll,
//     negative = backflip; -360 is one full backflip)
import { FX, sinDeg, cosDeg, mulTrig } from './fixed.js';

export const POSE_KEYS = ['rot', 'hx', 'hy', 'torso', 'head', 'afu', 'afl', 'abu', 'abl', 'lfu', 'lfl', 'lbu', 'lbl', 'ff', 'fb'];

const DEFAULT_POSE = {
  rot: 0, hx: 0, hy: 0, torso: 0, head: 0,
  afu: 5, afl: 10, abu: -5, abl: 8,
  lfu: 4, lfl: -3, lbu: -5, lbl: -2,
  ff: 0, fb: 0,
  handF: 'open', handB: 'open', face: 'neutral',
};

// Build a full pose from a short description, e.g.
//   pose({ hip: [0, 2], torso: 15, armF: [40, 60], legB: [-20, -30], face: 'yell' })
export function pose(p = {}) {
  const o = { ...DEFAULT_POSE };
  if (p.hip) { o.hx = p.hip[0] * FX; o.hy = p.hip[1] * FX; }
  if (p.armF) { o.afu = p.armF[0]; o.afl = p.armF[1]; }
  if (p.armB) { o.abu = p.armB[0]; o.abl = p.armB[1]; }
  if (p.legF) { o.lfu = p.legF[0]; o.lfl = p.legF[1]; }
  if (p.legB) { o.lbu = p.legB[0]; o.lbl = p.legB[1]; }
  if (p.rot !== undefined) o.rot = p.rot;
  if (p.torso !== undefined) o.torso = p.torso;
  if (p.head !== undefined) o.head = p.head;
  if (p.footF !== undefined) o.ff = p.footF;
  if (p.footB !== undefined) o.fb = p.footB;
  if (p.handF) o.handF = p.handF;
  if (p.handB) o.handB = p.handB;
  if (p.face) o.face = p.face;
  return o;
}

// anim(loop, [[frames, poseDescription], ...], { ease })
// Each key blends into the next one over its number of frames.
// Looping animations blend the last key back into the first.
export function anim(loop, keys, opts = {}) {
  const k = keys.map(([d, p]) => ({ d, pose: pose(p) }));
  let total = 0;
  const n = loop ? k.length : k.length - 1;
  for (let i = 0; i < n; i++) total += k[i].d;
  return { loop, keys: k, total, ease: opts.ease !== undefined ? opts.ease : !loop };
}

export function samplePose(a, frame) {
  const keys = a.keys;
  const n = keys.length;
  if (n === 1 || a.total <= 0) return keys[0].pose;
  let t;
  if (a.loop) t = frame % a.total;
  else if (frame >= a.total) return keys[n - 1].pose;
  else t = frame;
  let i = 0;
  while (t >= keys[i].d) { t -= keys[i].d; i++; }
  const A = keys[i].pose;
  const B = keys[(i + 1) % n].pose;
  const d = keys[i].d;
  const out = { handF: A.handF, handB: A.handB, face: A.face };
  for (let j = 0; j < POSE_KEYS.length; j++) {
    const key = POSE_KEYS[j];
    const diff = B[key] - A[key];
    out[key] = a.ease
      ? A[key] + Math.trunc((diff * t * t * (3 * d - 2 * t)) / (d * d * d))
      : A[key] + Math.trunc((diff * t) / d);
  }
  return out;
}

// Returns joint positions (fixed-point, relative to the feet, facing right)
// and the rotation of every part.
export function solve(skel, p) {
  let hipX = p.hx;
  let hipY = -skel.hipY * FX + p.hy;
  // Whole-body rotation: the hip swings around a point in the middle of the
  // torso, and every part angle turns with it.
  const r = p.rot || 0;
  if (r) {
    const piv = (skel.spinPivot || 8) * FX;
    const cy = hipY - piv;
    hipX -= mulTrig(piv, sinDeg(r));
    hipY = cy + mulTrig(piv, cosDeg(r));
  }
  const torso = p.torso + r, head = p.head + r;
  const st = sinDeg(torso), ct = cosDeg(torso);
  const tl = skel.torso * FX;
  const sl = (skel.torso - skel.shoulderDrop) * FX;
  const neck = [hipX + mulTrig(tl, st), hipY - mulTrig(tl, ct)];
  const shX = hipX + mulTrig(sl, st), shY = hipY - mulTrig(sl, ct);

  const limb = (x, y, upLen, lowLen, u, l) => {
    const mx = x + mulTrig(upLen * FX, sinDeg(u));
    const my = y + mulTrig(upLen * FX, cosDeg(u));
    const ex = mx + mulTrig(lowLen * FX, sinDeg(u + l));
    const ey = my + mulTrig(lowLen * FX, cosDeg(u + l));
    return { a: [x, y], b: [mx, my], c: [ex, ey], up: u, low: u + l };
  };
  const cr = cosDeg(r), sr = sinDeg(r);
  const sox = mulTrig(skel.shoulderOff * FX, cr), soy = mulTrig(skel.shoulderOff * FX, sr);
  const hox = mulTrig(skel.hipOff * FX, cr), hoy = mulTrig(skel.hipOff * FX, sr);
  return {
    hip: [hipX, hipY],
    neck,
    torso,
    head,
    armF: limb(shX + sox, shY + soy, skel.upperArm, skel.lowerArm, p.afu - r, p.afl),
    armB: limb(shX - sox, shY - soy, skel.upperArm, skel.lowerArm, p.abu - r, p.abl),
    legF: limb(hipX + hox, hipY + hoy, skel.upperLeg, skel.lowerLeg, p.lfu - r, p.lfl),
    legB: limb(hipX - hox, hipY - hoy, skel.upperLeg, skel.lowerLeg, p.lbu - r, p.lbl),
    footF: p.ff - r, footB: p.fb - r,
    handF: p.handF, handB: p.handB, face: p.face,
  };
}

// Hurtboxes that follow the body parts. Returns rectangles [x1, y1, x2, y2] in
// fixed-point, relative to the feet, already mirrored for the facing direction.
export function hurtboxes(skel, s, facing) {
  const out = [];
  const seg = (p, q, r) => {
    const R = r * FX;
    let x1 = Math.min(p[0], q[0]) - R, x2 = Math.max(p[0], q[0]) + R;
    const y1 = Math.min(p[1], q[1]) - R, y2 = Math.max(p[1], q[1]) + R;
    if (facing < 0) { const t = -x1; x1 = -x2; x2 = t; }
    out.push([x1, y1, x2, y2]);
  };
  const hr = skel.headRadius * FX;
  const headC = [s.neck[0] + mulTrig(hr, sinDeg(s.head)), s.neck[1] - mulTrig(hr, cosDeg(s.head))];
  seg(headC, headC, skel.headRadius);
  seg(s.hip, s.neck, skel.torsoRadius);
  for (const k of ['armF', 'armB', 'legF', 'legB']) {
    const r = k[0] === 'a' ? skel.armRadius : skel.legRadius;
    seg(s[k].a, s[k].b, r);
    seg(s[k].b, s[k].c, r);
  }
  return out;
}
