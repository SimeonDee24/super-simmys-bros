// MALCOLM — card tricks, calisthenics and a pool cue. He shares every normal
// attack, grab and throw with Simeon (same skeleton, same animations); his
// look, a few stats, his smash attacks and his four specials are his own.
import { px } from '../engine/fixed.js';
import { anim } from '../engine/skeleton.js';
import { SIMEON } from './simeon.js';

const stats = {
  ...SIMEON.stats,
  weight: 94,                 // lean: a little lighter than Simeon
  runSpeed: px(2.85),
  airSpeed: px(2.75),
};

// ---------------------------------------------------------------------------
// Body parts: pixel art at 2 art pixels per world pixel, facing right.
// Messy dark hair with a fringe over his forehead, thin dark glasses (first
// skin only: G is the frame, drawn as skin in the second), a silver chain.
// ---------------------------------------------------------------------------
const HEAD = [
  '...kkkkkkk....',
  '.kkkkkkkkkkk..',
  'kKkkkkkkkkkkl.',
  'kKkkkkkkkkkkl.',
  'KKkkkkkkkbbbk.',
  'KKkkkkkkGGGGG.',
  'KkKqGGGGGmeeG.',
  'KkKqkkkkGGGGGl',
  'KKkKKkkkkkkkKl',
  'KKkKkkkkkkkkk.',
  '.KKkkkkkkkkpk.',
  '.KKkkkkkkkkk..',
  '..KKkkkkkkkk..',
  '....KKKKKkK...',
];
// change some pixels of the head: [row, column, 'letters']
const face = (...edits) => {
  const rows = HEAD.map((r) => r.split(''));
  for (const [r, c, str] of edits) for (let i = 0; i < str.length; i++) rows[r][c + i] = str[i];
  return { pivot: [5, 14], px: rows.map((r) => r.join('')) };
};
// Messy, fluffy dark hair: full on top, strands of fringe falling over the
// forehead, and longer at the back and over the ears.
// (hair column = head column + 1, row = head row + 4)
const HAIR = [
  '...h.hhh.hh.h.....',
  '..hhhhhhhhhhhhhh..',
  '.hhhhhhhhhhhhhhhh.',
  'hhhHhhhhhhhhnhhhhh',
  'hhhhhhHhhhhhhhhhhh',
  'hhHhhhhhhHhhhhHhhh',
  'hhhhhhhhhhhhhhhhhh',
  'hhhHhhhhhhhhhhhhhh',
  'hhhhhhh..hhhh.hhh.',
  'hhhhh....hh.h..h..',
  'hhhh..........h...',
  'hhhh..............',
  '.hhh..............',
  '.hhh..............',
  '..hh..............',
  '..h...............',
];
const parts = {
  ...SIMEON.parts,   // hands, forearms, legs and sneakers are shared
  head_neutral: face(),
  head_smile: face([10, 9, 'mmp'], [11, 10, 'q']),
  head_yell: face([9, 10, 'rrk'], [10, 10, 'rrr'], [11, 10, 'rr']),
  head_hurt: face([4, 9, 'bbk'], [6, 9, 'eee'], [10, 10, 'rr']),
  hair: { pivot: [6, 18], px: HAIR },
  // tee (or a tank top: Y and the sleeves S / s are skin in that skin), with
  // a silver chain round his neck hanging on his chest
  torso: {
    pivot: [6, 26],
    px: [
      '.....kkkk.....',
      '.....KcvcK....',
      '....TCYYYYtv..',
      '...TTtYYYttuvc',
      '..TTtttttttucv',
      '.TTttttttttuvc',
      'TTTttttttttcvu',
      'TTttttttttttCv',
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
      '.BBBBBBBBccBB.',
      '.JJjjjjjjjjii.',
      '.JJjjjjjjjjji.',
      '.JJjjjjjjjjii.',
      '.JJjjjjjjjjii.',
      '..JJjjjjjjii..',
    ],
  },
  upperArm: { pivot: [2, 0], px: ['SSssS', 'SSsss', 'SSsss', 'SSsss', 'sSSss', 'Kkkkl', 'Kkkkl', 'Kkkkl', 'KKkkl', 'Kkkkl', 'Kkkkl', 'Kkkkl', '.Kkk.'] },
};

const darker = (hex, k) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('');
const SKIN = { k: '#ebc5a6', K: '#cf9f80', l: '#f7dcc5', q: '#b9876b', p: '#c7887a' };
const BASE_COLORS = {
  ...SIMEON.palettes[0].colors,
  ...SKIN,
  h: '#17110e', H: '#2a1f19', n: '#45352b', b: '#1f1712',   // near-black messy hair, brows
  G: '#2b2a2e',                                             // glasses frame
};
const alt = (name, shirt, jeans, extra = {}) => ({
  name,
  colors: { ...BASE_COLORS, t: shirt[0], T: shirt[1], u: shirt[2], x: darker(shirt[1], 0.72), j: jeans[0], J: jeans[1], i: jeans[2], y: darker(jeans[1], 0.78),
    Y: shirt[0], S: shirt[1], s: shirt[0], ...extra },
});
const palettes = [
  // black tee and dark jeans, with his glasses
  alt('Specs', ['#2d2d37', '#1d1d26', '#41414e'], ['#2c2f44', '#1d1f30', '#3e425c'], { g: '#ffd23a' }),
  // white tank top and black jeans, no glasses
  alt('Tank Top', ['#f1efea', '#cfcbc3', '#ffffff'], ['#2a2a30', '#1a1a1f', '#3a3a42'], { G: SKIN.k, Y: SKIN.k, S: SKIN.K, s: SKIN.k, x: '#d9d5cd' }),
];

// ---------------------------------------------------------------------------
// Poses and animations for his smash attacks and specials.
// ---------------------------------------------------------------------------
const FISTS = { handF: 'fist', handB: 'fist' };
const STAND = { torso: 2, armF: [4, 10], armB: [-6, 8], legF: [5, -4], legB: [-6, -2] };
const AIR = { torso: 6, armF: [75, 20], armB: [-80, 15], legF: [18, -28], legB: [-14, -18], footF: 25, footB: 35 };
// bent over the table, cue level, back hand drawn back to take the shot
const CUE_AIM = { hip: [-1, 3], torso: 46, head: -30, armF: [88, -6], armB: [40, 70], legF: [24, -16], legB: [-22, -4], ...FISTS };
const CUE_STRIKE = { hip: [1, 3], torso: 46, head: -30, armF: [92, 0], armB: [70, 20], legF: [28, -18], legB: [-22, -4], ...FISTS, face: 'yell' };
// handstand: upside down on his hands, legs split
const HANDSTAND = { rot: 180, hip: [0, 15], torso: 0, head: 10, armF: [170, 0], armB: [-170, 0], legF: [14, -4], legB: [-14, -4], handF: 'open', handB: 'open' };
// windmill: down on his hands, legs swinging round low
const FLARE_A = { hip: [0, 10], torso: 60, head: -20, armF: [60, 20], armB: [40, 20], legF: [96, -4], legB: [70, -20], handF: 'open', handB: 'open', face: 'yell' };
const FLARE_B = { hip: [0, 10], torso: 60, head: -20, armF: [60, 20], armB: [40, 20], legF: [-70, -20], legB: [-96, -4], handF: 'open', handB: 'open', face: 'yell' };

const animations = {
  // Pick a Card: fans three cards out of his hand and flicks them.
  pickACard: anim(false, [
    [4, { torso: -4, armF: [40, 90], armB: [30, 80], legF: [10, -8], legB: [-8, -4], handF: 'open', handB: 'open' }],
    [6, { torso: -10, armF: [-40, 110], armB: [40, 60], legF: [14, -10], legB: [-10, -6], handF: 'open', face: 'smile' }],
    [3, { torso: 8, armF: [70, 20], armB: [-20, 40], legF: [22, -16], legB: [-14, -4], handF: 'open', face: 'smile' }],
    [12, { torso: 12, armF: [95, 0], armB: [-30, 40], legF: [24, -18], legB: [-16, -4], handF: 'open', face: 'smile' }],
    [10, { torso: 4, armF: [60, 20], armB: [-20, 30], legF: [10, -8], legB: [-8, -4] }],
    [1, STAND],
  ]),
  // Corner Pocket: lines up the cue, draws it back and strikes the cue ball.
  cornerPocket: anim(false, [
    [6, { ...CUE_AIM, armF: [80, 10] }],
    [6, { ...CUE_AIM, armF: [76, 30] }],
    [2, { ...CUE_AIM, armF: [70, 44] }],
    [3, CUE_STRIKE],
    [12, CUE_STRIKE],
    [12, { torso: 18, armF: [80, 20], armB: [-10, 30], legF: [16, -12], legB: [-12, -4], ...FISTS }],
    [2, STAND],
  ]),
  // Muscle-Up: hauls himself up an invisible bar, knees to chest, then flips over the top.
  muscleUp: anim(false, [
    [5, { hip: [0, 6], torso: 14, armF: [150, 40], armB: [140, 40], legF: [50, -95], legB: [30, -80], ...FISTS }],
    [6, { torso: -6, head: -12, armF: [176, 0], armB: [170, 0], legF: [70, -100], legB: [50, -90], ...FISTS, face: 'yell' }],
    [6, { torso: 0, head: -6, armF: [90, 120], armB: [80, 120], legF: [80, -120], legB: [60, -110], ...FISTS, face: 'yell' }],
    [10, { rot: 340, torso: 26, head: 18, armF: [50, 100], armB: [30, 110], legF: [96, -136], legB: [82, -130], ...FISTS }],
    [8, { rot: 360, ...AIR, armF: [150, 30], armB: [-140, -20] }],
    [8, AIR],
  ]),
  // Ace Up the Sleeve: pulls an ace from his sleeve and leaves it hanging in the air.
  aceUpTheSleeve: anim(false, [
    [5, { torso: 4, armF: [10, 120], armB: [-30, 40], legF: [10, -8], legB: [-8, -4], handB: 'open', face: 'smile' }],
    [5, { torso: 4, head: -4, armF: [60, 100], armB: [-30, 40], legF: [10, -8], legB: [-8, -4], handF: 'open', face: 'smile' }],
    [4, { torso: 8, head: -6, armF: [100, 10], armB: [-30, 40], legF: [16, -12], legB: [-12, -4], handF: 'open', face: 'smile' }],
    [12, { torso: 8, head: -6, armF: [104, 4], armB: [-30, 40], legF: [16, -12], legB: [-12, -4], handF: 'open', face: 'smile' }],
    [10, { torso: 4, armF: [60, 20], armB: [-20, 30], legF: [10, -8], legB: [-8, -4] }],
    [1, STAND],
  ]),
  // --- Smash attacks ---
  // Showstopper: tucks the party popper behind him, then thrusts it out and
  // pulls the string: a blast of black and yellow confetti.
  fsmash: anim(false, [
    [6, { torso: -6, armF: [-30, 40], armB: [30, 50], legF: [14, -10], legB: [-12, -6], ...FISTS }],
    [6, { hip: [-1, 1], torso: -16, head: 6, armF: [-80, 50], armB: [40, 60], legF: [22, -18], legB: [-16, -6], ...FISTS }],
    [3, { hip: [-1, 1], torso: -18, head: 6, armF: [-84, 50], armB: [44, 60], legF: [22, -18], legB: [-16, -6], ...FISTS, face: 'yell' }],
    [3, { hip: [2, 2], torso: 18, armF: [90, 0], armB: [70, 10], legF: [36, -30], legB: [-24, -4], ...FISTS, face: 'yell' }],
    [10, { hip: [2, 2], torso: 20, head: -4, armF: [92, 0], armB: [40, 30], legF: [36, -30], legB: [-24, -4], ...FISTS, face: 'smile' }],
    [14, { hip: [0, 1], torso: 10, armF: [80, 20], armB: [-10, 30], legF: [22, -18], legB: [-16, -4], ...FISTS }],
    [8, STAND],
  ]),
  // Handstand Kick: drops onto his hands and scissors his legs overhead.
  usmash: anim(false, [
    [4, { hip: [0, 8], torso: 40, head: -10, armF: [80, 20], armB: [60, 20], legF: [30, -40], legB: [-10, -30], handF: 'open', handB: 'open' }],
    [6, { ...HANDSTAND, rot: 160, hip: [0, 16], legF: [40, -60], legB: [20, -70] }],
    [2, { ...HANDSTAND, legF: [40, -60], legB: [20, -70] }],
    [3, { ...HANDSTAND, legF: [-14, -2], legB: [14, -2], face: 'yell' }],
    [8, { ...HANDSTAND, legF: [-34, -2], legB: [34, -2], face: 'yell' }],
    [6, { ...HANDSTAND, legF: [10, -40], legB: [-10, -40] }],
    [8, { rot: 300, hip: [0, 10], torso: 20, head: 10, armF: [150, 0], armB: [-150, 0], legF: [80, -110], legB: [60, -100], handF: 'open', handB: 'open' }],
    [4, { rot: 360, hip: [0, 4], torso: 10, armF: [60, 20], armB: [-40, 20], legF: [30, -40], legB: [-14, -20], handF: 'open', handB: 'open' }],
    [6, STAND],
  ]),
  // Windmill: drops to the floor on his hands and swings his legs round,
  // in front of him and then behind.
  dsmash: anim(false, [
    [5, { hip: [0, 6], torso: 30, head: -10, armF: [50, 20], armB: [30, 20], legF: [30, -50], legB: [-10, -30], handF: 'open', handB: 'open' }],
    [5, { ...FLARE_A, legF: [40, -40], legB: [20, -50] }],
    [2, { ...FLARE_A, legF: [40, -40], legB: [20, -50] }],
    [1, FLARE_A],
    [3, FLARE_A],
    [3, { ...FLARE_A, legF: [10, -10], legB: [-10, -10] }],
    [5, FLARE_B],
    [12, { hip: [0, 8], torso: 40, head: -16, armF: [50, 20], armB: [30, 20], legF: [30, -60], legB: [-20, -40], handF: 'open', handB: 'open' }],
    [8, STAND],
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
  // Neutral special: Pick a Card. Flicks three cards out in a fan, high,
  // straight and low. 3% each.
  pickACard: { faf: 36, spawns: [
    { frame: 13, from: 'fistF', projectile: 'cardHigh' },
    { frame: 13, from: 'fistF', projectile: 'card' },
    { frame: 13, from: 'fistF', projectile: 'cardLow' },
  ], hitboxes: [] },

  // Side special: Corner Pocket. Strikes a cue ball with his pool cue: the
  // cue tip hits up close (6%), and the ball shoots off along the floor,
  // bouncing off walls (8% fast, 4% once it slows). One ball at a time.
  cornerPocket: { faf: 44, limit: 1, noDrift: true, float: { gravity: 40, fall: 50 },
    gear: { kind: 'cue', from: 0, to: 31 },
    spawn: { frame: 17, from: 'fistF', projectile: 'cueBall' },
    hitboxes: [hit(17, 20, 'weaponF', 6, 6, 30, 40, 60, { off: [0, 8] })] },

  // Up special: Muscle-Up. Hauls himself about 110px straight up with a big pull and
  // flips over the top: 8% on the way up, 5% at the top. Steers a little.
  // Falls helpless afterwards.
  muscleUp: { faf: 44, landLag: 16, helpless: true,
    fly: { frame: 5, frames: 15, rise: px(4.8), accel: px(1.5), drift: px(1.1), steer: px(0.1) },
    ledgeGrab: { from: 5, rising: true },
    trail: { part: 'kneeF', from: 6, to: 26, width: 8 },
    hitboxes: [
      ...hits(5, 10, [['kneeF', 8], ['fistF', 7]], 8, 85, 40, 70, { group: 0 }),
      ...hits(17, 26, [['toeF', 8], ['kneeF', 7]], 5, 60, 40, 80, { group: 1 }),
    ] },

  // Down special: Ace Up the Sleeve. Leaves an ace hanging in the air in front
  // of him for four seconds: whoever touches it is popped upward (9%). One at a time.
  aceUpTheSleeve: { faf: 36, limit: 1, spawn: { frame: 14, from: 'fistF', projectile: 'ace' }, hitboxes: [] },

  // --- Smash attacks (see simeon.js for how they are performed) ---
  // Forward: Showstopper. A party popper fired into their face: a wide blast
  // of black and yellow confetti. 15%.
  fsmash: { faf: 50, charge: { at: 12, max: 60, smash: true }, gear: { kind: 'popper', from: 0, to: 40, active: [16, 30] }, hitboxes: [
      hit(16, 19, 'fistF', 9, 15, 361, 34, 98, { off: [12, -1], chargeScale: [150, 210], lagMult: 150 }),
      hit(16, 19, 'fistF', 10, 13, 361, 30, 94, { off: [25, -3], chargeScale: [130, 182], lagMult: 150 }),
    ] },
  // Up: Handstand Kick. Flips onto his hands and scissors his legs up
  // overhead. 15%.
  usmash: { faf: 46, charge: { at: 12, max: 60, smash: true },
    trail: { part: 'toeF', from: 12, to: 18, width: 9, arc: true }, hitboxes: [
      ...hits(13, 17, [['toeF', 10], ['toeB', 10], ['kneeF', 8]], 15, 88, 34, 96, { chargeScale: [150, 210], lagMult: 150, off: [0, -5] }),
    ] },
  // Down: Windmill. A breakdance flare, low and round: legs in front (13%),
  // then behind (12%).
  dsmash: { faf: 48, charge: { at: 10, max: 60, smash: true }, twirl: [[16, 18]], hitboxes: [
      hit(13, 15, 'hip', 11, 13, 30, 32, 94, { off: [17, 4], group: 0, chargeScale: [130, 182], lagMult: 150 }),
      hit(18, 21, 'hip', 11, 12, 30, 30, 92, { off: [-17, 4], group: 1, dir: -1, chargeScale: [120, 174], lagMult: 150 }),
    ] },
};

const CARD = { type: 'dart', draw: 'card', r: 3, hitPad: 2, chargeSpeed: [0, 0], life: 34, fadeFrames: 4, hit: { damage: 30, angle: 361, bkb: 25, kbg: 35 } };

export const MALCOLM = {
  ...SIMEON,
  id: 'malcolm',
  name: 'MALCOLM',
  lastName: 'MCKINNON',
  heightInches: 71,
  stats,
  parts,
  palettes,
  trailColors: ['#1b1b22', '#ffd23a', '#fff6c2'],   // black and yellow
  animations: { ...SIMEON.animations, ...animations },
  moves: { ...SIMEON.moves, ...moves },
  specials: { neutral: 'pickACard', side: 'cornerPocket', up: 'muscleUp', down: 'aceUpTheSleeve' },
  projectiles: {
    // three cards in a fan
    cardHigh: { ...CARD, speed: [px(4.3), px(1.0)] },
    card: { ...CARD, speed: [px(4.5), 0] },
    cardLow: { ...CARD, speed: [px(4.3), -px(1.0)] },
    // the ace, hanging in the air where he left it
    ace: { type: 'dart', draw: 'ace', r: 6, hitPad: 1, speed: [px(0.15), 0], chargeSpeed: [0, 0], life: 240, fadeFrames: 20,
      hit: { damage: 90, angle: 85, bkb: 45, kbg: 70 } },
    // the cue ball: shot along the floor, bounces off walls, rolls to a stop
    cueBall: {
      draw: 'cueball', r: 3, hitPad: 1,
      speed: [px(5.0), 0], chargeSpeed: [0, 0],
      gravity: px(0.3), maxFall: px(4),
      bounce: 60, bounceKeepX: 250, minBounce: px(0.8), maxBounces: 1,
      rollFriction: px(0.07), minRollSpeed: px(1.5),
      life: 150, fadeFrames: 20, popUp: px(1.8),
      hit: { damage: 80, angle: 40, bkb: 35, kbg: 60 },
      rollHit: { damage: 40, angle: 40, bkb: 25, kbg: 45 },
    },
  },
};
