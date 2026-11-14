// LUCA — a DJ with a head for markets. He shares every normal attack, grab
// and throw with Simeon (same skeleton, same animations); his look, a few
// stats and his four specials are his own.
import { px } from '../engine/fixed.js';
import { anim } from '../engine/skeleton.js';
import { SIMEON } from './simeon.js';

const stats = {
  ...SIMEON.stats,
  weight: 102,                // a little heavier: harder to launch
  runSpeed: px(2.7),
  airSpeed: px(2.6),
};

// ---------------------------------------------------------------------------
// Body parts: pixel art at 2 art pixels per world pixel, facing right.
// Thick dark wavy hair, heavy brows, a dark jacket over a black tee, and
// headphones round his neck.
// ---------------------------------------------------------------------------
const HEAD = [
  '...kkkkkkk....',
  '.kkkkkkkkkkk..',
  'kKkkkkkkkkkkl.',
  'kKkkkkkkkkkkl.',
  'KKkkkkkkhhhhh.',
  'KKkkkkkkkhhek.',
  'KkKqkkkkkmeek.',
  'KkKqkkkkkkkkkl',
  'KKkKKkkkkkkkKl',
  'KKkKkkkkkkkkk.',
  '.KKkkkkkkkkpk.',
  '.KKkkkkkkkkk..',
  '..KKkkkkkkkk..',
  '....KKKKKkK...',
];
const face = (...edits) => {
  const rows = HEAD.map((r) => r.split(''));
  for (const [r, c, str] of edits) for (let i = 0; i < str.length; i++) rows[r][c + i] = str[i];
  return { pivot: [5, 14], px: rows.map((r) => r.join('')) };
};
// Thick, tall, wavy hair with a lot of volume on top and at the front.
// (hair column = head column + 1, row = head row + 5)
const HAIR = [
  '.....hh..hhh......',
  '...hhhhhhhhhhhh...',
  '..hhhhnhhhhhnhhhh.',
  '.hhhHnhhhHhhhnhhhh',
  'hhhHhhhhHnhhhhHhhh',
  'hhhhhHhhhhhHnhhhhh',
  'hhHnhhhhHhhhhhHhhh',
  'hhhhhHhhhhhHhhhhhh',
  'hhhHhhhhhhhhhhhhh.',
  'hhhhhhhh.hhh.hh...',
  'hhhhh.............',
  'hhhh..............',
  '.hhh..............',
  '.hh...............',
  '..h...............',
];
const rows = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));
const parts = {
  ...SIMEON.parts,   // hands, legs and sneakers are shared
  head_neutral: face(),
  head_smile: face([10, 10, 'qp']),
  head_yell: face([9, 10, 'rrk'], [10, 10, 'rrr'], [11, 10, 'rr']),
  head_hurt: face([5, 9, 'kkkk'], [6, 9, 'eeek'], [10, 10, 'rr']),
  hair: { pivot: [6, 19], px: HAIR },
  // open jacket over a dark tee (a), headphones round the neck (c / C)
  torso: {
    pivot: [6, 26],
    px: [
      '.....kkkk.....',
      '....CKkkkKC...',
      '...CccCKkCccC.',
      '...TCCttttCCu.',
      '..TTtttttaatuu',
      '.TTttttttaatuu',
      'TTTtttttttaauu',
      'TTttttttttaatu',
      'TTtttttttttaau',
      'TTxttttttttatu',
      'TTTxtttttttauu',
      'TTtTxttttttatu',
      '.TTttxtttttau.',
      '.TTttttttttau.',
      '.TTtttttttxau.',
      '.TTttttttxtau.',
      '.TTtttttxttau.',
      '.TTttttttttau.',
      '.TTxtttttttau.',
      '.TTtxttttttau.',
      '.TTtttttttttu.',
      '.xTTxxxxxxxxx.',
      '.BBBBBBBBccBB.',
      '.JJjjjjjjjjii.',
      '.JJjjjjjjjjji.',
      '.JJjjjjjjjjii.',
      '.JJjjjjjjjjii.',
      '..JJjjjjjjii..',
    ],
  },
  upperArm: { pivot: [2, 0], px: rows(13, (i) => (i === 12 ? '.Ttt.' : i === 5 ? 'TTxtu' : 'TTttu')) },
  lowerArm: { pivot: [2, 0], px: rows(11, (i) => (i >= 9 ? '.xxx.' : i === 3 ? 'TTxtu' : i > 6 ? '.Tttu' : 'TTttu')) },
};

const darker = (hex, k) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('');
const BASE_COLORS = {
  ...SIMEON.palettes[0].colors,
  k: '#bd8660', K: '#996641', l: '#d6a078', q: '#7d4f32', p: '#9c6150',   // skin, lips
  h: '#0f0d12', H: '#1e1b24', n: '#3b3746',                               // black hair, with a shine
  c: '#c9ced8', C: '#6f7684', v: '#ffffff',                               // headphones
  a: '#15151b',                                                           // tee under the jacket
  g: '#f6f6f2',
};
const alt = (name, jacket, jeans, extra = {}) => ({
  name,
  colors: { ...BASE_COLORS, t: jacket[0], T: jacket[1], u: jacket[2], x: darker(jacket[1], 0.72), j: jeans[0], J: jeans[1], i: jeans[2], y: darker(jeans[1], 0.78), ...extra },
});
const palettes = [
  alt('Night Shift', ['#2f3242', '#1e202c', '#474b60'], ['#4a5064', '#343949', '#636a82'], { g: '#39d98a' }),
  alt('Bull Market', ['#2f9e5b', '#1f7443', '#58c481'], ['#26262e', '#18181f', '#383842'], { a: '#f1f1ee', g: '#ffe14a' }),
];

// ---------------------------------------------------------------------------
// Special move poses and animations.
// ---------------------------------------------------------------------------
const FISTS = { handF: 'fist', handB: 'fist' };
const STAND = { torso: 2, armF: [4, 10], armB: [-6, 8], legF: [5, -4], legB: [-6, -2] };
const AIR = { torso: 6, armF: [75, 20], armB: [-80, 15], legF: [18, -28], legB: [-14, -18], footF: 25, footB: 35 };
// at the decks: one hand on a headphone cup, the other on the mixer
const DJ_MIX = { hip: [0, 2], torso: 16, head: 8, armF: [62, 38], armB: [-150, -125], legF: [16, -16], legB: [-12, -8], handF: 'open', face: 'smile' };
const DJ_DROP = { hip: [0, -1], torso: -8, head: -12, armF: [172, 8], armB: [150, 14], legF: [10, -6], legB: [-10, -4], ...FISTS, face: 'yell' };
const THROW_BACK = { torso: -12, head: -4, armF: [-115, 55], armB: [45, 30], legF: [20, -14], legB: [-14, -6], handF: 'fist' };
const TP_COIL = { hip: [0, 4], torso: 10, armF: [60, 110], armB: [40, 115], legF: [40, -75], legB: [20, -60], ...FISTS };
// spinning on his toes with both arms raised, like a pirouette
const TP_SPIN = { hip: [0, -1], torso: 0, head: -6, armF: [160, 24], armB: [-160, -24], legF: [5, -3], legB: [-3, -3], footF: -25, footB: -25, handF: 'open', handB: 'open', face: 'smile' };
const TP_OUT = { torso: -4, head: -8, armF: [120, 10], armB: [-120, -10], legF: [14, -8], legB: [-14, -6], handF: 'open', handB: 'open', face: 'yell' };
const DIVE_TUCK = { torso: 30, head: 20, armF: [50, 100], armB: [30, 110], legF: [95, -135], legB: [80, -130], ...FISTS };
const DIVE_KICK = { torso: -16, head: 4, armF: [-60, 30], armB: [-110, 20], legF: [52, -4], legB: [30, -70], footF: -30, ...FISTS, face: 'yell' };

const animations = {
  // Bass Drop: leans over the decks (holding here while charging), then
  // throws both hands up as the beat drops.
  bassDrop: anim(false, [
    [6, { torso: 8, armF: [40, 40], armB: [-60, -60], legF: [10, -8], legB: [-8, -4], handF: 'open' }],
    [6, DJ_MIX],
    [2, DJ_MIX],
    [3, DJ_DROP],
    [12, { ...DJ_DROP, hip: [0, 0], torso: -4 }],
    [10, { torso: 4, armF: [80, 40], armB: [40, 50], legF: [8, -6], legB: [-8, -4] }],
    [2, STAND],
  ]),
  // Supply & Demand: winds up and flings a chart arrow. The tap version
  // points it up; the held version hurls it over the top to crash down.
  supplyDemand: anim(false, [
    [5, { torso: -6, armF: [-60, 70], armB: [30, 40], legF: [14, -10], legB: [-10, -6], handF: 'fist' }],
    [5, THROW_BACK],
    [3, THROW_BACK],
    [3, { torso: 4, head: -8, armF: [150, 10], armB: [-30, 40], legF: [20, -14], legB: [-14, -4], handF: 'open', face: 'yell' }],
    [12, { torso: 6, head: -10, armF: [165, 5], armB: [-40, 40], legF: [20, -14], legB: [-14, -4], handF: 'open', face: 'smile' }],
    [10, { torso: 4, armF: [70, 20], armB: [-20, 30], legF: [10, -8], legB: [-8, -4] }],
    [1, STAND],
  ]),
  supplyDemandCrash: anim(false, [
    [5, { torso: -6, armF: [-60, 70], armB: [30, 40], legF: [14, -10], legB: [-10, -6], handF: 'fist' }],
    [5, THROW_BACK],
    [3, { ...THROW_BACK, torso: -20, armF: [-150, 40] }],
    [4, { torso: 14, armF: [110, 10], armB: [-30, 40], legF: [26, -20], legB: [-18, -4], handF: 'open', face: 'yell' }],
    [14, { hip: [0, 2], torso: 30, head: 6, armF: [40, 10], armB: [-50, 40], legF: [34, -30], legB: [-22, -4], handF: 'open', face: 'yell' }],
    [12, { torso: 8, armF: [40, 20], armB: [-20, 30], legF: [12, -8], legB: [-8, -4] }],
    [1, STAND],
  ]),
  // Wire Transfer: twirls on the spot with his arms up until he vanishes in
  // a whirl of light, then spins back into view and flings his arms wide.
  wireTransfer: anim(false, [
    [4, TP_COIL],
    [10, TP_SPIN],
    [12, { ...TP_SPIN, hip: [0, -2] }],
    [10, { ...TP_SPIN, hip: [0, -2] }],
    [6, TP_OUT],
    [12, TP_OUT],
    [2, AIR],
  ]),
  // Stage Dive: springs off the floor in a tucked flip, then kicks out
  // heel first on the way down.
  stageDive: anim(false, [
    [6, { hip: [0, 6], torso: 14, armF: [40, 60], armB: [-20, 50], legF: [50, -95], legB: [30, -80], ...FISTS }],
    [6, { ...DIVE_TUCK, rot: 30 }],
    [10, { ...DIVE_TUCK, rot: 260 }],
    [6, { ...DIVE_KICK, rot: 360 }],
    [16, { ...DIVE_KICK, rot: 360 }],
    [8, { ...AIR, rot: 360 }],
  ]),
};

// ---------------------------------------------------------------------------
// Special moves. See simeon.js for the hitbox format.
// ---------------------------------------------------------------------------
const hit = (from, to, at, r, damage, angle, bkb, kbg, extra = {}) => ({
  frames: [from, to], at, r, damage: Math.round(damage * 10), angle, bkb, kbg, ...extra,
});
const hits = (from, to, list, damage, angle, bkb, kbg, extra) =>
  list.map(([at, r]) => hit(from, to, at, r, damage, angle, bkb, kbg, extra));

const moves = {
  // Neutral special: Bass Drop. Sets up his decks and a speaker stack; hold
  // to charge (up to a second), let go for a shockwave all round him. The
  // longer the charge, the bigger the blast (14px to 46px) and the damage
  // (6% to 20%). Launches away from him on either side.
  bassDrop: { faf: 46, landContinue: true, noDrift: true, float: { gravity: 20, fall: 25 },
    charge: { at: 12, max: 60 },
    deck: { from: 4, to: 34, blast: 15 },
    hitboxes: [
      hit(15, 18, 'chest', 14, 6, 361, 35, 88, { chargeR: [14, 46], chargeScale: [60, 200], radial: true }),
    ] },

  // Side special: Supply & Demand. Tap for a quick arrow that shoots up and
  // forward (fast, 5%). Hold a moment longer and he hurls a heavy arrow up
  // and over that crashes down (slow, 14%).
  supplyDemand: { faf: 40, charge: { at: 10, max: 12 }, variant: { minCharge: 8, move: 'supplyDemandCrash' },
    spawn: { frame: 14, from: 'fistF', projectile: 'arrowUp' }, hitboxes: [] },
  supplyDemandCrash: { faf: 50, charge: { at: 10, max: 12 },
    spawn: { frame: 16, from: 'fistF', projectile: 'arrowDown' }, hitboxes: [] },

  // Up special: Wire Transfer. Twirls, vanishes and reappears about 150px away in
  // the direction held (straight up if none). Untouchable in between; a
  // small hit where he vanishes and a bigger one where he reappears. Falls
  // helpless afterwards if he ends up in the air.
  wireTransfer: { faf: 56, landLag: 16, helpless: true, float: { gravity: 15, fall: 20 },
    teleport: { vanish: 14, appear: 26, speed: px(12.5) },
    twirl: [[4, 13], [26, 36]],
    ledgeGrab: { from: 26 },
    hitboxes: [
      hit(12, 13, 'chest', 10, 5, 80, 30, 60, { group: 0, radial: true }),
      hit(26, 28, 'chest', 12, 10, 361, 45, 90, { group: 1, radial: true }),
    ] },

  // Down special: Stage Dive. Leaps forward in an arc and kicks down heel
  // first (11%). If it connects he springs back up and away. Once per jump
  // in the air.
  stageDive: { faf: 50, landLag: 14, once: true,
    rocket: { frame: 6, frames: 34, speed: [px(2.7), px(2.7)], lift: px(3.9), gravity: 100, drag: 0, bounce: [px(1.6), px(3.3)] },
    trail: { part: 'toeF', from: 18, to: 40, width: 11, arc: true },
    hitboxes: hits(18, 40, [['toeF', 11], ['shinF', 9], ['kneeF', 7]], 11, 361, 40, 85) },
};

export const LUCA = {
  ...SIMEON,
  id: 'luca',
  name: 'LUCA',
  heightInches: 70,
  stats,
  parts,
  palettes,
  trailColors: ['#1f9e5b', '#7dffb0', '#ffffff'],
  animations: { ...SIMEON.animations, ...animations },
  moves: { ...SIMEON.moves, ...moves },
  specials: { neutral: 'bassDrop', side: 'supplyDemand', up: 'wireTransfer', down: 'stageDive' },
  projectiles: {
    // green arrow: quick, straight, up and forward
    arrowUp: {
      type: 'dart', draw: 'arrow', color: '#39d98a', r: 4, hitPad: 2,
      speed: [px(3.4), px(4.0)], chargeSpeed: [0, 0],
      life: 28, fadeFrames: 4,
      hit: { damage: 50, angle: 85, bkb: 45, kbg: 40 },        // 5%, pops them up
    },
    // red arrow: lobbed up, then crashes down hard
    arrowDown: {
      type: 'dart', draw: 'arrow', color: '#ff4a5a', r: 6, hitPad: 2,
      speed: [px(2.3), px(3.4)], chargeSpeed: [0, 0],
      gravity: px(0.2), maxFall: px(5),
      life: 90, fadeFrames: 4,
      hit: { damage: 140, angle: 60, bkb: 50, kbg: 85 },       // 14%
    },
  },
};
