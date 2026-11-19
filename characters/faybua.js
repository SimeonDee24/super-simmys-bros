// FAYBUA — skateboarding, tactical shooters, fashion, dancing, horse riding,
// and cookies. She shares every normal attack, grab and throw with Simeon
// (same skeleton, same animations); her look, a few stats, her smash attacks
// and her four specials are her own.
import { px } from '../engine/fixed.js';
import { anim } from '../engine/skeleton.js';
import { SIMEON } from './simeon.js';
import { KAELYN } from './kaelyn.js';

const stats = {
  ...SIMEON.stats,
  weight: 88,
  runSpeed: px(3.05),
  dashSpeed: px(3.3),
};

// ---------------------------------------------------------------------------
// Body parts: pixel art at 2 art pixels per world pixel, facing right.
// Drawn from Faybua's photos: long straight dark brown hair, parted in the
// middle, lighter brown at the ends; winged eyeliner and a little nose ring;
// an oversized grey quarter-zip sweatshirt with a small scenic print.
// ---------------------------------------------------------------------------
const HEAD = [
  '...kkkkkkk....',
  '.kkkkkkkkkkk..',
  'kkkkkkkkkkkkl.',
  'kkkkkkkkkkkkl.',
  'Kkkkkkkkkkbbk.',
  'Kkkkkkkkkeeee.',
  'Kkkkkkkkkmek..',
  'Kkkkkkkkkkkkl.',
  'Kkkkkkkkkkkkv.',
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
// Long straight hair (hair column = head column + 3, row = head row + 4):
// dark brown (h, H shine) down to lighter brown ends (a, A).
const HAIR = [
  '......hhhhhhh.....',
  '....hhhhhhhhhhh...',
  '...hhhhhhhhhhhhh..',
  '..hhhhhhhhhhhhhhh.',
  '..hhhhhhhhhhhhhhh.',
  '.hhHhhhhhhhhhhhh..',
  '.hhHhhhhhhhhhh....',
  '.hhHhhhhhhhh......',
  '.hhHhhhhhhh.......',
  '.hhHhhhhhh........',
  '.hhHhhhhhh........',
  'hhhHHhhhhh........',
  'hhhHHhhhh.........',
  'hhhHHhhhh.........',
  'hhhHHhhhh.........',
  'hhhHHhhhh.........',
  'hhhHHhhhh.........',
  'hhhHHhhhh.........',
  'nnnnnnnnn.........',
  'nnnnnnnnn.........',
  'nnnnnnnnn.........',
  'nnnnnnnnn.........',
  'aaaAAaaaa.........',
  'aaaAAaaaa.........',
  'aaaAAaaaa.........',
  'aaaAAaaaa.........',
  'aaaAAaaaa.........',
  'aaaAAaaaa.........',
  'aaaAAaa...........',
  'aaaAAaa...........',
  'aaaAA.............',
];
const parts = {
  ...SIMEON.parts,
  head_neutral: face(),
  head_smile: face([10, 9, 'ppp']),
  head_yell: face([4, 9, 'kbb'], [10, 9, 'krr'], [11, 9, 'rr']),
  head_hurt: face([5, 9, 'kkkk'], [6, 9, 'eee'], [10, 10, 'rr']),
  hair: { pivot: [8, 18], px: HAIR },
  // an oversized grey quarter-zip: a zip at the collar (z), a small print on the chest (G sky, O sun)
  torso: {
    pivot: [6, 26],
    px: [
      '.....kkkk.....',
      '....TKkkkzT...',
      '...TTttttzttu.',
      '..TTtttttztttu',
      '.TTttttttztttu',
      'TTTtttttttttuu',
      'TTttttttttttuu',
      'TTtttttttGOGtu',
      'TTtttttttGGGtu',
      'TTxttttttGGGuu',
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
      '.xTxTxtxtxtxx.',
      '.JJjjjjjjjjii.',
      '.JJjjjjjjjjii.',
      '.JJjjjjjjjjii.',
      '.JJjjjjjjjjii.',
      '..JJjjjjjjii..',
    ],
  },
  // long sleeves with a cuff, as Kaelyn's sweater
  upperArm: KAELYN.parts.upperArm,
  lowerArm: KAELYN.parts.lowerArm,
};

const darker = (hex, k) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('');
const BASE_COLORS = {
  ...SIMEON.palettes[0].colors,
  k: '#f0cdb2', K: '#d8a98d', l: '#fbe2cf', q: '#c4917a',                  // skin
  h: '#2a1a14', H: '#3f281d', n: '#5a3522', a: '#7a4a2c', A: '#9a6440', b: '#2a1a14',   // dark brown hair, lighter at the ends
  e: '#100d16', m: '#ffffff', r: '#8c3a36', p: '#d98a8c', v: '#dfe3ea',     // winged liner, lips, silver nose ring
  z: '#c9ced8', G: '#6fa8dc', O: '#f2994a',                                // zip, the print's sky and sun
  w: '#f6f6f2', W: '#bfc5d0', g: '#f6f6f2',
};
const alt = (name, top, pants, extra = {}) => ({
  name,
  colors: { ...BASE_COLORS, t: top[0], T: top[1], u: top[2], x: darker(top[1], 0.72), j: pants[0], J: pants[1], i: pants[2], y: darker(pants[1], 0.78), ...extra },
});
const palettes = [
  // what she wears in the photos: the grey quarter-zip (black leggings)
  alt('Quarter-Zip', ['#55575f', '#3e4047', '#6c6f78'], ['#26262c', '#17171c', '#3a3a44']),
  // a purple and black night-out fit
  alt('Night Out', ['#6b4fa8', '#4c3780', '#8a6fcc'], ['#1d1b22', '#121116', '#2e2b36'], { G: '#ff8fc6', O: '#ffffff', g: '#6b4fa8' }),
];

// ---------------------------------------------------------------------------
// Poses and animations for her smash attacks and specials.
// ---------------------------------------------------------------------------
const FISTS = { handF: 'fist', handB: 'fist' };
const OPEN = { handF: 'open', handB: 'open' };
const STAND = { torso: 2, armF: [4, 10], armB: [-6, 8], legF: [5, -4], legB: [-6, -2] };
const AIR = { torso: 6, armF: [75, 20], armB: [-80, 15], legF: [18, -28], legB: [-14, -18], footF: 25, footB: 35 };
const POSE = { hip: [1, 0], torso: -4, head: -8, armF: [150, 120], armB: [-30, 110], legF: [14, -4], legB: [-14, -2], handF: 'open', handB: 'fist', face: 'smile' };
// riding: knees up and forward round the horse's sides, reins in both hands
const RIDE_H = { hip: [0, 0], torso: 12, head: -6, armF: [70, 60], armB: [55, 70], legF: [75, -95], legB: [65, -90], footF: 20, footB: 20, ...FISTS, face: 'smile' };
const OLLIE = { hip: [0, 2], torso: 8, armF: [60, 30], armB: [-70, 30], legF: [50, -90], legB: [10, -70], footF: 20, footB: 10, ...OPEN, face: 'smile' };

const animations = {
  // Cookie Toss: a quick sidearm flick of a sandwich cookie.
  cookie: anim(false, [
    [5, { torso: -8, armF: [-60, 110], armB: [-20, 30], legF: [12, -8], legB: [-10, -4], handF: 'fist' }],
    [3, { torso: 8, armF: [90, 6], armB: [-40, 30], legF: [18, -12], legB: [-14, -6], handF: 'open', face: 'smile' }],
    [12, { torso: 6, armF: [96, 4], armB: [-40, 30], legF: [16, -10], legB: [-12, -6], handF: 'open', face: 'smile' }],
    [8, STAND],
  ]),
  // Giddy Up: swings up onto her horse (drawn by the renderer) and gallops
  // forward holding the reins, then hops off.
  horse: anim(false, [
    [5, { hip: [0, 4], torso: 14, armF: [60, 40], armB: [40, 40], legF: [40, -60], legB: [10, -40], ...FISTS }],
    [5, { ...RIDE_H, torso: 6 }],
    [28, RIDE_H],
    [8, { hip: [0, 3], torso: 6, armF: [80, 30], armB: [-40, 30], legF: [40, -60], legB: [-10, -40], ...OPEN }],
    [10, { torso: 4, armF: [40, 30], armB: [-30, 30], legF: [14, -12], legB: [-12, -6] }],
    [2, STAND],
  ]),
  // Ollie: pops her skateboard and rides it up into the air.
  ollie: anim(false, [
    [4, { hip: [0, 6], torso: 14, armF: [-30, 60], armB: [-50, 60], legF: [50, -95], legB: [30, -80], ...FISTS }],
    [20, OLLIE],
    [8, { ...OLLIE, torso: 2, armF: [100, 20], armB: [-100, 20] }],
    [10, AIR],
  ]),
  // Serve!: strikes a pose (a counter); if hit, a camera flash goes off.
  pose: anim(false, [
    [4, { torso: 2, armF: [60, 60], armB: [-20, 40], legF: [10, -6], legB: [-10, -4], ...OPEN }],
    [26, POSE],
    [8, POSE],
    [8, { torso: 2, armF: [40, 40], armB: [-10, 30], legF: [8, -6], legB: [-8, -4] }],
    [4, STAND],
  ]),
  poseFlash: anim(false, [
    [3, { ...POSE, armF: [100, 10], face: 'yell' }],
    [12, { ...POSE, armF: [90, 4], face: 'smile' }],
    [10, { torso: 2, armF: [40, 40], armB: [-10, 30], legF: [8, -6], legB: [-8, -4] }],
    [4, STAND],
  ]),
  // --- Smash attacks ---
  // Scythe: winds back and swings a scythe round in a big arc.
  fsmash: anim(false, [
    [6, { torso: -4, armF: [120, 30], armB: [80, 60], legF: [16, -12], legB: [-12, -6], ...FISTS }],
    [7, { hip: [-1, 1], torso: -18, head: 6, armF: [200, 30], armB: [150, 60], legF: [24, -20], legB: [-16, -6], ...FISTS }],
    [3, { hip: [-1, 1], torso: -22, head: 8, armF: [208, 30], armB: [156, 60], legF: [24, -20], legB: [-16, -6], ...FISTS, face: 'yell' }],
    [2, { hip: [1, 1], torso: 6, armF: [130, 0], armB: [100, 40], legF: [30, -24], legB: [-20, -4], ...FISTS, face: 'yell' }],
    [10, { hip: [2, 3], torso: 30, head: -8, armF: [70, 0], armB: [40, 40], legF: [40, -40], legB: [-26, -4], ...FISTS, face: 'yell' }],
    [14, { hip: [0, 2], torso: 14, armF: [60, 20], armB: [20, 40], legF: [24, -22], legB: [-16, -4], ...FISTS }],
    [8, STAND],
  ]),
  // Spin Move: a dance spin up onto her toes, arms sweeping over her head.
  usmash: anim(false, [
    [5, { hip: [0, 3], torso: 6, armF: [40, 60], armB: [-40, 60], legF: [16, -24], legB: [-12, -14], ...OPEN }],
    [3, { hip: [0, 4], torso: 10, armF: [20, 80], armB: [-20, 80], legF: [20, -30], legB: [-14, -18], ...OPEN, face: 'smile' }],
    [4, { hip: [0, -3], torso: -4, head: -10, armF: [160, 10], armB: [-160, 10], legF: [4, -2], legB: [-4, -2], footF: -20, footB: -20, ...OPEN, face: 'yell' }],
    [10, { hip: [0, -3], torso: -6, head: -12, armF: [175, 6], armB: [-175, 6], legF: [4, -2], legB: [-4, -2], footF: -20, footB: -20, ...OPEN, face: 'yell' }],
    [12, { torso: 2, armF: [60, 30], armB: [-60, 30], legF: [8, -6], legB: [-8, -4], ...OPEN }],
    [6, STAND],
  ]),
  // Buck Kick: drops onto her hands like a horse and kicks out behind, then in front.
  dsmash: anim(false, [
    [5, { hip: [0, 6], torso: 50, armF: [60, 20], armB: [40, 20], legF: [30, -50], legB: [-10, -30], ...OPEN }],
    [5, { hip: [0, 8], torso: 70, head: -20, armF: [80, 10], armB: [70, 10], legF: [40, -70], legB: [-10, -60], ...OPEN }],
    [2, { hip: [0, 8], torso: 70, head: -20, armF: [80, 10], armB: [70, 10], legF: [44, -74], legB: [-10, -64], ...OPEN, face: 'yell' }],
    [4, { hip: [0, 8], torso: 70, head: -20, armF: [80, 10], armB: [70, 10], legF: [10, -40], legB: [-100, -4], ...OPEN, face: 'yell' }],
    [4, { hip: [0, 8], torso: 70, head: -20, armF: [80, 10], armB: [70, 10], legF: [10, -40], legB: [-30, -60], ...OPEN }],
    [5, { hip: [0, 8], torso: 60, head: -20, armF: [80, 10], armB: [70, 10], legF: [100, -4], legB: [-30, -60], ...OPEN, face: 'yell' }],
    [12, { hip: [0, 6], torso: 30, armF: [60, 20], armB: [40, 20], legF: [30, -50], legB: [-10, -30], ...OPEN }],
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
  // Neutral special: Cookie Toss. Flicks a sandwich cookie that flies flat and
  // fast, spinning: 5%. Two out at a time.
  cookie: { faf: 28, limit: 2, spawn: { frame: 8, from: 'fistF', projectile: 'cookie' }, hitboxes: [] },

  // Side special: Giddy Up. Rides her horse at a gallop, trampling anyone in
  // front of it (11%, launching up and forward). Stays on the floor when used
  // there; in the air the horse leaps forward. Once per jump in the air.
  horse: { faf: 58, landLag: 14, once: true, noDrift: true, float: { gravity: 20, fall: 25 },
    gear: { kind: 'horse', from: 5, to: 45 },
    rocket: { frame: 10, frames: 28, speed: [px(4.6), px(4.6)], lift: 0, gravity: 30, drag: 8, bounce: [px(1.0), px(1.8)], ground: true },
    ledgeGrab: { from: 30 },
    hitboxes: [
      hit(10, 38, 'hip', 11, 11, 50, 55, 75, { off: [22, 6] }),   // the horse's chest and head
      hit(10, 38, 'hip', 9, 11, 50, 55, 75, { off: [12, 14] }),   // its front legs
    ] },

  // Up special: Ollie. Pops her skateboard and rides it straight up; the
  // board hits on the way (8%). Falls helpless afterwards.
  ollie: { faf: 42, landLag: 16, helpless: true, gear: { kind: 'skateboard', from: 2, to: 30 },
    fly: { frame: 4, frames: 18, rise: px(4.6), accel: px(1.9), drift: px(1.2), steer: px(0.1) },
    ledgeGrab: { from: 4, rising: true },
    hitboxes: [hit(4, 9, 'footF', 10, 8, 80, 50, 70, { off: [0, 2] })] },

  // Down special: Serve! Strikes a pose. If she is hit while posing she takes
  // no damage and a camera flash goes off all round her, hitting back for
  // 1.2x the damage (at least 8%).
  pose: { faf: 46, float: { gravity: 25, fall: 30 }, counter: { window: [5, 26], mult: 120, min: 80, then: 'poseFlash', freeze: 10, attackerExtra: 8, intangible: 12 },
    hitboxes: [] },
  poseFlash: { faf: 28, float: { gravity: 25, fall: 30 }, gear: { kind: 'camflash', from: 0, to: 14, active: [2, 12] }, hitboxes: [
    hit(3, 6, 'chest', 20, 0, 361, 60, 70, { counterDamage: true, radial: true }),
  ] },

  // --- Smash attacks (see simeon.js for how they are performed) ---
  // Forward: Scythe. A big sweeping swing of a scythe: 17%, the blade at the
  // end reaching further than most smashes.
  fsmash: { faf: 54, charge: { at: 13, max: 60, smash: true }, gear: { kind: 'scythe', from: 0, to: 44 },
    trail: { part: 'weaponF', from: 16, to: 20, width: 14, arc: true }, hitboxes: [
      ...hits(16, 19, [['weaponF', 13], ['weaponMidF', 9], ['fistF', 6]], 17, 361, 32, 98, { chargeScale: [170, 238], lagMult: 150 }),
    ] },
  // Up: Spin Move. A dance spin with her arms swept over her head: 15%.
  usmash: { faf: 46, charge: { at: 8, max: 60, smash: true }, twirl: [[10, 22]], hitboxes: [
      ...hits(10, 18, [['fistF', 9], ['fistB', 9], ['neck', 8]], 15, 88, 34, 96, { chargeScale: [150, 210], lagMult: 150 }),
    ] },
  // Down: Buck Kick. Kicks out behind like a horse, then in front: 13% each.
  dsmash: { faf: 48, charge: { at: 11, max: 60, smash: true }, hitboxes: [
      ...hits(13, 16, [['toeB', 10], ['shinB', 8]], 13, 30, 32, 92, { group: 0, dir: -1, chargeScale: [130, 182], lagMult: 150 }),
      ...hits(20, 24, [['toeF', 10], ['shinF', 8]], 13, 30, 32, 92, { group: 1, chargeScale: [130, 182], lagMult: 150 }),
    ] },
};

export const FAYBUA = {
  ...SIMEON,
  id: 'faybua',
  name: 'FAYBUA',
  lastName: '',
  heightInches: 64,
  stats,
  parts,
  palettes,
  trailColors: ['#8a6fcc', '#d9ccff', '#ffffff'],   // lilac
  animations: { ...SIMEON.animations, ...animations },
  moves: { ...SIMEON.moves, ...moves },
  specials: { neutral: 'cookie', side: 'horse', up: 'ollie', down: 'pose' },
  projectiles: {
    // a sandwich cookie, flicked flat: flies straight and spins
    cookie: { type: 'dart', draw: 'cookie', r: 3, hitPad: 2, speed: [px(5.2), 0], chargeSpeed: [0, 0], gravity: 0, maxFall: 0,
      life: 42, fadeFrames: 4, hit: { damage: 50, angle: 361, bkb: 25, kbg: 50 } },
  },
};
