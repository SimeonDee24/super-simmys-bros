// MAX CAULDWELL — president of the economics student association. A
// heavyweight in business casual: body slams, a champagne bottle and a lot of
// cash. He shares every normal attack, grab and throw with Simeon (same
// skeleton, same animations); his look, his stats, his smash attacks and his
// four specials are his own.
import { px } from '../engine/fixed.js';
import { anim } from '../engine/skeleton.js';
import { SIMEON } from './simeon.js';

const stats = {
  ...SIMEON.stats,
  weight: 118,                // heavy: hard to launch
  walkSpeed: px(1.8),
  runSpeed: px(2.5),
  dashSpeed: px(2.8),
  airSpeed: px(2.45),
  fallSpeed: px(3.1),         // falls fast
};

// ---------------------------------------------------------------------------
// Body parts: pixel art at 2 art pixels per world pixel, facing right.
// A round, full face, thick brows and a huge puff of curly black hair.
// ---------------------------------------------------------------------------
const HEAD = [
  '...kkkkkkk....',
  '.kkkkkkkkkkk..',
  'kKkkkkkkkkkkl.',
  'kKkkkkkkkkkkl.',
  'KKkkkkkkkbbbb.',
  'KKkkkkkkkkeek.',
  'KkKqkkkkkkeek.',
  'KkKqkkkkkkkkkl',
  'KKkKKkkkkkkkkl',
  'KKkKkkkkkkkkkk',
  'KKKkkkkkkkpkkk',
  '.KKkkkkkkkkkkk',
  '.KKKkkkkkkkkk.',
  '...KKKKKKKkK..',
];
// change some pixels of the head: [row, column, 'letters']
const face = (...edits) => {
  const rows = HEAD.map((r) => r.split(''));
  for (const [r, c, str] of edits) for (let i = 0; i < str.length; i++) rows[r][c + i] = str[i];
  return { pivot: [5, 14], px: rows.map((r) => r.join('')) };
};
// A huge round puff of tight black curls: about as tall again as his head,
// out past the back of it and down over his ears, with a fringe down to his
// brows. Built from an oval, with the face cut out of it.
// (hair column = head column + 8, row = head row + 14)
const HAIR = (() => {
  const W = 30, H = 25, out = [];
  for (let r = 0; r < H; r++) {
    let row = '';
    for (let c = 0; c < W; c++) {
      const dx = (c - 14.5) / 15, dy = (r - 11.5) / 12.5;
      // a lumpy edge, so it reads as curls rather than a smooth helmet
      const bump = ((c * 7 + r * 13) % 5) * 0.025;
      let on = dx * dx + dy * dy <= 1 - bump;
      const hr = r - 14, hc = c - 8;   // the same cell in head coordinates
      if (hr >= 0) {
        if (hr <= 2) on = on && hc <= 15;
        else if (hr === 3) on = on && (hc <= 11 || hc === 13);
        else if (hr === 4) on = on && (hc <= 7 || hc === 9);
        else on = on && hc <= 4 - Math.max(0, hr - 7);
      }
      const k = (Math.imul(c + 1, 73856093) ^ Math.imul(r + 1, 19349663)) >>> 0;   // scattered curls: a shine here, a shadow there
      row += !on ? '.' : k % 13 === 0 ? 'n' : k % 5 === 0 ? 'H' : 'h';
    }
    out.push(row);
  }
  return out;
})();
const rows = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));
const parts = {
  ...SIMEON.parts,   // hands and shoes are shared (the shoes are recoloured as loafers)
  head_neutral: face(),
  head_smile: face([10, 9, 'qpq'], [11, 10, 'q']),
  head_yell: face([9, 10, 'rrk'], [10, 10, 'rrr'], [11, 10, 'rr']),
  head_hurt: face([4, 9, 'bbkk'], [5, 9, 'kkkk'], [6, 10, 'eek'], [10, 10, 'rr']),
  hair: { pivot: [13, 28], px: HAIR },
  // a shirt (t), collar and cuffs (O), buttons or zip (Z) down the front:
  // broad and thick all the way down, not just at the belly
  torso: {
    pivot: [7, 26],
    px: [
      '......kkkk........',
      '.....OKkkkO.......',
      '...TTOOkkOOuu.....',
      '..TTttOttOtttu....',
      '.TTttttttZttttu...',
      'TTTttttttttttttu..',
      'TTtttttttttZtttu..',
      'TTttttttttttttttu.',
      'TTxttttttttZttttu.',
      'TTTxttttttttttttu.',
      'TTtTxttttttttZttu.',
      'TTttxtttttttttttu.',
      'TTtttttttttttZttu.',
      'TTttttttttttttttu.',
      'TTtttttttttttZttu.',
      'TTtttttttttttttuu.',
      'TTttttttttttttZtu.',
      '.TTttttttttttttuu.',
      '.TTxtttttttttttu..',
      '.TTtxttttttttttu..',
      '.TTtttttttttttu...',
      '.xTTtttttttttxx...',
      '.BBBBBBBBBBccB....',
      '.JJjjjjjjjjjjii...',
      '.JJjjjjjjjjjjji...',
      '.JJjjjjjjjjjjii...',
      '.JJjjjjjjjjjjii...',
      '..JJjjjjjjjjii....',
    ],
  },
  // long sleeves on thicker arms, with a cuff at the wrist
  upperArm: { pivot: [3, 0], px: rows(13, (i) => (i === 12 ? '.TTttu.' : i === 6 ? 'TTxtttu' : 'TTttttu')) },
  lowerArm: { pivot: [3, 0], px: rows(11, (i) => (i >= 9 ? '.OOOOO.' : i === 4 ? 'TTxtttu' : i > 6 ? '.TTttu.' : 'TTttttu')) },
  // chinos / slacks on thicker legs, with a crease
  upperLeg: { pivot: [5, 0], px: rows(21, (i) => (i === 16 ? 'JJjjyyjjii' : 'JJjjjjjjii')) },
  lowerLeg: { pivot: [4, 0], px: rows(19, (i) => (i >= 16 ? 'JJjjjjjiii' : i === 12 ? 'JJjjjyjii.' : i < 4 ? 'JJjjjjjii.' : '.JJjjjjii.')) },
};

const darker = (hex, k) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('');
const BASE_COLORS = {
  ...SIMEON.palettes[0].colors,
  k: '#ebc6a2', K: '#cd9f7c', l: '#f7dcc3', q: '#b6856a', p: '#cd8a82',   // skin, lips
  h: '#0f0c0c', H: '#221c1b', n: '#3a3231', b: '#1a1312',                 // jet black curls, thick brows
  e: '#1b1310',
};
const alt = (name, shirt, pants, extra = {}) => ({
  name,
  colors: { ...BASE_COLORS, t: shirt[0], T: shirt[1], u: shirt[2], x: darker(shirt[1], 0.8), j: pants[0], J: pants[1], i: pants[2], y: darker(pants[1], 0.8), ...extra },
});
const palettes = [
  // light blue oxford shirt, tan belt, khaki chinos, brown loafers
  alt('Oxford', ['#a9c8ea', '#7fa5cf', '#cfe1f5'], ['#c9b48a', '#a8946c', '#e0cea6'],
    { O: '#e3eef9', Z: '#f6f6f2', B: '#6b4428', c: '#d9b25a', w: '#6b4428', W: '#3a2416', g: '#8a5a36' }),
  // black quarter-zip over a white collar, charcoal slacks, black loafers
  alt('Quarter-Zip', ['#26262e', '#18181f', '#383842'], ['#4a4d57', '#363842', '#61646f'],
    { O: '#f6f6f2', Z: '#c9ced8', B: '#111114', c: '#c9ced8', w: '#2a2a30', W: '#111114', g: '#3a3a42' }),
];

// ---------------------------------------------------------------------------
// Poses and animations for his smash attacks and specials.
// ---------------------------------------------------------------------------
const FISTS = { handF: 'fist', handB: 'fist' };
const STAND = { torso: 2, armF: [4, 10], armB: [-6, 8], legF: [5, -4], legB: [-6, -2] };
const AIR = { torso: 6, armF: [75, 20], armB: [-80, 15], legF: [18, -28], legB: [-14, -18], footF: 25, footB: 35 };
// belly first, chest out, arms swung back
const BELLY_RUSH = { hip: [0, 2], torso: -10, head: -14, armF: [-50, 40], armB: [-70, 30], legF: [50, -40], legB: [-40, -20], ...FISTS, face: 'yell' };
const TUCK = { hip: [0, -6], torso: 20, head: 6, armF: [70, 100], armB: [60, 100], legF: [90, -130], legB: [76, -124], ...FISTS };
const HOLD_CHUTE = { torso: -2, head: -10, armF: [168, 6], armB: [-168, -6], legF: [12, -10], legB: [-12, -14], footF: 20, footB: 30, ...FISTS, face: 'smile' };

const animations = {
  // Money Gun: levels a money gun and sprays bills (held here while the button is).
  moneyGun: anim(false, [
    [4, { torso: 4, armF: [50, 60], armB: [-20, 40], legF: [12, -10], legB: [-10, -6], handF: 'fist' }],
    [4, { torso: 8, head: -4, armF: [92, 6], armB: [70, 30], legF: [18, -14], legB: [-14, -6], ...FISTS, face: 'yell' }],
    [2, { torso: 8, head: -4, armF: [94, 4], armB: [72, 28], legF: [18, -14], legB: [-14, -6], ...FISTS, face: 'yell' }],
    [12, { torso: 6, armF: [70, 30], armB: [30, 40], legF: [14, -10], legB: [-12, -6], ...FISTS }],
    [8, STAND],
  ]),
  // Hostile Takeover: lowers his shoulder and charges belly first.
  hostileTakeover: anim(false, [
    [6, { hip: [-1, 3], torso: -4, armF: [-30, 50], armB: [-40, 50], legF: [30, -40], legB: [-10, -30], ...FISTS }],
    [6, { hip: [-1, 3], torso: -12, head: -8, armF: [-60, 40], armB: [-80, 30], legF: [36, -50], legB: [-14, -30], ...FISTS, face: 'yell' }],
    [10, BELLY_RUSH],
    [10, { ...BELLY_RUSH, legF: [-30, -20], legB: [50, -50] }],
    [12, { torso: 6, armF: [40, 30], armB: [-30, 30], legF: [20, -14], legB: [-14, -6], ...FISTS }],
    [2, STAND],
  ]),
  // Golden Parachute: springs up belly first, then floats down hanging from a gold parachute.
  goldenParachute: anim(false, [
    [5, { hip: [0, 6], torso: 14, armF: [40, 60], armB: [-30, 60], legF: [50, -95], legB: [30, -80], ...FISTS }],
    [8, { ...BELLY_RUSH, torso: -14, head: -20, armF: [-40, 30], armB: [-60, 30], legF: [10, -20], legB: [-20, -30] }],
    [8, HOLD_CHUTE],
    [24, { ...HOLD_CHUTE, legF: [20, -24], legB: [-6, -20] }],
    [25, HOLD_CHUTE],
  ]),
  // Market Crash: hops up headfirst, then drops like a stone, backside first.
  marketCrash: anim(false, [
    [6, { hip: [0, 6], torso: 14, armF: [40, 60], armB: [-30, 60], legF: [50, -95], legB: [30, -80], ...FISTS }],
    [8, { hip: [0, -2], torso: -8, head: -24, armF: [160, 20], armB: [140, 20], legF: [20, -30], legB: [-10, -30], ...FISTS, face: 'yell' }],
    [8, { ...TUCK, rot: -30 }],
    [8, { hip: [0, 0], torso: -6, head: -8, armF: [150, 20], armB: [-150, -20], legF: [86, -10], legB: [70, -16], handF: 'open', handB: 'open', face: 'yell' }],
    [60, { hip: [0, 0], torso: -6, head: -8, armF: [160, 20], armB: [-160, -20], legF: [86, -10], legB: [70, -16], handF: 'open', handB: 'open', face: 'yell' }],
  ]),
  marketCrashLand: anim(false, [
    [3, { hip: [0, 12], torso: -10, head: -6, armF: [110, 20], armB: [-110, -20], legF: [86, -10], legB: [70, -16], handF: 'open', handB: 'open', face: 'yell' }],
    [16, { hip: [0, 11], torso: -4, head: -4, armF: [80, 20], armB: [-80, -20], legF: [86, -12], legB: [70, -16], handF: 'open', handB: 'open' }],
    [10, { hip: [0, 6], torso: 10, armF: [40, 40], armB: [-30, 40], legF: [40, -60], legB: [-10, -40] }],
    [3, STAND],
  ]),
  // --- Smash attacks ---
  // Money Bag: heaves a sack of cash back over his shoulder and slams it down in front.
  fsmash: anim(false, [
    [6, { torso: -4, armF: [120, 30], armB: [80, 60], legF: [16, -12], legB: [-12, -6], ...FISTS }],
    [8, { hip: [-1, 1], torso: -20, head: 6, armF: [210, 30], armB: [150, 60], legF: [24, -20], legB: [-16, -6], ...FISTS }],
    [3, { hip: [-1, 1], torso: -24, head: 8, armF: [218, 30], armB: [156, 60], legF: [24, -20], legB: [-16, -6], ...FISTS, face: 'yell' }],
    [3, { hip: [1, 1], torso: 6, armF: [140, 0], armB: [100, 40], legF: [30, -24], legB: [-20, -4], ...FISTS, face: 'yell' }],
    [12, { hip: [2, 4], torso: 34, head: -8, armF: [62, 0], armB: [30, 40], legF: [42, -44], legB: [-28, -4], ...FISTS, face: 'yell' }],
    [16, { hip: [0, 2], torso: 16, armF: [60, 20], armB: [20, 40], legF: [24, -22], legB: [-16, -4], ...FISTS }],
    [8, STAND],
  ]),
  // Last Call: swings a bottle in a big arc from in front of him, up over
  // his head and down behind.
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
  // Cannonball: hops up with his knees tucked and slams down on his backside.
  dsmash: anim(false, [
    [5, { hip: [0, 4], torso: 12, armF: [40, 40], armB: [-30, 40], legF: [30, -50], legB: [-10, -40], ...FISTS }],
    [5, { hip: [0, 5], torso: 14, armF: [50, 40], armB: [-30, 40], legF: [36, -60], legB: [-10, -50], ...FISTS }],
    [2, { hip: [0, 5], torso: 14, armF: [50, 40], armB: [-30, 40], legF: [36, -60], legB: [-10, -50], ...FISTS, face: 'yell' }],
    [3, TUCK],
    [3, { hip: [0, 10], torso: -10, head: -8, armF: [120, 20], armB: [-120, -20], legF: [86, -10], legB: [70, -16], handF: 'open', handB: 'open', face: 'yell' }],
    [12, { hip: [0, 10], torso: -6, head: -8, armF: [110, 20], armB: [-110, -20], legF: [86, -10], legB: [70, -16], handF: 'open', handB: 'open', face: 'yell' }],
    [10, { hip: [0, 6], torso: 10, armF: [40, 40], armB: [-30, 40], legF: [40, -60], legB: [-10, -40] }],
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
  // Neutral special: Money Gun. Hold the button to spray a stream of cash
  // in front of him (about 1% a bill), for up to two and a half seconds. Like
  // a fire breath, the range shrinks the longer it is used, and grows back
  // while he does other things.
  moneyGun: { faf: 30, float: { gravity: 40, fall: 50 }, charge: { at: 9, max: 150 },
    stream: { every: 4, from: 'fistF', use: 6, minLife: 8, projectiles: ['billHigh', 'bill', 'billLow'] },
    gear: { kind: 'moneyGun', from: 2, to: 24 }, hitboxes: [] },

  // Side special: Hostile Takeover. Charges belly first (12%). Stays on the
  // floor when used there. Once per jump in the air.
  hostileTakeover: { faf: 54, landLag: 14, once: true, noDrift: true, float: { gravity: 20, fall: 25 },
    rocket: { frame: 12, frames: 20, speed: [px(4.0), px(4.0)], lift: 0, gravity: 30, drag: 12, bounce: [px(0.9), px(1.6)], ground: true },
    ledgeGrab: { from: 24 },
    trail: { part: 'chest', from: 12, to: 32, width: 10, straight: true },
    hitboxes: hits(12, 32, [['chest', 10], ['hip', 9]], 12, 45, 50, 82) },

  // Up special: Golden Parachute. Springs up belly first (9%), then floats
  // down slowly under a gold parachute, steering. Falls helpless when it ends.
  goldenParachute: { faf: 70, landLag: 12, helpless: true,
    gear: { kind: 'parachute', from: 14, to: 70 },
    fly: { frame: 5, frames: 15, rise: px(4.6), accel: px(1.6), drift: px(1.3), steer: px(0.1), glide: { gravity: 18, fall: 22 } },
    ledgeGrab: { from: 5, rising: true },
    hitboxes: hits(5, 12, [['chest', 10], ['neck', 8]], 9, 80, 50, 70) },

  // Down special: Market Crash. A hop up headfirst (4%), then he drops
  // straight down backside first (13%: spikes in the air, pops grounded
  // fighters up), and the landing shakes the floor on both sides (6%).
  // In the air he drops straight away. If there is no floor below, he falls
  // helpless.
  marketCrash: { faf: 90, landLag: 20, helpless: true,
    plunge: { frame: 6, fallAt: 22, rise: px(3.8), hopX: px(0.4), drift: px(0.6), steer: px(0.08), fall: px(6.2), airSkip: true, landMove: 'marketCrashLand' },
    ledgeGrab: { from: 6, rising: true },
    hitboxes: [
      ...hits(6, 14, [['neck', 9], ['chest', 9]], 4, 80, 40, 50, { group: 0 }),
      hit(22, 90, 'hip', 12, 13, 270, 30, 70, { group: 1, onlyAir: true, off: [0, 6] }),
      hit(22, 90, 'hip', 12, 13, 75, 50, 70, { group: 1, onlyGround: true, off: [0, 6] }),
    ] },
  marketCrashLand: { faf: 32, gear: { kind: 'slam', from: 0, to: 14, active: [0, 14] }, hitboxes: [
      hit(1, 3, 'hip', 10, 6, 60, 50, 60, { off: [16, 8], radial: true }),
      hit(1, 3, 'hip', 10, 6, 60, 50, 60, { off: [-16, 8], radial: true }),
    ] },

  // --- Smash attacks (see simeon.js for how they are performed) ---
  // Forward: Money Bag. A heavy sack of cash slammed down in front. Slow but
  // strong: 18%.
  fsmash: { faf: 56, charge: { at: 14, max: 60, smash: true }, gear: { kind: 'moneybag', from: 0, to: 46, active: [20, 34] },
    trail: { part: 'weaponF', from: 18, to: 23, width: 12, arc: true }, hitboxes: [
      ...hits(19, 22, [['weaponF', 11], ['weaponMidF', 8], ['fistF', 6]], 18, 361, 34, 98, { chargeScale: [180, 252], lagMult: 150 }),
    ] },
  // Up: Last Call. Swings a bottle in a big arc over his head, front to
  // back: 15% anywhere along the swing.
  usmash: { faf: 50, charge: { at: 9, max: 60, smash: true }, gear: { kind: 'whiskey', from: 0, to: 40 },
    trail: { part: 'weaponF', from: 11, to: 19, width: 9, arc: true }, hitboxes: [
      ...hits(11, 19, [['weaponF', 10], ['weaponMidF', 8]], 15, 88, 34, 96, { group: 0, chargeScale: [150, 210], lagMult: 150 }),
    ] },
  // Down: Cannonball. Hops and slams down on his backside: the floor shakes
  // on both sides of him. 15%.
  dsmash: { faf: 50, charge: { at: 10, max: 60, smash: true }, gear: { kind: 'slam', from: 16, to: 30, active: [16, 30] }, hitboxes: [
      hit(17, 19, 'hip', 11, 15, 50, 30, 94, { off: [16, 8], radial: true, chargeScale: [150, 210], lagMult: 150 }),
      hit(17, 19, 'hip', 11, 15, 50, 30, 94, { off: [-16, 8], radial: true, chargeScale: [150, 210], lagMult: 150 }),
      hit(17, 19, 'hip', 9, 15, 50, 30, 94, { off: [0, 6], radial: true, chargeScale: [150, 210], lagMult: 150 }),
    ] },
};

const BILL = { type: 'dart', draw: 'bill', silent: true, r: 3, hitPad: 3, chargeSpeed: [0, 0], life: 26, fadeFrames: 3,
  hit: { damage: 12, angle: 361, bkb: 0, kbg: 100, fkb: 22 } };

export const MAX = {
  ...SIMEON,
  id: 'max',
  name: 'MAX',
  lastName: 'CAULDWELL',
  heightInches: 70,
  stats,
  parts,
  palettes,
  trailColors: ['#2f9e5b', '#8fe0a8', '#ffe8a3'],   // cash green and gold
  animations: { ...SIMEON.animations, ...animations },
  moves: { ...SIMEON.moves, ...moves },
  specials: { neutral: 'moneyGun', side: 'hostileTakeover', up: 'goldenParachute', down: 'marketCrash' },
  projectiles: {
    // the money gun's spray of bills, fanned a little up and down
    billHigh: { ...BILL, speed: [px(3.7), px(0.35)] },
    bill: { ...BILL, speed: [px(3.8), 0] },
    billLow: { ...BILL, speed: [px(3.7), -px(0.35)] },
  },
};
