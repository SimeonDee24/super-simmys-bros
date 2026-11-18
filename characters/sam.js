// SAM — raver, DJ and pre-law. Melee only, apart from a stream of white
// powder: a DJ controller, a gavel, kicks. He shares every normal attack,
// grab and throw with Simeon (same skeleton, same animations); his look, a
// few stats, his smash attacks and his four specials are his own.
import { px } from '../engine/fixed.js';
import { anim } from '../engine/skeleton.js';
import { SIMEON } from './simeon.js';

const stats = {
  ...SIMEON.stats,
  weight: 99,
  runSpeed: px(2.95),
};

// ---------------------------------------------------------------------------
// Body parts: pixel art at 2 art pixels per world pixel, facing right.
// Thick wavy black hair with a fringe swept down to his brows (one curl
// hanging past his eye), a beaded
// necklace with a pendant, a black sleeveless tank. Second skin: wraparound
// shades (G) and a teal scarf (S).
// ---------------------------------------------------------------------------
const HEAD = [
  '...kkkkkkk....',
  '.kkkkkkkkkkk..',
  'kKkkkkkkkkkkl.',
  'kKkkkkkkkkkkl.',
  'KKkkkkkkkbbbk.',
  'KKkkkkkkGYUUG.',
  'KkKqkkkkGYUUG.',
  'KkKqkkkkkkkkkl',
  'KKkKKkkkkkkkkl',
  'KKkKkkkkkkkkK.',
  '.KKkkkkkkkqpp.',
  '.KKkkkkkkkkk..',
  '..KKkkkkkkkk..',
  '....KKKKKkK...',
];
const face = (...edits) => {
  const rows = HEAD.map((r) => r.split(''));
  for (const [r, c, str] of edits) for (let i = 0; i < str.length; i++) rows[r][c + i] = str[i];
  return { pivot: [5, 14], px: rows.map((r) => r.join('')) };
};
// (hair column = head column + 1, row = head row + 4)
const HAIR = [
  '...hhhhhhhh.......',
  '.hhhhhhhhhhhhh....',
  'hhhhnhhhhhhnhhhh..',
  'hhhhhhhhHhhhhhhhh.',
  'hhhHhhhhhhhhHhhhhh',
  'hhhhhhhhhhhhhhhhhh',
  '.hhhhhhhhhhhhhhhhh',
  '..hhhhhhhhhHhhhhhh',
  '..hh..hhhhhHhhhhh.',
  '..h...........hh..',
  '...............h..',
];
const parts = {
  ...SIMEON.parts,   // hands, legs and sneakers are shared
  head_neutral: face(),
  head_smile: face([10, 9, 'kmmp']),
  head_yell: face([9, 10, 'rrk'], [10, 10, 'rrr'], [11, 10, 'rr']),
  head_hurt: face([10, 10, 'rr']),
  hair: { pivot: [6, 18], px: HAIR },
  // sleeveless tank with a beaded necklace (c / C beads, v pendant); S is the scarf
  torso: {
    pivot: [6, 26],
    px: [
      '.....kkkk.....',
      '.....KcCcK....',
      '....kSSttCv...',
      '...TSSStttcvc.',
      '..TTSSSttttCv.',
      '.TTttSSttttuvc',
      'TTTtttSSttttvu',
      'TTttttSSttttuu',
      'TTtttttSSttttu',
      'TTxttttSSSttuu',
      'TTTxttttSSSuuu',
      'TTtTxtttttSStu',
      '.TTttxtttttSu.',
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
  // bare, muscular arms
  upperArm: { pivot: [2, 0], px: ['KKkkl', 'KKkkl', 'Kkkkl', 'Kkkkl', 'Kkkkl', 'Kkkkl', 'Kkkkl', 'Kkkkl', 'KKkkl', 'Kkkkl', 'Kkkkl', 'Kkkkl', '.Kkk.'] },
};

const darker = (hex, k) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('');
const SKIN = { k: '#9a6142', K: '#7c4a31', l: '#b57a57', q: '#6a3d27', p: '#8e4f45' };
const BASE_COLORS = {
  ...SIMEON.palettes[0].colors,
  ...SKIN,
  h: '#0e0b0b', H: '#211b1a', n: '#3a3332', b: '#0e0b0b',   // thick black hair
  c: '#5a1f22', C: '#c9a46a', v: '#c9ced8',                 // dark beads, a tan bead, a silver pendant
  m: '#ffffff', e: '#1b1310',
};
const alt = (name, top, pants, extra = {}) => ({
  name,
  colors: { ...BASE_COLORS, t: top[0], T: top[1], u: top[2], x: darker(top[1], 0.75), S: top[0], j: pants[0], J: pants[1], i: pants[2], y: darker(pants[1], 0.78), G: SKIN.k, Y: '#ffffff', U: '#1b1310', ...extra },
});
const palettes = [
  // the rave fit: black sleeveless tank, beaded necklace, black cargos
  alt('Rave', ['#2a2b2a', '#1b1c1b', '#3b3c3a'], ['#2a2a30', '#1a1a1f', '#3a3a42'], { B: '#1b1c1b', w: '#e9e9e4', W: '#8a8f99', g: '#2a2b2a' }),
  // festival: a teal paisley scarf, wraparound shades, jeans
  alt('Festival', ['#2a2b2a', '#1b1c1b', '#3b3c3a'], ['#4f6f9e', '#3a5580', '#6a8cbd'], { S: '#3fb8c4', G: '#c9e3e0', Y: '#9fd8d2', U: '#c9e3e0', B: '#1b1c1b' }),
];

// ---------------------------------------------------------------------------
// Poses and animations for his smash attacks and specials.
// ---------------------------------------------------------------------------
const FISTS = { handF: 'fist', handB: 'fist' };
const STAND = { torso: 2, armF: [4, 10], armB: [-6, 8], legF: [5, -4], legB: [-6, -2] };
const AIR = { torso: 6, armF: [75, 20], armB: [-80, 15], legF: [18, -28], legB: [-14, -18], footF: 25, footB: 35 };
const BLOW = { torso: 10, head: 6, armF: [60, 40], armB: [-20, 30], legF: [16, -12], legB: [-12, -6], handF: 'open', face: 'yell' };
// Falcon-style kick: leaning back, front leg driven straight out
const KICK = { hip: [0, 2], torso: -24, head: 8, armF: [-60, 40], armB: [-120, 30], legF: [96, -2], legB: [-30, -40], footF: -10, ...FISTS, face: 'yell' };
const DIVE_KICK = { rot: 30, torso: -20, head: 10, armF: [-70, 40], armB: [-130, 30], legF: [96, -2], legB: [-20, -60], footF: -10, ...FISTS, face: 'yell' };

const animations = {
  // Powder Blast: blows a stream of white powder (held here while the button is).
  powderBlast: anim(false, [
    [5, { torso: -4, head: -10, armF: [40, 60], armB: [-20, 30], legF: [10, -8], legB: [-8, -4], handF: 'open' }],
    [4, BLOW],
    [12, { ...BLOW, head: 2 }],
    [8, STAND],
  ]),
  // Objection!: raises the gavel and lunges in, bringing it down hard.
  objection: anim(false, [
    [6, { torso: -8, armF: [150, 40], armB: [-30, 40], legF: [16, -12], legB: [-12, -6], ...FISTS }],
    [6, { hip: [0, 1], torso: -14, head: 6, armF: [190, 30], armB: [-40, 40], legF: [20, -18], legB: [-14, -8], ...FISTS, face: 'yell' }],
    [4, { hip: [1, 2], torso: 20, armF: [110, 10], armB: [-40, 40], legF: [40, -30], legB: [-24, -6], ...FISTS, face: 'yell' }],
    [10, { hip: [2, 4], torso: 34, head: -8, armF: [64, 4], armB: [-40, 40], legF: [44, -40], legB: [-28, -4], ...FISTS, face: 'yell' }],
    [12, { hip: [0, 2], torso: 14, armF: [60, 20], armB: [-20, 30], legF: [24, -22], legB: [-16, -4], ...FISTS }],
    [4, STAND],
  ]),
  // Appeal: spins upward with the gavel held out.
  appeal: anim(false, [
    [4, { hip: [0, 6], torso: 14, armF: [40, 60], armB: [-20, 50], legF: [50, -95], legB: [30, -80], ...FISTS }],
    [18, { torso: -4, head: -10, armF: [100, 6], armB: [-100, 10], legF: [14, -20], legB: [-10, -30], ...FISTS, face: 'yell' }],
    [6, { torso: -8, head: -14, armF: [170, 10], armB: [-120, 20], legF: [14, -20], legB: [-10, -30], ...FISTS, face: 'yell' }],
    [8, { torso: 4, armF: [120, 30], armB: [-90, 20], legF: [20, -30], legB: [-14, -20], ...FISTS }],
    [10, AIR],
  ]),
  // Falcon Kick: crouches, then drives a kick forward (on the ground) or down at an angle (in the air).
  falconKick: anim(false, [
    [6, { hip: [0, 5], torso: 16, armF: [-30, 60], armB: [-60, 50], legF: [50, -90], legB: [10, -50], ...FISTS }],
    [6, { ...KICK, legF: [80, -40] }],
    [24, KICK],
    [10, { hip: [0, 2], torso: -4, armF: [30, 40], armB: [-40, 30], legF: [40, -50], legB: [-20, -20], ...FISTS }],
    [4, STAND],
  ]),
  falconKickAir: anim(false, [
    [6, { torso: 10, armF: [-30, 60], armB: [-60, 50], legF: [50, -110], legB: [30, -90], ...FISTS }],
    [6, { ...DIVE_KICK, legF: [80, -40] }],
    [30, DIVE_KICK],
  ]),
  // --- Smash attacks ---
  // Drop the Beat: pulls out his DJ controller and swings it into them.
  fsmash: anim(false, [
    [6, { torso: -4, armF: [120, 30], armB: [80, 60], legF: [16, -12], legB: [-12, -6], ...FISTS }],
    [7, { hip: [-1, 1], torso: -18, head: 6, armF: [200, 30], armB: [150, 60], legF: [24, -20], legB: [-16, -6], ...FISTS }],
    [3, { hip: [-1, 1], torso: -22, head: 8, armF: [208, 30], armB: [156, 60], legF: [24, -20], legB: [-16, -6], ...FISTS, face: 'yell' }],
    [2, { hip: [1, 1], torso: 6, armF: [130, 0], armB: [100, 40], legF: [30, -24], legB: [-20, -4], ...FISTS, face: 'yell' }],
    [10, { hip: [2, 3], torso: 30, head: -8, armF: [70, 0], armB: [40, 40], legF: [40, -40], legB: [-26, -4], ...FISTS, face: 'yell' }],
    [14, { hip: [0, 2], torso: 14, armF: [60, 20], armB: [20, 40], legF: [24, -22], legB: [-16, -4], ...FISTS }],
    [8, STAND],
  ]),
  // Order in the Court: swings the gavel in a big arc over his head.
  usmash: anim(false, [
    [4, { torso: 8, armF: [40, 50], armB: [-20, 40], legF: [12, -10], legB: [-10, -6], handF: 'fist' }],
    [4, { hip: [0, 3], torso: 16, head: 6, armF: [20, 30], armB: [-30, 40], legF: [20, -24], legB: [-12, -14], handF: 'fist' }],
    [2, { hip: [0, 3], torso: 16, head: 6, armF: [16, 30], armB: [-30, 40], legF: [20, -24], legB: [-12, -14], handF: 'fist', face: 'yell' }],
    [3, { hip: [0, -1], torso: -4, head: -16, armF: [110, 10], armB: [-40, 30], legF: [8, -4], legB: [-8, -4], handF: 'fist', face: 'yell' }],
    [3, { hip: [0, -1], torso: -10, head: -20, armF: [180, 4], armB: [-50, 30], legF: [8, -4], legB: [-8, -4], handF: 'fist', face: 'yell' }],
    [3, { hip: [0, -1], torso: -16, head: -14, armF: [240, 10], armB: [-50, 30], legF: [8, -4], legB: [-8, -4], handF: 'fist', face: 'yell' }],
    [12, { hip: [0, 1], torso: -10, armF: [268, 20], armB: [-40, 30], legF: [8, -6], legB: [-8, -4], handF: 'fist' }],
    [10, { torso: 2, armF: [60, 30], armB: [-20, 30], legF: [8, -6], legB: [-8, -4], handF: 'fist' }],
    [6, STAND],
  ]),
  // Spin Kick: drops low and sweeps a spinning kick through in front, then behind.
  dsmash: anim(false, [
    [5, { hip: [0, 6], torso: 24, armF: [60, 20], armB: [40, 20], legF: [30, -50], legB: [-10, -30], handF: 'open', handB: 'open' }],
    [5, { hip: [0, 10], torso: 40, head: -16, armF: [70, 20], armB: [50, 20], legF: [40, -60], legB: [-10, -40], handF: 'open', handB: 'open' }],
    [2, { hip: [0, 10], torso: 40, head: -16, armF: [70, 20], armB: [50, 20], legF: [44, -64], legB: [-10, -40], handF: 'open', handB: 'open', face: 'yell' }],
    [4, { hip: [0, 10], torso: 40, head: -16, armF: [70, 20], armB: [50, 20], legF: [92, -4], legB: [-30, -80], handF: 'open', handB: 'open', face: 'yell' }],
    [4, { hip: [0, 10], torso: 40, head: -16, armF: [70, 20], armB: [50, 20], legF: [10, -40], legB: [-30, -80], handF: 'open', handB: 'open' }],
    [5, { hip: [0, 10], torso: 40, head: -16, armF: [70, 20], armB: [50, 20], legF: [30, -80], legB: [-92, -4], handF: 'open', handB: 'open', face: 'yell' }],
    [12, { hip: [0, 6], torso: 24, armF: [60, 20], armB: [40, 20], legF: [30, -50], legB: [-10, -30], handF: 'open', handB: 'open' }],
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
  // Neutral special: Powder Blast. Like a flamethrower: hold the button to
  // blow a stream of white powder in front of him (about 1% a puff) for up to
  // two and a half seconds. The stream gets shorter the longer it is used,
  // and grows back while he does other things.
  powderBlast: { faf: 26, float: { gravity: 40, fall: 50 }, charge: { at: 9, max: 150 },
    stream: { every: 3, from: 'neck', use: 6, minLife: 6, projectiles: ['puffHigh', 'puff', 'puffLow'] }, hitboxes: [] },

  // Side special: Objection! Lunges forward bringing a gavel down hard: 11%,
  // spikes fighters in the air. Stays on the floor when used there.
  objection: { faf: 48, landLag: 12, once: true, noDrift: true, gear: { kind: 'gavel', from: 0, to: 40 },
    rocket: { frame: 12, frames: 12, speed: [px(3.2), px(3.2)], lift: 0, gravity: 30, drag: 20, bounce: [px(0.6), px(1.2)], ground: true },
    trail: { part: 'weaponF', from: 15, to: 20, width: 9, arc: true },
    hitboxes: [
      hit(15, 19, 'weaponF', 9, 11, 270, 40, 70, { onlyAir: true, group: 0 }),
      hit(15, 19, 'weaponF', 9, 11, 75, 50, 72, { onlyGround: true, group: 0 }),
      hit(15, 19, 'weaponMidF', 7, 9, 60, 40, 70, { group: 0 }),
    ] },

  // Up special: Appeal. Spins straight up with the gavel held out, hitting
  // several times (2% each), then a last whack at the top (5%). Falls
  // helpless afterwards.
  appeal: { faf: 46, landLag: 16, helpless: true, twirl: [[4, 21]], gear: { kind: 'gavel', from: 0, to: 34 },
    fly: { frame: 4, frames: 17, rise: px(4.7), accel: px(1.8), drift: px(1.1), steer: px(0.1) },
    ledgeGrab: { from: 4, rising: true },
    hitboxes: [
      ...[0, 1, 2, 3].map((i) => hit(5 + i * 4, 6 + i * 4, 'chest', 13, 2, 90, 0, 100, { fkb: 45, group: i, radial: false })),
      hit(22, 25, 'weaponF', 10, 5, 70, 50, 80, { group: 4 }),
    ] },

  // Down special: Falcon Kick. On the ground: a fast sliding kick forward
  // (14%). In the air: dives down at an angle, foot first (11%).
  falconKick: { faf: 50, landLag: 16, once: true, noDrift: true, air: 'falconKickAir',
    rocket: { frame: 12, frames: 22, speed: [px(4.4), px(4.4)], lift: 0, gravity: 60, drag: 18, bounce: [px(0.6), px(1.0)], ground: true },
    trail: { part: 'toeF', from: 12, to: 34, width: 9, straight: true },
    hitboxes: hits(12, 30, [['toeF', 9], ['shinF', 7]], 14, 40, 50, 80) },
  falconKickAir: { faf: 46, landLag: 20, helpless: false, noDrift: true,
    rocket: { frame: 12, frames: 30, speed: [px(3.6), px(3.6)], lift: -px(3.6), gravity: 0, drag: 0, bounce: [px(0.8), px(2.4)] },
    trail: { part: 'toeF', from: 12, to: 40, width: 9, straight: true },
    hitboxes: hits(12, 40, [['toeF', 9], ['shinF', 7]], 11, 45, 40, 74) },

  // --- Smash attacks (see simeon.js for how they are performed) ---
  // Forward: Drop the Beat. Pulls out his DJ controller and smacks them with it: 18%.
  fsmash: { faf: 52, charge: { at: 13, max: 60, smash: true }, gear: { kind: 'djboard', from: 0, to: 42 },
    trail: { part: 'weaponF', from: 16, to: 20, width: 12, arc: true }, hitboxes: [
      ...hits(16, 19, [['weaponF', 11], ['weaponMidF', 9], ['fistF', 6]], 18, 361, 32, 98, { chargeScale: [180, 252], lagMult: 150 }),
    ] },
  // Up: Order in the Court. A gavel swung in a big arc over his head: 15%.
  usmash: { faf: 50, charge: { at: 9, max: 60, smash: true }, gear: { kind: 'gavel', from: 0, to: 40 },
    trail: { part: 'weaponF', from: 11, to: 19, width: 9, arc: true }, hitboxes: [
      ...hits(11, 19, [['weaponF', 10], ['weaponMidF', 8]], 15, 88, 34, 96, { chargeScale: [150, 210], lagMult: 150 }),
    ] },
  // Down: Spin Kick. A low spinning kick in front, then behind: 13% each.
  dsmash: { faf: 48, charge: { at: 11, max: 60, smash: true }, hitboxes: [
      ...hits(13, 16, [['toeF', 9], ['shinF', 8]], 13, 30, 32, 92, { group: 0, chargeScale: [130, 182], lagMult: 150 }),
      ...hits(20, 24, [['toeB', 9], ['shinB', 8]], 13, 30, 32, 92, { group: 1, dir: -1, chargeScale: [130, 182], lagMult: 150 }),
    ] },
};

const PUFF = { type: 'dart', draw: 'puff', silent: true, r: 4, hitPad: 2, chargeSpeed: [0, 0], life: 22, fadeFrames: 4,
  hit: { damage: 10, angle: 361, bkb: 0, kbg: 100, fkb: 20 } };

export const SAM = {
  ...SIMEON,
  id: 'sam',
  name: 'SAM',
  lastName: 'LAWRENCE',
  heightInches: 70,
  stats,
  parts,
  palettes,
  trailColors: ['#ff5a2a', '#ffd23a', '#ffffff'],   // the Falcon Kick's fire
  animations: { ...SIMEON.animations, ...animations },
  moves: { ...SIMEON.moves, ...moves },
  specials: { neutral: 'powderBlast', side: 'objection', up: 'appeal', down: 'falconKick' },
  projectiles: {
    puffHigh: { ...PUFF, speed: [px(3.6), px(0.4)] },
    puff: { ...PUFF, speed: [px(3.8), 0] },
    puffLow: { ...PUFF, speed: [px(3.6), -px(0.4)] },
  },
};
