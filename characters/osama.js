// OSAMA — an MMA fighter. Every special and smash attack is a fight move:
// strikes, a flying knee, ground and pound and a suplex. He shares every
// normal attack, grab and throw with Simeon (same skeleton, same
// animations); his look, a few stats, his smash attacks and his four
// specials are his own.
import { px } from '../engine/fixed.js';
import { anim } from '../engine/skeleton.js';
import { SIMEON } from './simeon.js';

const stats = {
  ...SIMEON.stats,
  weight: 100,
  runSpeed: px(2.95),
  dashSpeed: px(3.25),
};

// ---------------------------------------------------------------------------
// Body parts: pixel art at 2 art pixels per world pixel, facing right.
// Short light brown hair, round wire glasses (G: first skin only), a smile.
// ---------------------------------------------------------------------------
const HEAD = [
  '...kkkkkkk....',
  '.kkkkkkkkkkk..',
  'kKkkkkkkkkkkl.',
  'kKkkkkkkkkkkl.',
  'KKkkkkkkkbbbk.',
  'KKkkkkkkGGGGk.',
  'KkKqGGGGGmeeG.',
  'KkKqkkkkkGGGkl',
  'KKkKKkkkkkkkKl',
  'KKkKkkkkkkkkk.',
  '.KKkkkkkkkqpk.',
  '.KKkkkkkkkkq..',
  '..KKkkkkkkkk..',
  '....KKKKKkK...',
];
const face = (...edits) => {
  const rows = HEAD.map((r) => r.split(''));
  for (const [r, c, str] of edits) for (let i = 0; i < str.length; i++) rows[r][c + i] = str[i];
  return { pivot: [5, 14], px: rows.map((r) => r.join('')) };
};
// Short light brown hair, a little fuller on top at the front, cut close
// at the back and sides. (hair column = head column + 1, row = head row + 4)
const HAIR = [
  '.................',
  '...hhhhhhhhh.....',
  '..hhhnhhhhnhh....',
  '.hhhhhhHhhhhhh...',
  'hhhHhhhhhhhhhhh..',
  'hhhhhhhhhhhhhhh..',
  'hhhhhhhhhhh.hh...',
  'hhhhh............',
  'hhhh.............',
  '.hh..............',
];
const rows = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));
const parts = {
  ...SIMEON.parts,   // hands, legs and sneakers are shared
  head_neutral: face(),
  head_smile: face([10, 9, 'qmmp']),
  head_yell: face([9, 10, 'rrk'], [10, 10, 'rrr'], [11, 10, 'rr']),
  head_hurt: face([4, 9, 'bbk'], [6, 9, 'eee'], [10, 10, 'rr']),
  hair: { pivot: [6, 18], px: HAIR },
  // a tee (or a blazer: O is the shirt showing down the front) with a thin chain
  torso: {
    pivot: [6, 26],
    px: [
      '.....kkkk.....',
      '.....KcvcK....',
      '....TCtOOttv..',
      '...TTttOOttuvc',
      '..TTttttOOtucv',
      '.TTtttttOOtuvc',
      'TTTttttttOOcvu',
      'TTttttttttOtCv',
      'TTtttttttttcvu',
      'TTxttttttttvCu',
      'TTTxtttttttuuu',
      'TTtTxtttttttuu',
      '.TTttxttttttu.',
      '.TTtttttttttu.',
      '.TTtttttttxtu.',
      '.TTttttttxttu.',
      '.TTtttttxtttu.',
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
  // short sleeves over bare arms (A / a are skin), or long blazer sleeves
  upperArm: { pivot: [2, 0], px: ['TTtuu', 'TTttu', 'TTttu', 'TTxtu', 'xTTtx', 'AaaaR', 'AaaaR', 'AaaaR', 'AAaaR', 'AaaaR', 'AaaaR', 'AaaaR', '.Aaa.'] },
  lowerArm: { pivot: [2, 0], px: ['AaaaR', 'AaaaR', 'AaaaR', 'AAaaR', 'AaaaR', 'AaaaR', '.AaaR', '.AaaR', '.AaR.', '.AaR.', '.AaR.'] },
};

const darker = (hex, k) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('');
const SKIN = { k: '#f2d4bf', K: '#d9ab92', l: '#fde6d6', q: '#c38f78', p: '#d08d86' };
const BASE_COLORS = {
  ...SIMEON.palettes[0].colors,
  ...SKIN,
  h: '#8a6a4a', H: '#6e5236', n: '#ad8c64', b: '#6e5236',   // short light brown hair
  G: '#b9a77a',                                             // thin gold wire frames
  A: SKIN.K, a: SKIN.k, R: SKIN.l,                          // bare arms
};
const alt = (name, top, pants, extra = {}) => ({
  name,
  colors: { ...BASE_COLORS, t: top[0], T: top[1], u: top[2], x: darker(top[1], 0.75), O: top[0], j: pants[0], J: pants[1], i: pants[2], y: darker(pants[1], 0.78), ...extra },
});
const palettes = [
  // black tee, dark jeans, round glasses
  alt('Black Tee', ['#2b2b33', '#1c1c24', '#3f3f4b'], ['#2c2f44', '#1d1f30', '#3e425c'], { B: '#1c1c24' }),
  // light blue blazer over a white shirt, navy trousers, no glasses
  alt('Blazer', ['#a9c3df', '#839fbf', '#c8dcf0'], ['#2b3550', '#1d2539', '#3c4866'],
    { O: '#f6f6f2', B: '#1d2539', G: SKIN.k, A: '#839fbf', a: '#a9c3df', R: '#c8dcf0', w: '#5a3a24', W: '#2e1d12', g: '#5a3a24' }),
];

// ---------------------------------------------------------------------------
// Poses and animations for his smash attacks and specials.
// ---------------------------------------------------------------------------
const FISTS = { handF: 'fist', handB: 'fist' };
const STAND = { torso: 2, armF: [4, 10], armB: [-6, 8], legF: [5, -4], legB: [-6, -2] };
const AIR = { torso: 6, armF: [75, 20], armB: [-80, 15], legF: [18, -28], legB: [-14, -18], footF: 25, footB: 35 };
// fighting stance: hands up guarding the chin
const GUARD = { hip: [0, 2], torso: 8, head: 4, armF: [40, 120], armB: [30, 125], legF: [20, -12], legB: [-16, -6], ...FISTS };
const SUPERMAN = { torso: 20, head: -6, armF: [96, 4], armB: [-60, 40], legF: [10, -20], legB: [-60, -50], footB: 30, ...FISTS, face: 'yell' };
// rising flying knee: front knee driven up, arms pulled down
const KNEE = { torso: -12, head: -10, armF: [-30, 60], armB: [-50, 50], legF: [120, -150], legB: [-20, -20], footB: 30, ...FISTS, face: 'yell' };
// shooting in for the suplex: low, arms out to wrap the waist
const SHOOT = { hip: [0, 6], torso: 40, head: -24, armF: [90, 30], armB: [80, 40], legF: [50, -60], legB: [-40, -20], handF: 'open', handB: 'open', face: 'yell' };

const animations = {
  // Superman Punch: a skip, a leap, and a straight right thrown from the air.
  supermanPunch: anim(false, [
    [4, GUARD],
    [4, { ...GUARD, hip: [0, 4], legF: [30, -40], legB: [-10, -30] }],
    [4, { torso: 6, armF: [-40, 110], armB: [30, 100], legF: [20, -30], legB: [-40, -40], ...FISTS }],
    [3, SUPERMAN],
    [16, SUPERMAN],
    [10, { torso: 8, armF: [60, 40], armB: [-30, 40], legF: [20, -24], legB: [-14, -18], ...FISTS }],
    [2, AIR],
  ]),
  // Suplex: shoots in low...
  suplexShoot: anim(false, [
    [6, { ...GUARD, hip: [0, 4] }],
    [6, SHOOT],
    [14, { ...SHOOT, armF: [96, 10], armB: [90, 16] }],
    [12, { hip: [0, 3], torso: 20, armF: [60, 30], armB: [40, 40], legF: [30, -30], legB: [-20, -10], handF: 'open', handB: 'open' }],
    [4, STAND],
  ]),
  // ...and if he catches them, lifts them and arches back over his own head.
  suplex: anim(false, [
    [4, { hip: [0, 4], torso: 20, head: -10, armF: [60, 70], armB: [50, 80], legF: [26, -30], legB: [-20, -20], handF: 'open', handB: 'open', face: 'yell' }],
    [6, { hip: [0, 2], torso: -10, head: -20, armF: [150, 60], armB: [140, 60], legF: [12, -10], legB: [-12, -10], handF: 'open', handB: 'open', face: 'yell' }],
    [8, { rot: -70, hip: [-4, 6], torso: -20, head: -30, armF: [190, 40], armB: [180, 40], legF: [10, -6], legB: [-6, -6], handF: 'open', handB: 'open', face: 'yell' }],
    [16, { rot: -100, hip: [-8, 12], torso: -20, head: -30, armF: [200, 30], armB: [190, 30], legF: [10, -6], legB: [-6, -6], handF: 'open', handB: 'open' }],
    [8, { hip: [0, 6], torso: 10, armF: [40, 40], armB: [-30, 40], legF: [40, -60], legB: [-10, -40] }],
    [4, STAND],
  ]),
  // Flying Knee: jumps off the back foot and drives the front knee up.
  flyingKnee: anim(false, [
    [4, { hip: [0, 5], torso: 14, armF: [40, 100], armB: [30, 110], legF: [40, -70], legB: [10, -60], ...FISTS }],
    [4, KNEE],
    [12, { ...KNEE, legF: [126, -156] }],
    [8, { torso: 6, armF: [100, 40], armB: [-80, 30], legF: [40, -60], legB: [-20, -30], ...FISTS }],
    [20, AIR],
  ]),
  // Ground and Pound: drops onto one knee and rains down hammer fists.
  groundAndPound: anim(false, [
    [4, { hip: [0, 6], torso: 30, head: -10, armF: [150, 40], armB: [-20, 40], legF: [60, -100], legB: [-20, -60], handF: 'fist' }],
    ...Array.from({ length: 3 }, (_, i) => [[3, { hip: [0, 10], torso: 40, head: -16, armF: [160, 30], armB: [-30, 40], legF: [70, -110], legB: [-30, -90], handF: 'fist' }],
      [3, { hip: [0, 10], torso: 44, head: -18, armF: [60, 10], armB: [-30, 40], legF: [70, -110], legB: [-30, -90], handF: 'fist', face: 'yell' }]]).flat(),
    [5, { hip: [0, 10], torso: 36, head: -16, armF: [180, 20], armB: [170, 20], legF: [70, -110], legB: [-30, -90], ...FISTS }],
    [3, { hip: [0, 12], torso: 50, head: -20, armF: [56, 6], armB: [50, 10], legF: [70, -110], legB: [-30, -90], ...FISTS, face: 'yell' }],
    [12, { hip: [0, 10], torso: 40, head: -16, armF: [56, 10], armB: [50, 14], legF: [70, -110], legB: [-30, -90], ...FISTS }],
    [10, { hip: [0, 4], torso: 14, armF: [40, 60], armB: [20, 60], legF: [30, -40], legB: [-14, -20], ...FISTS }],
    [2, STAND],
  ]),
  // --- Smash attacks ---
  // Head Kick: chambers the knee and whips a roundhouse up to head height.
  fsmash: anim(false, [
    [6, GUARD],
    [6, { ...GUARD, torso: -6, legF: [90, -110], legB: [-6, -4] }],
    [3, { ...GUARD, torso: -8, legF: [96, -116], legB: [-6, -4], face: 'yell' }],
    [3, { hip: [0, -1], torso: -30, head: 10, armF: [-30, 60], armB: [40, 100], legF: [128, -10], legB: [-6, -4], footF: -20, ...FISTS, face: 'yell' }],
    [8, { hip: [0, -1], torso: -34, head: 12, armF: [-40, 50], armB: [40, 100], legF: [134, -6], legB: [-6, -4], footF: -20, ...FISTS, face: 'yell' }],
    [12, { ...GUARD, torso: -10, legF: [60, -80] }],
    [8, STAND],
  ]),
  // Uppercut: dips low, then drives an uppercut straight up, rising onto his toes.
  usmash: anim(false, [
    [4, GUARD],
    [5, { ...GUARD, hip: [0, 6], torso: 20, armF: [20, 120], legF: [30, -50], legB: [-20, -30] }],
    [2, { ...GUARD, hip: [0, 6], torso: 20, armF: [16, 124], legF: [30, -50], legB: [-20, -30], face: 'yell' }],
    [3, { hip: [0, -3], torso: -6, head: -16, armF: [170, 20], armB: [30, 110], legF: [6, -4], legB: [-6, -4], footF: 30, footB: 30, ...FISTS, face: 'yell' }],
    [8, { hip: [0, -3], torso: -8, head: -18, armF: [176, 14], armB: [30, 110], legF: [6, -4], legB: [-6, -4], footF: 30, footB: 30, ...FISTS, face: 'yell' }],
    [12, GUARD],
    [6, STAND],
  ]),
  // Leg Kicks: a low kick to the shin in front, then spins into one behind.
  dsmash: anim(false, [
    [5, GUARD],
    [5, { ...GUARD, legF: [60, -60] }],
    [2, { ...GUARD, legF: [64, -64], face: 'yell' }],
    [5, { hip: [0, 2], torso: -10, armF: [-20, 80], armB: [40, 100], legF: [80, -4], legB: [-10, -6], footF: -10, ...FISTS, face: 'yell' }],
    [4, { hip: [0, 2], torso: 10, armF: [30, 100], armB: [-20, 80], legF: [10, -10], legB: [-30, -20], ...FISTS }],
    [5, { hip: [0, 2], torso: 14, armF: [40, 100], armB: [-20, 80], legF: [10, -6], legB: [-82, -4], footB: -10, ...FISTS, face: 'yell' }],
    [12, GUARD],
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
  // Neutral special: Superman Punch. Leaps forward and throws a straight
  // punch from the air: 11%. Once per jump in the air.
  supermanPunch: { faf: 46, landLag: 10, once: true, noDrift: true,
    rocket: { frame: 9, frames: 20, speed: [px(3.0), px(3.0)], lift: px(2.4), gravity: 70, drag: 8, bounce: [px(0.6), px(1.4)] },
    ledgeGrab: { from: 20 },
    trail: { part: 'fistF', from: 13, to: 26, width: 7, straight: true },
    hitboxes: hits(13, 26, [['fistF', 8], ['elbowF', 6]], 11, 361, 40, 80) },

  // Side special: Suplex. Shoots in low for a double-leg; if he catches
  // someone, he lifts them and arches back, slamming them behind him (12%).
  // Only grabs on the ground.
  suplexShoot: { faf: 42, landLag: 12, once: true, noDrift: true,
    rocket: { frame: 8, frames: 14, speed: [px(3.8), px(3.8)], lift: 0, gravity: 30, drag: 16, bounce: [0, 0], ground: true },
    grab: { frames: [9, 24], onlyGround: true, throw: 'suplex', boxes: [{ at: 'handF', r: 9, off: [4, 0] }, { at: 'chest', r: 8, off: [6, 0] }] },
    hitboxes: [] },

  // Up special: Flying Knee. Leaps straight up driving a knee: 12% at the
  // start, 5% after. Steers a little. Falls helpless afterwards.
  flyingKnee: { faf: 48, landLag: 14, helpless: true,
    fly: { frame: 4, frames: 17, rise: px(4.7), accel: px(1.8), drift: px(1.0), steer: px(0.09) },
    ledgeGrab: { from: 4, rising: true },
    trail: { part: 'kneeF', from: 4, to: 22, width: 8 },
    hitboxes: [
      ...hits(4, 9, [['kneeF', 9], ['footF', 6]], 12, 80, 40, 82, { group: 0 }),
      ...hits(10, 21, [['kneeF', 8], ['footF', 6]], 5, 70, 40, 70, { group: 1 }),
    ] },

  // Down special: Ground and Pound. Drops onto a knee and hammers down in
  // front of him: three hammer fists (3% each) and a heavy last blow (6%,
  // pops them up). Hits fighters lying on the floor too.
  groundAndPound: { faf: 52, float: { gravity: 40, fall: 50 }, hitboxes: [
      ...[0, 1, 2].map((i) => hit(6 + i * 6, 7 + i * 6, 'fistF', 9, 3, 40, 0, 100, { fkb: 25, group: i, off: [2, 2] })),
      hit(26, 28, 'fistF', 10, 6, 80, 55, 70, { group: 3, off: [2, 2] }),
    ] },

  // --- Smash attacks (see simeon.js for how they are performed) ---
  // Forward: Head Kick. A roundhouse to the head: 17% at the shin and foot.
  fsmash: { faf: 50, charge: { at: 15, max: 60, smash: true },
    trail: { part: 'toeF', from: 15, to: 20, width: 9, arc: true }, hitboxes: [
      ...hits(16, 19, [['toeF', 9], ['shinF', 8], ['kneeF', 6]], 17, 361, 32, 98, { chargeScale: [170, 238], lagMult: 150 }),
    ] },
  // Up: Uppercut. Rises onto his toes with an uppercut straight up: 15%.
  usmash: { faf: 46, charge: { at: 11, max: 60, smash: true },
    trail: { part: 'fistF', from: 11, to: 16, width: 8, arc: true }, hitboxes: [
      ...hits(12, 16, [['fistF', 9], ['elbowF', 7]], 15, 88, 34, 96, { chargeScale: [150, 210], lagMult: 150, off: [0, -3] }),
    ] },
  // Down: Leg Kicks. A low kick in front, then one behind: 13% each, low and away.
  dsmash: { faf: 50, charge: { at: 11, max: 60, smash: true }, hitboxes: [
      ...hits(13, 16, [['toeF', 9], ['shinF', 8]], 13, 30, 32, 92, { group: 0, chargeScale: [130, 182], lagMult: 150 }),
      ...hits(22, 25, [['toeB', 9], ['shinB', 8]], 13, 30, 32, 92, { group: 1, dir: -1, chargeScale: [130, 182], lagMult: 150 }),
    ] },
};

export const OSAMA = {
  ...SIMEON,
  id: 'osama',
  name: 'OSAMA',
  heightInches: 70,
  stats,
  parts,
  palettes,
  trailColors: ['#c2322e', '#ff8a5c', '#ffffff'],   // fight-night red
  animations: { ...SIMEON.animations, ...animations },
  moves: { ...SIMEON.moves, ...moves },
  specials: { neutral: 'supermanPunch', side: 'suplexShoot', up: 'flyingKnee', down: 'groundAndPound' },
  // his own throws, used by the Suplex (path: [frame, forward, up] of the opponent)
  throws: {
    suplex: {
      anim: 'suplex', release: 18, faf: 42, dir: -1,
      path: [[0, 14, 0], [4, 12, -10], [10, 2, -30], [14, -12, -20], [18, -20, -2]],
      hit: { damage: 120, angle: 60, bkb: 70, kbg: 62 },     // 12%, slammed down behind him and bounced away
    },
  },
};
