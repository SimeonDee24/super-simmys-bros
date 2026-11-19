// GINGER — volleyball, surfing, skating and snowboarding, taekwondo and
// Muay Thai, guitar, and a real love of ice cream (and the trucks that sell
// it). She shares every normal attack, grab and throw with Simeon (same
// skeleton, same animations); her look, a few stats, her smash attacks and her
// four specials are her own.
import { px } from '../engine/fixed.js';
import { anim } from '../engine/skeleton.js';
import { SIMEON } from './simeon.js';

const stats = {
  ...SIMEON.stats,
  weight: 90,
  runSpeed: px(3.0),
  airSpeed: px(2.8),
};

// ---------------------------------------------------------------------------
// Body parts: pixel art at 2 art pixels per world pixel, facing right.
// Drawn from Ginger's photos: long wavy hair, dark at the roots and honey
// blonde through the lengths (balayage), with curtain bangs; rosy cheeks; an
// oversized black tee.
// ---------------------------------------------------------------------------
const HEAD = [
  '...kkkkkkk....',
  '.kkkkkkkkkkk..',
  'kkkkkkkkkkkkl.',
  'kkkkkkkkkkkkl.',
  'Kkkkkkkkkkbbk.',
  'Kkkkkkkkkeeek.',
  'Kkkkkkkkkmek..',
  'Kkkkkkkoookkl.',
  'Kkkkkkkookkkk.',
  'KKkkkkkkkkkk..',
  '.KKkkkkkkkpp..',
  '.KKkkkkkkkk...',
  '..KKkkkkkkk...',
  '....KKKKkK....',
];
const face = (...edits) => {
  const rows = HEAD.map((r) => r.split(''));
  for (const [r, c, str] of edits) for (let i = 0; i < str.length; i++) rows[r][c + i] = str[i];
  return { pivot: [5, 14], px: rows.map((r) => r.join('')) };
};
// Long wavy hair (hair column = head column + 3, row = head row + 4): dark
// roots (h, n) on top, blending into honey blonde (a) with lighter streaks (A).
const HAIR = [
  '......hhhhnhh.....',
  '....nhhhhnhhhhn...',
  '...nhhhhnhhhhnhh..',
  '..nhhhhnhhhhnhhhh.',
  '..hhhhnhhhhnhhhhn.',
  '.hhnhhhnhhhnhhhn..',
  '.hnhhhnhhhnhhh....',
  '.nhhhnhhhnhh......',
  '.hhhnhhhnhh.......',
  '.nnannanna........',
  '.nannannan........',
  'nannannann........',
  'annannanna........',
  'aaaaAaaaa.........',
  'aaaAaaaa..........',
  'aaaAaaaaa.........',
  'aaaAaaaaa.........',
  'aaaaAaaa..........',
  'aaaaAaaa..........',
  '.aaaaAaaaa........',
  '.aaaaAaaaaa.......',
  'aaaaAaaaaa........',
  'aaaAaaaaaa........',
  'aaaaAaaaaa........',
  '.aaaaAaaaaa.......',
  '.aaaAaaaaa........',
  'aaaaAaaa..........',
  'aaaAaaaaa.........',
  '.aaaAaaaa.........',
  '.aaaaaa...........',
  '..aaa.............',
];
const rows = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));
const parts = {
  ...SIMEON.parts,
  head_neutral: face(),
  head_smile: face([10, 9, 'ppp']),
  head_yell: face([4, 9, 'kbb'], [10, 9, 'krr'], [11, 9, 'rr']),
  head_hurt: face([5, 9, 'kkkk'], [6, 9, 'eee'], [10, 10, 'rr']),
  hair: { pivot: [8, 18], px: HAIR },
  // an oversized tee: wide, dropped shoulders, hanging low over her jeans
  torso: {
    pivot: [6, 26],
    px: [
      '.....kkkk.....',
      '.....KkkkK....',
      '...TTtkkkttu..',
      '..TTtttttttuu.',
      '.TTtttttttttuu',
      'TTTttttttttttu',
      'TTtttttttttttu',
      'TTtttttttttttu',
      'TTttttttttttuu',
      'TTxttttttttttu',
      'TTTxttttttttuu',
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
      '.TTtttttttttu.',
      '.xTTttttttttx.',
      '.JJjjjjjjjjii.',
      '.JJjjjjjjjjii.',
      '.JJjjjjjjjjii.',
      '.JJjjjjjjjjii.',
      '..JJjjjjjjii..',
    ],
  },
  // loose short sleeves to the elbow
  upperArm: { pivot: [2, 0], px: ['TTtuu', 'TTttu', 'TTttu', 'TTxtu', 'TTttu', 'TTttu', 'xTTtx', 'Kkkkl', 'Kkkkl', 'KKkkl', 'Kkkkl', 'Kkkkl', '.Kkk.'] },
};

const darker = (hex, k) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('');
const BASE_COLORS = {
  ...SIMEON.palettes[0].colors,
  k: '#f3d2b8', K: '#dcae93', l: '#fde6d3', q: '#c6917a', o: '#f2a9a0',   // skin, rosy cheeks
  h: '#3b2a20', n: '#6e4e33', a: '#d9a865', A: '#f1cf8f', b: '#4a3324',   // dark roots to honey blonde; brows
  e: '#1b1310', m: '#ffffff', r: '#8c3a36', p: '#e0868f',                 // eyes, mouth, lips
  w: '#f6f6f2', W: '#bfc5d0', g: '#f6f6f2',
};
const alt = (name, top, pants, extra = {}) => ({
  name,
  colors: { ...BASE_COLORS, t: top[0], T: top[1], u: top[2], x: darker(top[1], 0.72), j: pants[0], J: pants[1], i: pants[2], y: darker(pants[1], 0.78), ...extra },
});
const palettes = [
  // what she wears in the photos: an oversized black tee (light jeans)
  alt('Black Tee', ['#26262c', '#17171c', '#3a3a44'], ['#8fb3d9', '#6b8fb8', '#b3cdea']),
  // surf day: a teal rash guard and white board shorts
  alt('Surf Day', ['#1fa6a6', '#147a7a', '#4fd0cc'], ['#f2efe6', '#cfcabd', '#ffffff'], { g: '#1fa6a6' }),
];

// ---------------------------------------------------------------------------
// Poses and animations for her smash attacks and specials.
// ---------------------------------------------------------------------------
const FISTS = { handF: 'fist', handB: 'fist' };
const OPEN = { handF: 'open', handB: 'open' };
const STAND = { torso: 2, armF: [4, 10], armB: [-6, 8], legF: [5, -4], legB: [-6, -2] };
const AIR = { torso: 6, armF: [75, 20], armB: [-80, 15], legF: [18, -28], legB: [-14, -18], footF: 25, footB: 35 };
// surf stance: low, knees bent, arms out for balance
const SURF = { hip: [0, 6], torso: 10, head: -6, armF: [80, 20], armB: [-70, 20], legF: [40, -70], legB: [-20, -50], footF: 30, footB: 10, ...OPEN, face: 'smile' };
// taekwondo spinning kick: one leg straight out to the side
const TKICK = { torso: -10, head: -6, armF: [40, 60], armB: [-60, 50], legF: [100, -4], legB: [-10, -30], footF: -10, ...FISTS, face: 'yell' };

const animations = {
  // Ice Cream Truck: crouches and sends a toy-sized ice cream truck rolling.
  truck: anim(false, [
    [6, { hip: [0, 4], torso: 18, armF: [-40, 30], armB: [-20, 30], legF: [30, -50], legB: [-10, -30], handF: 'open' }],
    [4, { hip: [0, 6], torso: 30, head: -10, armF: [40, 10], armB: [-30, 30], legF: [40, -70], legB: [-16, -36], handF: 'open', face: 'smile' }],
    [16, { hip: [0, 5], torso: 26, head: -8, armF: [60, 6], armB: [-30, 30], legF: [36, -60], legB: [-14, -32], handF: 'open', face: 'smile' }],
    [10, { torso: 6, armF: [20, 20], armB: [-20, 20], legF: [10, -8], legB: [-8, -4] }],
    [1, STAND],
  ]),
  // Surf's Up: drops into a surf stance on her board and rides a wave forward.
  surf: anim(false, [
    [6, { hip: [0, 3], torso: 10, armF: [30, 30], armB: [-20, 40], legF: [30, -50], legB: [-10, -30] }],
    [6, { ...SURF, torso: 6 }],
    [24, SURF],
    [8, { hip: [0, 3], torso: 4, armF: [60, 30], armB: [-40, 30], legF: [30, -50], legB: [-10, -30] }],
    [10, { torso: 4, armF: [40, 30], armB: [-30, 30], legF: [14, -12], legB: [-12, -6] }],
    [2, STAND],
  ]),
  // Tornado Kick: spins upward kicking (the renderer spins her), then a last kick.
  tornado: anim(false, [
    [4, { hip: [0, 6], torso: 14, armF: [-30, 60], armB: [-50, 60], legF: [50, -95], legB: [30, -80], ...FISTS }],
    [18, TKICK],
    [6, { ...TKICK, torso: -16, legF: [130, -4], face: 'yell' }],
    [8, { torso: 4, armF: [60, 30], armB: [-60, 20], legF: [20, -30], legB: [-14, -20], ...FISTS }],
    [10, AIR],
  ]),
  // Snack Break: pulls out an ice cream cone and takes a big bite.
  snack: anim(false, [
    [8, { torso: 2, armF: [60, 70], armB: [-6, 8], legF: [5, -4], legB: [-6, -2], handF: 'fist' }],
    [10, { torso: -2, head: -4, armF: [40, 120], armB: [-6, 8], legF: [5, -4], legB: [-6, -2], handF: 'fist', face: 'smile' }],
    [6, { torso: 0, head: 6, armF: [36, 128], armB: [-6, 8], legF: [5, -4], legB: [-6, -2], handF: 'fist', face: 'yell' }],
    [14, { torso: -2, head: -2, armF: [40, 118], armB: [-6, 8], legF: [5, -4], legB: [-6, -2], handF: 'fist', face: 'smile' }],
    [10, { torso: 2, armF: [20, 40], armB: [-6, 8], legF: [5, -4], legB: [-6, -2], handF: 'fist', face: 'smile' }],
    [1, STAND],
  ]),
  // --- Smash attacks ---
  // Power Chord: swings her guitar by the neck into them.
  fsmash: anim(false, [
    [6, { torso: -4, armF: [120, 30], armB: [80, 60], legF: [16, -12], legB: [-12, -6], ...FISTS }],
    [7, { hip: [-1, 1], torso: -18, head: 6, armF: [200, 30], armB: [150, 60], legF: [24, -20], legB: [-16, -6], ...FISTS }],
    [3, { hip: [-1, 1], torso: -22, head: 8, armF: [208, 30], armB: [156, 60], legF: [24, -20], legB: [-16, -6], ...FISTS, face: 'yell' }],
    [2, { hip: [1, 1], torso: 6, armF: [130, 0], armB: [100, 40], legF: [30, -24], legB: [-20, -4], ...FISTS, face: 'yell' }],
    [10, { hip: [2, 3], torso: 30, head: -8, armF: [70, 0], armB: [40, 40], legF: [40, -40], legB: [-26, -4], ...FISTS, face: 'yell' }],
    [14, { hip: [0, 2], torso: 14, armF: [60, 20], armB: [20, 40], legF: [24, -22], legB: [-16, -4], ...FISTS }],
    [8, STAND],
  ]),
  // Board Flip: swings her snowboard up and over her head.
  usmash: anim(false, [
    [4, { torso: 8, armF: [40, 50], armB: [30, 50], legF: [12, -10], legB: [-10, -6], ...FISTS }],
    [4, { hip: [0, 3], torso: 16, head: 6, armF: [20, 30], armB: [10, 30], legF: [20, -24], legB: [-12, -14], ...FISTS }],
    [2, { hip: [0, 3], torso: 16, head: 6, armF: [16, 30], armB: [8, 30], legF: [20, -24], legB: [-12, -14], ...FISTS, face: 'yell' }],
    [3, { hip: [0, -1], torso: -4, head: -16, armF: [110, 10], armB: [100, 10], legF: [8, -4], legB: [-8, -4], ...FISTS, face: 'yell' }],
    [3, { hip: [0, -1], torso: -10, head: -20, armF: [180, 4], armB: [170, 4], legF: [8, -4], legB: [-8, -4], ...FISTS, face: 'yell' }],
    [3, { hip: [0, -1], torso: -16, head: -14, armF: [240, 10], armB: [230, 10], legF: [8, -4], legB: [-8, -4], ...FISTS, face: 'yell' }],
    [12, { hip: [0, 1], torso: -10, armF: [262, 20], armB: [250, 20], legF: [8, -6], legB: [-8, -4], ...FISTS }],
    [10, { torso: 2, armF: [60, 30], armB: [40, 30], legF: [8, -6], legB: [-8, -4], ...FISTS }],
    [6, STAND],
  ]),
  // Muay Thai Sweep: drops low and chops a kick through in front, then behind.
  dsmash: anim(false, [
    [5, { hip: [0, 6], torso: 24, armF: [60, 20], armB: [40, 20], legF: [30, -50], legB: [-10, -30], ...FISTS }],
    [5, { hip: [0, 10], torso: 40, head: -16, armF: [70, 20], armB: [50, 20], legF: [40, -60], legB: [-10, -40], ...FISTS }],
    [2, { hip: [0, 10], torso: 40, head: -16, armF: [70, 20], armB: [50, 20], legF: [44, -64], legB: [-10, -40], ...FISTS, face: 'yell' }],
    [4, { hip: [0, 10], torso: 40, head: -16, armF: [70, 20], armB: [50, 20], legF: [92, -4], legB: [-30, -80], ...FISTS, face: 'yell' }],
    [4, { hip: [0, 10], torso: 40, head: -16, armF: [70, 20], armB: [50, 20], legF: [10, -40], legB: [-30, -80], ...FISTS }],
    [5, { hip: [0, 10], torso: 40, head: -16, armF: [70, 20], armB: [50, 20], legF: [30, -80], legB: [-92, -4], ...FISTS, face: 'yell' }],
    [12, { hip: [0, 6], torso: 24, armF: [60, 20], armB: [40, 20], legF: [30, -50], legB: [-10, -30], ...FISTS }],
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
  // Neutral special: Ice Cream Truck. Sends a little ice cream truck rolling
  // along the floor (it falls off edges): 8%, knocking them up and away. One
  // truck at a time.
  truck: { faf: 40, limit: 1, spawn: { frame: 10, from: 'fistF', projectile: 'truck' }, hitboxes: [] },

  // Side special: Surf's Up. Rides her surfboard forward on a wave, the wave
  // hitting anyone in the way (10%). Stays on the floor when used there; once
  // per jump in the air.
  surf: { faf: 54, landLag: 14, once: true, noDrift: true, float: { gravity: 20, fall: 25 },
    gear: { kind: 'surfboard', from: 6, to: 42 },
    rocket: { frame: 12, frames: 24, speed: [px(4.0), px(4.0)], lift: 0, gravity: 30, drag: 10, bounce: [px(0.8), px(1.6)], ground: true },
    ledgeGrab: { from: 26 },
    hitboxes: hits(12, 36, [['footF', 10], ['kneeF', 8]], 10, 55, 50, 78) },

  // Up special: Tornado Kick. A spinning taekwondo kick that carries her
  // straight up, hitting several times (2% each), then a last kick (5%).
  // Falls helpless afterwards.
  tornado: { faf: 46, landLag: 16, helpless: true, twirl: [[4, 22]],
    fly: { frame: 4, frames: 18, rise: px(4.6), accel: px(1.8), drift: px(1.2), steer: px(0.1) },
    ledgeGrab: { from: 4, rising: true },
    trail: { part: 'toeF', from: 4, to: 28, width: 8, arc: true },
    hitboxes: [
      ...[0, 1, 2, 3].map((i) => hit(5 + i * 4, 6 + i * 4, 'chest', 16, 2, 90, 0, 100, { fkb: 80, group: i })),   // (spinning: the kicks reach all round her)
      hit(22, 26, 'toeF', 12, 5, 60, 55, 80, { group: 4 }),
    ] },

  // Down special: Snack Break. Pulls out an ice cream cone and takes a big
  // bite, healing 4% (only once every ten seconds; otherwise it's just a
  // snack). Slow, so pick your moment.
  snack: { faf: 50, gear: { kind: 'icecream', from: 4, to: 46 }, heal: { frame: 24, amount: 40, every: 600 }, hitboxes: [] },

  // --- Smash attacks (see simeon.js for how they are performed) ---
  // Forward: Power Chord. Swings her guitar into them: 17%.
  fsmash: { faf: 52, charge: { at: 13, max: 60, smash: true }, gear: { kind: 'guitar', from: 0, to: 42 },
    trail: { part: 'weaponF', from: 16, to: 20, width: 12, arc: true }, hitboxes: [
      ...hits(16, 19, [['weaponF', 11], ['weaponMidF', 9], ['fistF', 6]], 17, 361, 32, 98, { chargeScale: [170, 238], lagMult: 150 }),
    ] },
  // Up: Board Flip. Her snowboard swung up and over her head: 15%.
  usmash: { faf: 50, charge: { at: 9, max: 60, smash: true }, gear: { kind: 'snowboard', from: 0, to: 40 },
    trail: { part: 'weaponF', from: 11, to: 19, width: 10, arc: true }, hitboxes: [
      ...hits(11, 19, [['weaponF', 11], ['weaponMidF', 9]], 15, 88, 34, 96, { chargeScale: [150, 210], lagMult: 150 }),
    ] },
  // Down: Muay Thai Sweep. A low chopping kick in front, then behind: 13% each.
  dsmash: { faf: 48, charge: { at: 11, max: 60, smash: true }, hitboxes: [
      ...hits(13, 16, [['toeF', 9], ['shinF', 8]], 13, 30, 32, 92, { group: 0, chargeScale: [130, 182], lagMult: 150 }),
      ...hits(20, 24, [['toeB', 9], ['shinB', 8]], 13, 30, 32, 92, { group: 1, dir: -1, chargeScale: [130, 182], lagMult: 150 }),
    ] },
};

export const GINGER = {
  ...SIMEON,
  id: 'ginger',
  name: 'GINGER',
  lastName: 'CHU',
  heightInches: 66,
  stats,
  parts,
  palettes,
  trailColors: ['#ff8fc6', '#ffe0ef', '#ffffff'],   // strawberry ice cream pink
  animations: { ...SIMEON.animations, ...animations },
  moves: { ...SIMEON.moves, ...moves },
  specials: { neutral: 'truck', side: 'surf', up: 'tornado', down: 'snack' },
  projectiles: {
    // a little ice cream truck: dropped, it lands and rolls along the floor
    truck: {
      draw: 'truck', r: 6, hitPad: 1,
      speed: [px(2.4), 0], chargeSpeed: [0, 0],
      gravity: px(0.3), maxFall: px(4),
      bounce: 0, bounceKeepX: 256, minBounce: px(9), maxBounces: 0,
      rollFriction: px(0.005), minRollSpeed: px(0.3),
      life: 150, fadeFrames: 12, popUp: px(1.4),
      hit: { damage: 80, angle: 55, bkb: 45, kbg: 60 },
      rollHit: { damage: 80, angle: 55, bkb: 45, kbg: 60 },
    },
  },
};
