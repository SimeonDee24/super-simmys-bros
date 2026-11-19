// MATT — volleyball, ultimate frisbee, Roblox and League. He shares every
// normal attack, grab and throw with Simeon (same skeleton, same animations);
// his look, a few stats, his smash attacks and his four specials are his own.
import { px } from '../engine/fixed.js';
import { anim } from '../engine/skeleton.js';
import { SIMEON } from './simeon.js';

const stats = {
  ...SIMEON.stats,
  weight: 96,
  airSpeed: px(1.25),
};

// ---------------------------------------------------------------------------
// Body parts: pixel art at 2 art pixels per world pixel, facing right.
// Drawn from Matt's photos: full medium-brown hair swept up and back with a
// wave at the front, short over the ear with a sideburn; thick dark brows, a
// moustache and a little stubble; a black hoodie with the hood bunched round
// his neck, grey sweatpants.
// ---------------------------------------------------------------------------
const HEAD = [
  '...kkkkkkk....',
  '.kkkkkkkkkkk..',
  'kKkkkkkkkkkkl.',
  'kKkkkkkkkkkkl.',
  'KKkkkkkkbbbbb.',
  'KKkkkkkkkmmek.',
  'KkKqkkkkkmeek.',
  'KkKqkkkkkkkkkl',
  'KKkKKkkkkkkkKl',
  'KKkKkkkkkMMMM.',
  '.KKkkkkkkzkpk.',
  '.KKkkkkzzzzz..',
  '..KKkkzzzzzz..',
  '....KKKKKzK...',
];
const face = (...edits) => {
  const rows = HEAD.map((r) => r.split(''));
  for (const [r, c, str] of edits) for (let i = 0; i < str.length; i++) rows[r][c + i] = str[i];
  return { pivot: [5, 14], px: rows.map((r) => r.join('')) };
};
// (hair column = head column + 1, row = head row + 4)
const HAIR = [
  '.....hhhhhh.......',
  '...hhhhHHhhhhh....',
  '..hhhHhhhhhHHhhhh.',
  '.hhhhhhhHhhhhhHhhh',
  'hhhHhhhhhhhHhhhhhh',
  'hhhhhhHhhhhhhhhHhh',
  'hhhhnhhhhhhhhhh.hh',
  'hhhhhhhh.....hh.h.',
  'hhhhhhh...........',
  'hhhhhh............',
  'hhhh.hh...........',
  'hhh..h............',
  'hhh...............',
  '.hh...............',
];
const parts = {
  ...SIMEON.parts,   // hands, legs and sneakers are shared
  head_neutral: face(),
  head_smile: face([10, 10, 'qp']),
  head_yell: face([4, 8, 'kbbbb'], [10, 10, 'rrk'], [11, 10, 'rr']),
  head_hurt: face([4, 8, 'bbbkk'], [6, 9, 'eeek'], [10, 10, 'rr']),
  hair: { pivot: [6, 18], px: HAIR },
  // a black hoodie: the hood bunched round the back of his neck
  torso: {
    pivot: [6, 26],
    px: [
      '...TTTkkkk....',
      '..TTtTKkkKT...',
      '..TTttTTtttu..',
      '..TTttttttttu.',
      '..TTtttttttuu.',
      '.TTttttttttuu.',
      'TTTttttttttttu',
      'TTtttttttttttu',
      'TTttttttttttuu',
      'TTxtttttttttuu',
      'TTTxttttttttuu',
      'TTtTxtttttttuu',
      '.TTttxttttttu.',
      '.TTtttttttttu.',
      '.TTtxxxxxxxtu.',
      '.TTtxtttttxtu.',
      '.TTtxtttttxtu.',
      '.TTtttttttttu.',
      '.TTttttttttuu.',
      '.TTxxxxxxxxuu.',
      '.TTtttttttttu.',
      '.xTTttttttttx.',
      '.JJjjjjjjjjii.',
      '.JJjjjjjjjjii.',
      '.JJjjjjjjjjji.',
      '.JJjjjjjjjjii.',
      '.JJjjjjjjjjii.',
      '..JJjjjjjjii..',
    ],
  },
  // long hoodie sleeves down to a cuff at the wrist
  upperArm: { pivot: [2, 0], px: ['TTtuu', 'TTttu', 'TTttu', 'TTxtu', 'TTttu', 'TTttu', 'TTttu', 'TTxtu', 'TTttu', 'TTttu', 'TTttu', 'TTttu', '.Ttt.'] },
  lowerArm: { pivot: [2, 0], px: ['TTttu', 'TTttu', 'TTttu', 'TTxtu', 'TTttu', 'TTttu', '.Tttu', '.TTtu', '.TTt.', '.xxx.', '.Kkl.'] },
};

const darker = (hex, k) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('');
const BASE_COLORS = {
  ...SIMEON.palettes[0].colors,
  k: '#f0cdb3', K: '#d9a98d', l: '#f9dfcc', q: '#c18f73', p: '#c9897b',   // fair skin, lips
  z: '#e2bba2',                                                         // light stubble
  h: '#4a3426', H: '#6e523d', n: '#33241b',                              // medium brown hair, lighter where it waves
  b: '#2a1e17', M: '#3a2a20',                                           // thick dark brows, moustache
  e: '#2a1d15', m: '#ffffff',
};
const alt = (name, top, pants, extra = {}) => ({
  name,
  colors: { ...BASE_COLORS, t: top[0], T: top[1], u: top[2], x: darker(top[1], 0.72), j: pants[0], J: pants[1], i: pants[2], y: darker(pants[1], 0.78), ...extra },
});
const palettes = [
  // what he wears in the photos: black hoodie, grey sweats
  alt('Hoodie', ['#26262c', '#17171c', '#3a3a44'], ['#8a8d94', '#6b6e75', '#a8abb2'], { g: '#26262c' }),
  // game day: a royal blue jersey and black track pants
  alt('Game Day', ['#2f5fcf', '#1f448f', '#5b86e6'], ['#2a2a30', '#1a1a1f', '#3a3a42'], { g: '#2f5fcf' }),
];

// ---------------------------------------------------------------------------
// Poses and animations for his smash attacks and specials.
// ---------------------------------------------------------------------------
const FISTS = { handF: 'fist', handB: 'fist' };
const OPEN = { handF: 'open', handB: 'open' };
const STAND = { torso: 2, armF: [4, 10], armB: [-6, 8], legF: [5, -4], legB: [-6, -2] };
const AIR = { torso: 6, armF: [75, 20], armB: [-80, 15], legF: [18, -28], legB: [-14, -18], footF: 25, footB: 35 };

const animations = {
  // Header: tosses the volleyball up over his head, leans back, and snaps
  // forward to head it.
  header: anim(false, [
    [6, { torso: -2, head: -6, armF: [150, 30], armB: [140, 30], legF: [8, -6], legB: [-8, -4], ...OPEN }],
    [6, { hip: [0, 1], torso: -16, head: -16, armF: [-30, 30], armB: [-50, 30], legF: [14, -10], legB: [-10, -6], ...OPEN }],
    [3, { hip: [1, 0], torso: 18, head: 18, armF: [-40, 30], armB: [-70, 30], legF: [20, -14], legB: [-14, -8], ...FISTS, face: 'yell' }],
    [12, { torso: 14, head: 12, armF: [-30, 30], armB: [-60, 30], legF: [18, -12], legB: [-12, -6], ...FISTS, face: 'yell' }],
    [10, { torso: 6, armF: [10, 20], armB: [-20, 20], legF: [10, -8], legB: [-8, -4] }],
    [1, STAND],
  ]),
  // Frisbee: the disc across his chest, then a backhand flick straight out.
  frisbee: anim(false, [
    [6, { torso: -6, armF: [-40, 120], armB: [-20, 30], legF: [12, -8], legB: [-10, -4], handF: 'fist' }],
    [4, { torso: -12, head: 4, armF: [-70, 130], armB: [-20, 30], legF: [16, -10], legB: [-12, -6], handF: 'fist' }],
    [3, { torso: 8, armF: [90, 6], armB: [-40, 30], legF: [20, -14], legB: [-14, -6], handF: 'open', face: 'smile' }],
    [14, { torso: 6, armF: [96, 4], armB: [-40, 30], legF: [18, -12], legB: [-14, -6], handF: 'open', face: 'smile' }],
    [8, STAND],
  ]),
  // Flash: a quick crouch, gone, and back somewhere else with a little pose.
  flash: anim(false, [
    [6, { hip: [0, 5], torso: 14, armF: [-30, 60], armB: [-50, 60], legF: [50, -95], legB: [30, -80], ...FISTS }],
    [8, { torso: 4, armF: [40, 30], armB: [-40, 30], legF: [14, -20], legB: [-10, -30], ...FISTS }],
    [10, { torso: -4, head: -6, armF: [150, 20], armB: [-60, 30], legF: [14, -20], legB: [-10, -30], handF: 'open', face: 'smile' }],
    [12, AIR],
  ]),
  // Oof!: he falls apart into blocks (drawn by the renderer) and snaps back.
  oof: anim(false, [
    [6, { hip: [0, 2], torso: 6, head: 10, armF: [60, 60], armB: [-60, 60], legF: [20, -20], legB: [-20, -20], ...OPEN, face: 'hurt' }],
    [26, { torso: 0, armF: [80, 0], armB: [-80, 0], legF: [24, -6], legB: [-24, -6], ...OPEN, face: 'hurt' }],
    [8, { torso: 2, armF: [40, 30], armB: [-40, 30], legF: [10, -6], legB: [-10, -4], face: 'smile' }],
    [2, STAND],
  ]),
  // --- Smash attacks ---
  // Power Serve: tosses the ball, steps in, and hammers it with the heel of his hand.
  fsmash: anim(false, [
    [6, { torso: -4, armF: [20, 60], armB: [120, 20], legF: [14, -10], legB: [-12, -6], ...OPEN }],
    [7, { hip: [-1, 1], torso: -18, head: 6, armF: [200, 30], armB: [150, 10], legF: [22, -18], legB: [-16, -6], ...OPEN }],
    [3, { hip: [-1, 1], torso: -22, head: 8, armF: [206, 30], armB: [156, 10], legF: [22, -18], legB: [-16, -6], ...OPEN, face: 'yell' }],
    [2, { hip: [1, 1], torso: 8, armF: [120, 4], armB: [40, 30], legF: [30, -24], legB: [-20, -4], ...OPEN, face: 'yell' }],
    [10, { hip: [2, 3], torso: 26, head: -6, armF: [80, 4], armB: [-20, 40], legF: [40, -40], legB: [-26, -4], ...OPEN, face: 'yell' }],
    [14, { hip: [0, 2], torso: 12, armF: [50, 20], armB: [-20, 30], legF: [24, -22], legB: [-16, -4], ...OPEN }],
    [8, STAND],
  ]),
  // Set: crouches under the ball, then pushes up through it with both hands.
  usmash: anim(false, [
    [5, { hip: [0, 4], torso: 10, armF: [120, 80], armB: [110, 80], legF: [30, -50], legB: [10, -40], ...OPEN }],
    [6, { hip: [0, 6], torso: 14, head: -8, armF: [150, 90], armB: [140, 90], legF: [40, -70], legB: [20, -60], ...OPEN }],
    [2, { hip: [0, 6], torso: 14, head: -10, armF: [154, 90], armB: [144, 90], legF: [40, -70], legB: [20, -60], ...OPEN, face: 'yell' }],
    [4, { hip: [0, -2], torso: -6, head: -16, armF: [175, 10], armB: [168, 14], legF: [6, -4], legB: [-6, -4], ...OPEN, face: 'yell' }],
    [10, { hip: [0, -2], torso: -6, head: -14, armF: [178, 6], armB: [172, 8], legF: [6, -4], legB: [-6, -4], ...OPEN }],
    [12, { torso: 2, armF: [60, 30], armB: [40, 30], legF: [8, -6], legB: [-8, -4], ...OPEN }],
    [6, STAND],
  ]),
  // Disc Sweep: drops low and sweeps the frisbee round in front, then behind.
  dsmash: anim(false, [
    [5, { hip: [0, 6], torso: 24, armF: [-40, 30], armB: [40, 20], legF: [40, -60], legB: [-20, -30], handF: 'fist' }],
    [5, { hip: [0, 10], torso: 34, head: -10, armF: [-60, 30], armB: [50, 20], legF: [50, -80], legB: [-30, -40], handF: 'fist' }],
    [2, { hip: [0, 10], torso: 34, head: -10, armF: [-64, 30], armB: [50, 20], legF: [50, -80], legB: [-30, -40], handF: 'fist', face: 'yell' }],
    [4, { hip: [0, 10], torso: 34, head: -10, armF: [80, 0], armB: [30, 20], legF: [50, -80], legB: [-30, -40], handF: 'fist', face: 'yell' }],
    [4, { hip: [0, 10], torso: 34, head: -10, armF: [150, 10], armB: [30, 20], legF: [50, -80], legB: [-30, -40], handF: 'fist' }],
    [5, { hip: [0, 10], torso: 34, head: -10, armF: [250, 0], armB: [30, 20], legF: [50, -80], legB: [-30, -40], handF: 'fist', face: 'yell' }],
    [12, { hip: [0, 6], torso: 24, armF: [40, 30], armB: [30, 20], legF: [40, -60], legB: [-20, -30], handF: 'fist' }],
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
  // Neutral special: Frisbee. A backhand throw: the disc flies out about
  // 140px, curves, and comes back to him, hitting on the way out and back
  // (6%). One frisbee at a time.
  frisbee: { faf: 34, limit: 1, gear: { kind: 'frisbee', from: 0, to: 12 },
    spawn: { frame: 13, from: 'fistF', projectile: 'frisbee' }, hitboxes: [] },

  // Side special: Header (like Wii Fit Trainer's). Tosses a volleyball up,
  // then heads it: it flies forward and down at an angle and bounces along
  // the floor (7%). Headbutting someone point-blank hits too (4%). One ball
  // at a time. Works in the air too.
  header: { faf: 42, limit: 1, gear: { kind: 'header', from: 0, to: 14 },
    spawn: { frame: 15, from: 'neck', projectile: 'vball' },
    hitboxes: [hit(15, 17, 'neck', 7, 4, 45, 40, 60)] },

  // Up special: Flash. Blinks a short way in the held direction (up if none)
  // in a flash of gold light, hitting anyone where he reappears (6%). Falls
  // helpless afterwards.
  flash: { faf: 40, landLag: 14, helpless: true, float: { gravity: 15, fall: 20 },
    teleport: { vanish: 7, appear: 15, speed: px(14) },
    ledgeGrab: { from: 15 },
    hitboxes: [hit(15, 17, 'chest', 13, 6, 80, 50, 70, { radial: true })] },

  // Down special: Oof! Falls apart into a burst of blocks that fly out all
  // round him (10%, launching outward), then snaps back together. Can't be
  // hit while in pieces. Slows his fall in the air.
  oof: { faf: 46, float: { gravity: 40, fall: 50 }, intangible: 20,
    transform: { kind: 'blocks', from: 6, to: 32 },
    hitboxes: [hit(8, 11, 'chest', 22, 10, 361, 50, 70, { radial: true })] },

  // --- Smash attacks (see simeon.js for how they are performed) ---
  // Forward: Power Serve. Hammers a volleyball into them: 17%.
  fsmash: { faf: 52, charge: { at: 13, max: 60, smash: true }, gear: { kind: 'vball', from: 0, to: 20 },
    trail: { part: 'fistF', from: 16, to: 20, width: 10, arc: true }, hitboxes: [
      ...hits(16, 19, [['fistF', 11], ['handF', 7]], 17, 361, 32, 96, { chargeScale: [170, 238], lagMult: 150 }),
    ] },
  // Up: Set. Pushes up through the ball with both hands: 15%.
  usmash: { faf: 50, charge: { at: 11, max: 60, smash: true }, gear: { kind: 'vball', from: 0, to: 26 },
    hitboxes: [
      ...hits(13, 19, [['fistF', 11], ['fistB', 10]], 15, 88, 34, 96, { chargeScale: [150, 210], lagMult: 150 }),
    ] },
  // Down: Disc Sweep. A low sweep of the frisbee in front, then behind: 13% each.
  dsmash: { faf: 48, charge: { at: 11, max: 60, smash: true }, gear: { kind: 'frisbee', from: 0, to: 36 },
    hitboxes: [
      ...hits(13, 16, [['fistF', 10], ['handF', 7]], 13, 30, 32, 92, { group: 0, chargeScale: [130, 182], lagMult: 150 }),
      ...hits(20, 25, [['fistF', 10], ['handF', 7]], 13, 30, 32, 92, { group: 1, dir: -1, chargeScale: [130, 182], lagMult: 150 }),
    ] },
};

export const MATT = {
  ...SIMEON,
  id: 'matt',
  name: 'MATT',
  lastName: 'SANTHA',
  heightInches: 71,
  stats,
  parts,
  palettes,
  trailColors: ['#f2b51a', '#ffe680', '#ffffff'],   // gold, for Flash
  animations: { ...SIMEON.animations, ...animations },
  moves: { ...SIMEON.moves, ...moves },
  specials: { neutral: 'frisbee', side: 'header', up: 'flash', down: 'oof' },
  projectiles: {
    // a volleyball headed forward and down at an angle: bounces, then rolls
    vball: {
      draw: 'vball', r: 4, hitPad: 1,
      speed: [px(4.6), -px(1.8)], chargeSpeed: [0, 0],
      gravity: px(0.16), maxFall: px(4.5),
      bounce: 150, bounceKeepX: 190, minBounce: px(0.7), maxBounces: 3,
      rollFriction: px(0.06), minRollSpeed: px(0.4),
      life: 150, fadeFrames: 20, popUp: px(1.8),
      hit: { damage: 70, angle: 40, bkb: 40, kbg: 60 },
      rollHit: { damage: 50, angle: 361, bkb: 20, kbg: 50 },
    },
    // the frisbee: out about 130px, then back to him
    frisbee: {
      type: 'boomerang', draw: 'frisbee', r: 4, hitPad: 2,
      speed: [px(4.8), 0], chargeSpeed: [0, 0],
      accel: px(0.09), homing: px(1.0), catchX: 10, catchY: 26, spinRate: 60, rehit: 24,
      life: 170, fadeFrames: 10,
      hit: { damage: 60, angle: 361, bkb: 30, kbg: 55 },
    },
  },
};
