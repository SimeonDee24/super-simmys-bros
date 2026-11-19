// ZEID — every special and smash attack is a vape or cigarette trick: smoke
// clouds, smoke rings, a flicked butt, a lighter. He shares every normal
// attack, grab and throw with Simeon (same skeleton, same animations); his
// look, a few stats, his smash attacks and his four specials are his own.
import { px } from '../engine/fixed.js';
import { anim } from '../engine/skeleton.js';
import { SIMEON } from './simeon.js';

const stats = {
  ...SIMEON.stats,
  weight: 97,
  airSpeed: px(2.8),
};

// ---------------------------------------------------------------------------
// Body parts: pixel art at 2 art pixels per world pixel, facing right.
// Thick dark hair with heavy straight bangs down to his brows, a moustache and
// a goatee, a big smile.
// ---------------------------------------------------------------------------
const HEAD = [
  '...kkkkkkk....',
  '.kkkkkkkkkkk..',
  'kKkkkkkkkkkkl.',
  'kKkkkkkkkkkkl.',
  'KKkkkkkkkbbbb.',
  'KKkkkkkkkmeek.',
  'KkKqkkkkkmeek.',
  'KkKqkkkkkkkkkl',
  'KKkKKkkkkkkkKl',
  'KKkKkkkkkdddd.',
  '.KKkkkkkkkpdk.',
  '.KKkkkkkkddd..',
  '..KKkkkkkdd...',
  '....KKKKKkK...',
];
const face = (...edits) => {
  const rows = HEAD.map((r) => r.split(''));
  for (const [r, c, str] of edits) for (let i = 0; i < str.length; i++) rows[r][c + i] = str[i];
  return { pivot: [5, 14], px: rows.map((r) => r.join('')) };
};
// (hair column = head column + 1, row = head row + 4)
const HAIR = [
  '....hhhhhhhhh.....',
  '..hhhhhhhhhhhhh...',
  '.hhhhnhhhhhnhhhh..',
  'hhhhhhhhHhhhhhhhh.',
  'hhhHhhhhhhhhHhhhhh',
  'hhhhhhhhhhhhhhhhhh',
  'hhhhhhhhhhhhhhhhh.',
  'hhhhhhhhhhHhhhhh..',
  'hhhhhhhhh.hHhhh...',
  'hhhhhhh...........',
  'hhhhhhh...........',
  'hhhhhh............',
  '.hhhh.............',
  '..hh..............',
];
const parts = {
  ...SIMEON.parts,   // hands, legs and sneakers are shared
  head_neutral: face([10, 9, 'kmmd']),                 // he is nearly always grinning
  head_smile: face([10, 9, 'mmmd']),
  head_yell: face([10, 9, 'rrrd'], [11, 9, 'rrd']),   // mouth open: blowing smoke
  head_hurt: face([4, 9, 'bbkk'], [5, 9, 'kkkk'], [6, 9, 'eeek'], [10, 10, 'rr']),
  hair: { pivot: [6, 18], px: HAIR },
  // a short-sleeved button-up (or a graduation gown: O is the collar, Z the buttons)
  torso: {
    pivot: [6, 26],
    px: [
      '.....kkkk.....',
      '....OKkkkO....',
      '...TOOkkOOu...',
      '...TTtOtOttu..',
      '..TTttttZtttu.',
      '.TTtttttttttu.',
      'TTTtttttttZtuu',
      'TTttttttttttuu',
      'TTtttttttttZtu',
      'TTxtttttttttuu',
      'TTTxtttttttZuu',
      'TTtTxtttttttuu',
      '.TTttxtttttZu.',
      '.TTtttttttttu.',
      '.TTtttttttxZu.',
      '.TTttttttxttu.',
      '.TTtttttxttZu.',
      '.TTtttttttttu.',
      '.TTxtttttttuu.',
      '.TTtxttttttuu.',
      '.TTtttttttttu.',
      '.xTTttttttttx.',
      '.BBBBBBBBBBBB.',
      '.JJjjjjjjjjii.',
      '.JJjjjjjjjjji.',
      '.JJjjjjjjjjii.',
      '.JJjjjjjjjjii.',
      '..JJjjjjjjii..',
    ],
  },
  // short sleeves over bare arms (A / a are skin), or the gown's long sleeves
  upperArm: { pivot: [2, 0], px: ['TTtuu', 'TTttu', 'TTttu', 'TTxtu', 'xTTtx', 'AaaaR', 'AaaaR', 'AaaaR', 'AAaaR', 'AaaaR', 'AaaaR', 'AaaaR', '.Aaa.'] },
  lowerArm: { pivot: [2, 0], px: ['AaaaR', 'AaaaR', 'AaaaR', 'AAaaR', 'AaaaR', 'AaaaR', '.AaaR', '.AaaR', '.AaR.', '.AaR.', '.AaR.'] },
};

const darker = (hex, k) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('');
const SKIN = { k: '#e8c19d', K: '#c99a77', l: '#f6d9bd', q: '#b3826a', p: '#c78377' };
const BASE_COLORS = {
  ...SIMEON.palettes[0].colors,
  ...SKIN,
  h: '#1f1611', H: '#33241b', n: '#4a382c', b: '#1f1611', d: '#2a1d16',   // dark hair, brows, moustache and goatee
  A: SKIN.K, a: SKIN.k, R: SKIN.l,
};
const alt = (name, top, pants, extra = {}) => ({
  name,
  colors: { ...BASE_COLORS, t: top[0], T: top[1], u: top[2], x: darker(top[1], 0.75), O: top[0], j: pants[0], J: pants[1], i: pants[2], y: darker(pants[1], 0.78), ...extra },
});
const palettes = [
  // black short-sleeved button-up with white buttons, black jeans
  alt('Night Out', ['#24242a', '#16161b', '#35353e'], ['#26262e', '#18181f', '#383842'], { Z: '#f6f6f2', B: '#16161b' }),
  // dark green graduation gown over a white collar
  alt('Grad Night', ['#1f5a3c', '#164530', '#2c7552'], ['#2a2a30', '#1a1a1f', '#3a3a42'],
    { O: '#f6f6f2', Z: '#1f5a3c', B: '#164530', A: '#164530', a: '#1f5a3c', R: '#2c7552' }),
];

// ---------------------------------------------------------------------------
// Poses and animations for his smash attacks and specials.
// ---------------------------------------------------------------------------
const FISTS = { handF: 'fist', handB: 'fist' };
const STAND = { torso: 2, armF: [4, 10], armB: [-6, 8], legF: [5, -4], legB: [-6, -2] };
const AIR = { torso: 6, armF: [75, 20], armB: [-80, 15], legF: [18, -28], legB: [-14, -18], footF: 25, footB: 35 };
// vape at his lips: hand up by his mouth
const HIT = { torso: -4, head: -6, armF: [30, 150], armB: [-10, 20], legF: [8, -6], legB: [-8, -4], handF: 'fist' };
const BLOW = { torso: 12, head: 4, armF: [40, 90], armB: [-20, 30], legF: [16, -12], legB: [-12, -6], handF: 'fist', face: 'yell' };

const animations = {
  // Cloud Chaser: a long pull on the vape, then blows a big cloud forward.
  cloudChaser: anim(false, [
    [4, { ...HIT, armF: [10, 100] }],
    [8, HIT],
    [4, { ...HIT, torso: -10, head: -14 }],
    [14, BLOW],
    [10, { torso: 4, armF: [40, 60], armB: [-20, 30], legF: [10, -8], legB: [-8, -4], handF: 'fist' }],
    [1, STAND],
  ]),
  // Flick: flicks a cigarette butt off his thumb.
  flick: anim(false, [
    [5, { torso: -4, armF: [20, 120], armB: [-10, 20], legF: [10, -8], legB: [-8, -4], handF: 'fist' }],
    [5, { torso: -8, armF: [-30, 130], armB: [-10, 20], legF: [12, -10], legB: [-10, -6], handF: 'fist' }],
    [3, { torso: 10, armF: [95, 10], armB: [-20, 30], legF: [18, -14], legB: [-14, -6], handF: 'open', face: 'smile' }],
    [12, { torso: 8, armF: [100, 4], armB: [-20, 30], legF: [18, -14], legB: [-14, -6], handF: 'open', face: 'smile' }],
    [8, { torso: 4, armF: [50, 30], armB: [-20, 30], legF: [10, -8], legB: [-8, -4] }],
    [1, STAND],
  ]),
  // Big Rip: crouches with the vape at his lips, then rides a plume of vapour up.
  bigRip: anim(false, [
    [4, { ...HIT, hip: [0, 6], legF: [50, -95], legB: [30, -80] }],
    [4, { ...HIT, hip: [0, 4], torso: -10, head: -16, legF: [40, -70], legB: [20, -60] }],
    [20, { torso: -6, head: -20, armF: [30, 150], armB: [-140, -20], legF: [20, -40], legB: [-14, -30], footF: 30, footB: 40, handF: 'fist', face: 'yell' }],
    [10, { torso: 4, armF: [80, 30], armB: [-90, 20], legF: [20, -30], legB: [-14, -20], handF: 'fist' }],
    [14, AIR],
  ]),
  // Stub Out: lifts a foot and grinds a cigarette out under his heel.
  stubOut: anim(false, [
    [5, { torso: -4, armF: [40, 40], armB: [-40, 40], legF: [70, -90], legB: [-4, -4] }],
    [4, { hip: [0, -1], torso: -6, armF: [60, 40], armB: [-60, 40], legF: [86, -110], legB: [-4, -4], face: 'yell' }],
    [3, { hip: [0, 3], torso: 10, armF: [20, 30], armB: [-30, 30], legF: [24, -10], legB: [-14, -10], face: 'yell' }],
    [6, { hip: [0, 3], torso: 10, armF: [20, 30], armB: [-30, 30], legF: [28, -12], legB: [-14, -10] }],
    [6, { hip: [0, 3], torso: 10, armF: [20, 30], armB: [-30, 30], legF: [20, -8], legB: [-14, -10] }],
    [10, { torso: 4, armF: [10, 20], armB: [-10, 20], legF: [10, -6], legB: [-8, -4], face: 'smile' }],
    [2, STAND],
  ]),
  // --- Smash attacks ---
  // Exhale: a huge pull (held here while charging), then a long jet of smoke straight ahead.
  fsmash: anim(false, [
    [5, { ...HIT, armF: [10, 100] }],
    [7, { ...HIT, torso: -12, head: -16 }],
    [3, { ...HIT, torso: -14, head: -18 }],
    [3, { torso: 22, head: 10, armF: [-20, 60], armB: [-40, 40], legF: [30, -24], legB: [-20, -4], handF: 'fist', face: 'yell' }],
    [14, { torso: 26, head: 12, armF: [-30, 60], armB: [-50, 40], legF: [32, -26], legB: [-20, -4], handF: 'fist', face: 'yell' }],
    [12, { torso: 8, armF: [30, 60], armB: [-20, 30], legF: [14, -10], legB: [-10, -4], handF: 'fist' }],
    [6, STAND],
  ]),
  // Smoke Rings: tilts his head back and blows rings straight up.
  usmash: anim(false, [
    [5, HIT],
    [5, { ...HIT, torso: 8, head: 4 }],
    [2, { ...HIT, torso: 8, head: 6 }],
    [16, { torso: -14, head: -40, armF: [30, 70], armB: [-20, 30], legF: [8, -6], legB: [-8, -4], handF: 'fist', face: 'yell' }],
    [10, { torso: -4, head: -10, armF: [30, 80], armB: [-20, 30], legF: [8, -6], legB: [-8, -4], handF: 'fist' }],
    [8, STAND],
  ]),
  // Lighter Flare: crouches, flicks a lighter, and flames burst low on both sides.
  dsmash: anim(false, [
    [5, { hip: [0, 4], torso: 20, armF: [40, 60], armB: [-20, 40], legF: [30, -50], legB: [-10, -40], handF: 'fist' }],
    [5, { hip: [0, 8], torso: 30, head: -6, armF: [60, 40], armB: [-20, 40], legF: [50, -90], legB: [-10, -60], handF: 'fist' }],
    [2, { hip: [0, 8], torso: 30, head: -6, armF: [62, 40], armB: [-20, 40], legF: [50, -90], legB: [-10, -60], handF: 'fist', face: 'yell' }],
    [12, { hip: [0, 8], torso: 34, head: -10, armF: [70, 20], armB: [-60, 30], legF: [50, -90], legB: [-10, -60], handF: 'fist', face: 'yell' }],
    [12, { hip: [0, 4], torso: 14, armF: [40, 40], armB: [-20, 30], legF: [24, -30], legB: [-10, -20], handF: 'fist' }],
    [6, STAND],
  ]),
};

// ---------------------------------------------------------------------------
// Moves. See simeon.js for the hitbox format.
// ---------------------------------------------------------------------------
const hit = (from, to, at, r, damage, angle, bkb, kbg, extra = {}) => ({
  frames: [from, to], at, r, damage: Math.round(damage * 10), angle, bkb, kbg, ...extra,
});
const hits = (from, to, list, damage, angle, bkb, kbg, extra) =>
  list.map(([at, r]) => hit(from, to, at, r, damage, angle, bkb, kbg, extra));

const moves = {
  // Neutral special: Cloud Chaser. A long pull on the vape, then blows a
  // puff of vapour that bounces slowly along the floor like a fireball and
  // pops on whoever it hits (4%). Slow to come out and to recover from;
  // two at a time at most.
  cloudChaser: { faf: 56, limit: 2, gear: { kind: 'vape', from: 0, to: 30 },
    spawn: { frame: 20, from: 'neck', projectile: 'cloud' }, hitboxes: [] },

  // Side special: Flick. Flicks a lit cigarette butt in a fast, low arc: 7%.
  flick: { faf: 32, gear: { kind: 'cig', from: 0, to: 12 },
    spawn: { frame: 13, from: 'fistF', projectile: 'butt' }, hitboxes: [] },

  // Up special: Big Rip. Takes a big hit and rides a plume of vapour straight
  // up, steering freely; the plume under him hits several times (2% each)
  // and pops them up at the top (4%). Falls helpless afterwards.
  bigRip: { faf: 52, landLag: 16, helpless: true, gear: { kind: 'plume', from: 8, to: 30 },
    fly: { frame: 8, frames: 18, rise: px(4.4), accel: px(1.4), drift: px(1.4), steer: px(0.14) },
    ledgeGrab: { from: 8, rising: true },
    hitboxes: [
      ...[0, 1, 2, 3].map((i) => hit(9 + i * 4, 10 + i * 4, 'hip', 11, 2, 90, 0, 100, { fkb: 40, group: i, off: [0, 10] })),
      hit(26, 28, 'hip', 12, 4, 80, 50, 70, { group: 4, off: [0, 6] }),
    ] },

  // Down special: Stub Out. Grinds a cigarette out under his heel: 9% right
  // under his foot, and a spray of embers on both sides (5%).
  stubOut: { faf: 44, float: { gravity: 40, fall: 50 }, gear: { kind: 'embers', from: 12, to: 26, active: [12, 26] }, hitboxes: [
      hit(12, 15, 'footF', 9, 9, 75, 45, 70, { group: 0 }),
      hit(13, 17, 'hip', 9, 5, 60, 40, 60, { group: 1, off: [16, 16], radial: true }),
      hit(13, 17, 'hip', 9, 5, 60, 40, 60, { group: 1, off: [-16, 16], radial: true }),
    ] },

  // --- Smash attacks (see simeon.js for how they are performed) ---
  // Forward: Exhale. A long jet of smoke straight ahead: 16% close in, a
  // little less at the far end.
  fsmash: { faf: 50, charge: { at: 14, max: 60, smash: true }, gear: { kind: 'vape', fx: 'jet', from: 0, to: 34, active: [16, 30] }, hitboxes: [
      hit(16, 20, 'neck', 9, 16, 361, 34, 98, { off: [14, 0], chargeScale: [160, 224], lagMult: 150 }),
      hit(16, 20, 'neck', 9, 14, 361, 32, 94, { off: [28, 2], chargeScale: [140, 196], lagMult: 150 }),
      hit(17, 21, 'neck', 8, 12, 361, 30, 90, { off: [40, 4], chargeScale: [120, 168], lagMult: 130 }),
    ] },
  // Up: Smoke Rings. Three rings straight up (2% each) that hold them, then
  // a big one (8%).
  usmash: { faf: 46, charge: { at: 11, max: 60, smash: true }, gear: { kind: 'vape', fx: 'rings', from: 0, to: 36, active: [12, 28] }, hitboxes: [
      ...[0, 1, 2].map((i) => hit(12 + i * 4, 13 + i * 4, 'neck', 10, 2, 95, 0, 100, { fkb: 30, group: i, off: [2, -16 - i * 6] })),
      hit(24, 27, 'neck', 12, 8, 88, 40, 100, { group: 3, off: [2, -30], chargeScale: [80, 140], lagMult: 150 }),
    ] },
  // Down: Lighter Flare. Flicks a lighter and flames burst low on both sides: 14%.
  dsmash: { faf: 48, charge: { at: 11, max: 60, smash: true }, gear: { kind: 'lighter', from: 4, to: 30, active: [13, 24] }, hitboxes: [
      hit(13, 16, 'hip', 11, 14, 40, 30, 94, { off: [17, 8], radial: true, chargeScale: [140, 196], lagMult: 150 }),
      hit(13, 16, 'hip', 11, 14, 40, 30, 94, { off: [-17, 8], radial: true, chargeScale: [140, 196], lagMult: 150 }),
    ] },
};

export const ZEID = {
  ...SIMEON,
  id: 'zeid',
  name: 'ZEID',
  lastName: 'MEHREGANI',
  heightInches: 70,
  stats,
  parts,
  palettes,
  trailColors: ['#8a8f99', '#d9dde4', '#ffffff'],   // smoke greys
  animations: { ...SIMEON.animations, ...animations },
  moves: { ...SIMEON.moves, ...moves },
  specials: { neutral: 'cloudChaser', side: 'flick', up: 'bigRip', down: 'stubOut' },
  projectiles: {
    // a ball of vapour that bounces along the floor (like a fireball) and
    // pops on whoever it hits: 4%
    cloud: { draw: 'cloud', r: 5, hitPad: 1, speed: [px(1.7), px(-0.6)], chargeSpeed: [0, 0],
      gravity: px(0.17), maxFall: px(3.2), bounceTo: px(2.3), bounce: 0, bounceKeepX: 256, minBounce: 0, maxBounces: 99,
      rollFriction: 0, minRollSpeed: 0, popUp: px(1.2),
      life: 80, fadeFrames: 10, hit: { damage: 40, angle: 361, bkb: 18, kbg: 45 } },
    // a lit cigarette butt, flicked
    butt: { type: 'dart', draw: 'butt', r: 2, hitPad: 3, speed: [px(5.0), px(1.3)], chargeSpeed: [0, 0], gravity: px(0.13), maxFall: px(4),
      life: 50, fadeFrames: 4, hit: { damage: 70, angle: 361, bkb: 30, kbg: 60 } },
  },
};
