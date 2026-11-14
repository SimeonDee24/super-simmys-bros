// KAELYN — quick and light, on roller skates for her specials. She shares
// every normal attack, grab and throw with Simeon (same skeleton, same
// animations); only her look, a few stats and her four specials are her own.
import { px } from '../engine/fixed.js';
import { anim } from '../engine/skeleton.js';
import { SIMEON } from './simeon.js';

const stats = {
  ...SIMEON.stats,
  weight: 88,                 // lighter: launched a little further
  walkSpeed: px(2.1),
  runSpeed: px(3.05),
  dashSpeed: px(3.3),
  airSpeed: px(2.85),
  fallSpeed: px(2.75),
};

// ---------------------------------------------------------------------------
// Body parts: pixel art at 2 art pixels per world pixel, facing right.
// Long dark wavy hair, cream sweater, light sweatpants with dark side stripes.
// ---------------------------------------------------------------------------
const HEAD = [
  '...kkkkkkk....',
  '.kkkkkkkkkkk..',
  'kkkkkkkkkkkkl.',
  'kkkkkkkkkkkkl.',
  'Kkkkkkkkkkbbk.',
  'Kkkkkkkkkeeek.',
  'Kkkkkkkkkmek..',
  'Kkkkkkkkokkkl.',
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
// Long hair, parted in the middle: over the top and back of her head, then
// down past her shoulders. (hair column = head column + 3, row = head row + 4)
const HAIR = [
  '......hhhhhhh.....',
  '....hhhhhhhhhhh...',
  '...hhhHhhhhnhhhh..',
  '..hhhHhhhhnhhhhhh.',
  '..hhHhhhhhhhhhhhh.',
  '.hhhHhhhhhhhhhhh..',
  '.hhHhhhhhhhhhh....',
  '.hhHhhhhhhhh......',
  '.hhhHhhhhhh.......',
  '.hhhHhhhhh........',
  '.hhhhHhhhh........',
  'hhhhhHhhhh........',
  'hhhhHhhhhh........',
  'hhhhHhhhh.........',
  'hhhHhhhhh.........',
  'hhhHhhhhh.........',
  'hhhHhhhh..........',
  'hhhhHhhh..........',
  'hhhhHhhhh.........',
  '.hhhhHhhhh........',
  '.hhhhHhhhh........',
  'hhhhHhhhhh........',
  'hhhHhhhhhhh.......',
  'hhhhHhhhhh........',
  '.hhhhHhhhh........',
  '.hhhHhhhhh........',
  'hhhhHhhhh.........',
  'hhhHhhhhh.........',
  '.hhhHhhh..........',
  '.hhhhhh...........',
  '..hhhh............',
];
const rows = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));
const parts = {
  ...SIMEON.parts,   // hands are shared
  head_neutral: face(),
  head_smile: face([10, 9, 'ppp']),
  head_yell: face([4, 9, 'kbb'], [10, 9, 'krr'], [11, 9, 'rr']),
  head_hurt: face([5, 9, 'kkkk'], [6, 9, 'eee'], [10, 10, 'rr']),
  hair: { pivot: [8, 18], px: HAIR },
  // loose sweater with a ribbed hem over the top of her sweatpants
  torso: {
    pivot: [6, 26],
    px: [
      '.....kkkk.....',
      '.....KkkkK....',
      '....uuKkkuu...',
      '...TTttttttu..',
      '..TTtttttttuu.',
      '.TTttttttttuu.',
      '.TTtttttttttu.',
      '.TTtttttttttu.',
      '.TTttttttttuu.',
      '.TTxtttttttuu.',
      '.TTtttttttttu.',
      '..TTtttttttu..',
      '..TTtttttttu..',
      '..TTxttttttu..',
      '..TTtttttttu..',
      '..TTtttttttu..',
      '..TTttttttuu..',
      '..TTtttttttu..',
      '..TTxtttttxu..',
      '.TTttttttttu..',
      '.TTtttttttttu.',
      '.xTxTxtxtxtx..',
      '.JJjjjsjjjji..',
      '.JJjjjsjjjjii.',
      '.JJjjjsjjjjii.',
      '.JJjjjsjjjjii.',
      '.JJjjjsjjjjii.',
      '..JJjjsjjjii..',
    ],
  },
  // long sleeves, with a cuff at the wrist
  upperArm: { pivot: [2, 0], px: rows(13, (i) => (i === 12 ? '.Ttt.' : i === 6 ? 'TTxtu' : 'TTttu')) },
  lowerArm: { pivot: [2, 0], px: rows(11, (i) => (i >= 9 ? '.xTx.' : i === 4 ? 'TTxtu' : i > 6 ? '.Tttu' : 'TTttu')) },
  // sweatpants with two dark stripes down the side
  upperLeg: { pivot: [3, 0], px: rows(21, () => 'JJjsjii') },
  lowerLeg: { pivot: [3, 0], px: rows(19, (i) => (i >= 17 ? 'JJJJJJi' : i === 15 ? 'JJjsyii' : i < 3 || i > 12 ? 'JJjsjii' : '.Jjsjii')) },
  foot: { pivot: [3, 2], px: ['..wwww......', '.gwwwwwW....', '.gwwwwwwwW..', 'wwwwgggwwwwW', 'WWWWWWWWWWWW', '.WWWWWWWWWW.'] },
  // roller skate, worn during her specials: a boot on four wheels
  skate: { pivot: [3, 2], px: ['.gwwww......', '.gwwwwwW....', '.gwwwwwwwW..', 'wwwwgggwwwwW', '.zZz.BB.zZz.', '.zzz....zzz.'] },
};

const darker = (hex, k) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('');
const BASE_COLORS = {
  k: '#f4d6c0', K: '#dcb09a', l: '#fde9da', q: '#c4927a', o: '#f3c3b2',   // skin, blush
  h: '#2b1a14', H: '#3f281e', n: '#6b4a38', b: '#3a241b',                 // long dark brown hair, brows
  w: '#f6f6f2', W: '#bfc5d0', g: '#ff8fc6',                               // shoes and skate boots, pink trim
  z: '#ff9a3c', Z: '#ffd08a', B: '#5d667b',                               // skate wheels and truck
  e: '#1b1310', m: '#ffffff', r: '#8c3a36', p: '#d9798a',                 // eyes, mouth, lips
  c: '#dfe3ea', C: '#9aa1ad', v: '#ffffff',
};
const alt = (name, top, pants, stripe, extra = {}) => ({
  name,
  colors: { ...BASE_COLORS, t: top[0], T: top[1], u: top[2], x: darker(top[1], 0.8), j: pants[0], J: pants[1], i: pants[2], y: darker(pants[1], 0.82), s: stripe, ...extra },
});
const palettes = [
  alt('Cozy', ['#d9c9a8', '#b8a684', '#ecdfc4'], ['#e4e4e6', '#bcbcc4', '#f6f6f8'], '#26262e'),
  alt('Rink', ['#8b4fc4', '#643795', '#ab77de'], ['#26262e', '#18181f', '#383842'], '#ff8fc6', { g: '#3fc7b8', z: '#3fc7b8', Z: '#a6f0e6' }),
];

// ---------------------------------------------------------------------------
// Special move poses and animations.
// ---------------------------------------------------------------------------
const FISTS = { handF: 'fist', handB: 'fist' };
const STAND = { torso: 2, armF: [4, 10], armB: [-6, 8], legF: [5, -4], legB: [-6, -2] };
const DASH = { hip: [0, 2], torso: 36, head: -26, armF: [-55, 105], armB: [60, 50], legF: [62, -85], legB: [-48, -8], footB: -30, ...FISTS, face: 'yell' };
const BOMB_DROP = { torso: 4, head: 6, armF: [150, 20], armB: [-150, -20], legF: [22, -8], legB: [-18, -4], ...FISTS, face: 'yell' };
const FLIP_TUCK = { torso: 28, head: 18, armF: [50, 100], armB: [30, 110], legF: [96, -136], legB: [82, -130], ...FISTS };
const FLIP_KICK = { torso: -30, head: 10, armF: [-80, 30], armB: [-130, 20], legF: [58, -3], legB: [36, -105], footF: -30, ...FISTS, face: 'yell' };
const CUT_KICK = { torso: -8, head: -6, legF: [112, -6], legB: [-24, -46], armF: [-40, 40], armB: [60, 40], footF: -20, ...FISTS, face: 'yell' };
const CUT_DIVE = { torso: -22, head: 14, legF: [34, -3], legB: [-20, -100], armF: [160, 20], armB: [-140, -20], footF: -35, ...FISTS, face: 'yell' };

const animations = {
  // Puff Pass: winds her arm back and flings the vape forward, spinning.
  puffPass: anim(false, [
    [5, { torso: -8, armF: [-70, 70], armB: [30, 40], legF: [14, -10], legB: [-10, -6], handF: 'fist' }],
    [5, { torso: -14, head: -4, armF: [-125, 60], armB: [50, 30], legF: [20, -14], legB: [-14, -6], handF: 'fist' }],
    [3, { torso: 10, armF: [60, 10], armB: [-30, 40], legF: [26, -20], legB: [-18, -4], handF: 'fist', face: 'yell' }],
    [10, { torso: 18, armF: [100, 5], armB: [-40, 40], legF: [28, -22], legB: [-20, -4], handF: 'open', face: 'yell' }],
    [14, { torso: 8, armF: [60, 20], armB: [-20, 30], legF: [12, -8], legB: [-8, -4] }],
    [1, STAND],
  ]),
  // Roll Out: drops into a skating crouch, sprints forward, then swings an
  // uppercut at the end of the stride.
  rollOut: anim(false, [
    [8, { hip: [-1, 4], torso: -10, armF: [-60, 80], armB: [20, 60], legF: [40, -70], legB: [-10, -40], ...FISTS }],
    [8, { hip: [-1, 3], torso: 20, head: -10, armF: [-80, 100], armB: [40, 70], legF: [55, -95], legB: [-30, -20], ...FISTS, face: 'yell' }],
    [10, DASH],
    [10, { ...DASH, legF: [-30, -20], legB: [58, -80], footF: -30, footB: 0, armF: [-40, 100], armB: [70, 40] }],
    [6, { hip: [0, 1], torso: -12, head: -8, armF: [165, 10], armB: [-30, 50], legF: [20, -20], legB: [-20, -6], ...FISTS, face: 'yell' }],
    [12, { torso: -4, armF: [120, 30], armB: [-20, 40], legF: [14, -12], legB: [-12, -6] }],
    [2, STAND],
  ]),
  // Half Pipe: springs up into a tucked forward flip, then straightens out
  // to come down skates first.
  halfPipe: anim(false, [
    [3, { hip: [0, 6], torso: 16, armF: [30, 60], armB: [-20, 50], legF: [50, -95], legB: [30, -80] }],
    [8, { ...FLIP_TUCK, rot: 50 }],
    [20, { ...FLIP_TUCK, rot: 320 }],
    [6, { ...BOMB_DROP, rot: 360 }],
    [12, { ...BOMB_DROP, rot: 360 }],
    [1, { ...BOMB_DROP, rot: 360 }],
  ]),
  // the kick out of the flip: leaning back, one skate driven down and forward
  halfPipeKick: anim(false, [
    [3, { torso: -18, head: 6, armF: [-70, 40], armB: [-120, 30], legF: [95, -60], legB: [40, -100], ...FISTS, face: 'yell' }],
    [16, FLIP_KICK],
    [8, { ...FLIP_KICK, torso: -16 }],
    [8, { torso: 4, armF: [60, 30], armB: [-40, 30], legF: [30, -30], legB: [-10, -40] }],
  ]),
  // Kickflip: a rising backflip with one skate leading, then a dive with
  // that skate pointed at the floor.
  kickflip: anim(false, [
    [6, { hip: [0, 6], torso: 14, armF: [40, 60], armB: [-20, 50], legF: [50, -95], legB: [30, -80], ...FISTS }],
    [10, { ...CUT_KICK, rot: -20 }],
    [14, { ...CUT_KICK, rot: -190 }],
    [40, { ...CUT_DIVE, rot: -360 }],
    [1, { ...CUT_DIVE, rot: -360 }],
  ]),
  kickflipLand: anim(false, [
    [3, { hip: [0, 8], torso: 24, head: -10, armF: [60, 40], armB: [-60, 30], legF: [75, -120], legB: [40, -100], ...FISTS, face: 'yell' }],
    [10, { hip: [0, 7], torso: 20, armF: [50, 40], armB: [-50, 30], legF: [70, -115], legB: [40, -100] }],
    [14, { hip: [0, 3], torso: 8, armF: [30, 30], armB: [-30, 20], legF: [30, -50], legB: [14, -40] }],
    [2, STAND],
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
const SKATES = { foot: 'skate' };   // body parts swapped while the move is out
const FOREVER = 9999;

const moves = {
  // Neutral special: Puff Pass. Throws her vape like a boomerang: it flies
  // out, slows, and comes back to her hand. It can hit on the way out and
  // again on the way back. One at a time.
  puffPass: { faf: 38, limit: 1, spawn: { frame: 13, from: 'fistF', projectile: 'vape' }, hitboxes: [] },

  // Side special: Roll Out. A fast skating dash; if it connects she stops
  // and uppercuts them straight up. Stays on the floor when used there.
  // Once per jump in the air.
  rollOut: { faf: 56, landLag: 14, wear: SKATES, once: true, float: { gravity: 20, fall: 25 }, noDrift: true,
    rocket: { frame: 16, frames: 20, speed: [px(4.3), px(4.3)], lift: 0, gravity: 30, drag: 14, bounce: [px(0.5), px(1.0)], ground: true },
    trail: { part: 'fistF', from: 16, to: 40, width: 7 },
    hitboxes: [
      ...hits(16, 36, [['fistF', 7], ['chest', 6]], 11, 88, 78, 72),
      ...hits(37, 41, [['fistF', 8], ['elbowF', 6]], 11, 88, 78, 72),
    ] },

  // Down special: Half Pipe. A high flipping leap forward; she cannot be hit
  // for the first few frames. Coming down she stomps skates first (8%: it
  // spikes in the air, and just pops grounded fighters up). Press K or J
  // during the flip to kick out of it instead (14%, launches hard, and she
  // springs back off the hit). Once per jump in the air.
  halfPipe: { faf: 52, landLag: 10, wear: SKATES, once: true, intangible: 12,
    rocket: { frame: 3, frames: 46, speed: [px(2.4), px(2.4)], lift: px(4.6), gravity: 100, drag: 0, bounce: [px(1.0), px(3.0)] },
    followUp: { from: 10, to: 40, move: 'halfPipeKick' },
    hitboxes: hits(30, 48, [['footF', 7], ['footB', 7]], 8, 270, 30, 70) },
  halfPipeKick: { faf: 34, landLag: 12, wear: SKATES,
    rocket: { frame: 3, frames: 24, speed: [px(3.2), px(3.2)], lift: -px(2.6), gravity: 60, drag: 0, bounce: [px(1.6), px(3.4)] },
    trail: { part: 'toeF', from: 3, to: 20, width: 9, arc: true },
    hitboxes: hits(4, 22, [['toeF', 9], ['shinF', 7]], 14, 42, 45, 95) },

  // Up special: Kickflip. Flips upward with a skate leading (carrying anyone
  // it hits), then dives. Steerable the whole way, grabs ledges on the way
  // up and down, and sends a shockwave along the floor when she lands.
  // If the dive finds no floor she ends up falling helpless.
  kickflip: { faf: 70, landLag: 16, helpless: true, wear: SKATES, float: { gravity: 15, fall: 20 },
    plunge: { frame: 6, fallAt: 32, rise: px(4.5), hopX: px(0.5), drift: px(1.5), steer: px(0.14), fall: px(5.0), landMove: 'kickflipLand' },
    ledgeGrab: { from: 6, rising: true },
    trail: { part: 'toeF', from: 6, to: 70, width: 7, arc: true },
    hitboxes: [
      ...hits(6, 31, [['toeF', 7], ['shinF', 6]], 5, 90, 0, 100, { fkb: 95, group: 0 }),
      ...hits(32, 70, [['toeF', 7], ['shinF', 6]], 5, 270, 30, 60, { group: 1 }),
    ] },
  kickflipLand: { faf: 30, wear: SKATES, spawn: { frame: 2, from: 'toeF', projectile: 'shockwave' }, hitboxes: [
    hit(1, 3, 'toeF', 7, 3, 80, 40, 50),
  ] },
};

export const KAELYN = {
  ...SIMEON,
  id: 'kaelyn',
  name: 'KAELYN',
  heightInches: 70,
  stats,
  parts,
  palettes,
  trailColors: ['#2f7bff', '#8fd0ff', '#ffffff'],   // her hits and swipes are blue
  animations: { ...SIMEON.animations, ...animations },
  moves: { ...SIMEON.moves, ...moves },
  specials: { neutral: 'puffPass', side: 'rollOut', up: 'kickflip', down: 'halfPipe' },
  projectiles: {
    // the vape: flies out about 125px, then comes back
    vape: {
      type: 'boomerang', draw: 'vape', r: 3, hitPad: 2,
      speed: [px(5.0), 0], chargeSpeed: [0, 0],
      accel: px(0.1), homing: px(1.2), catchX: 10, catchY: 26, spinRate: 46, rehit: 24,
      life: 170, fadeFrames: 10,
      hit: { damage: 70, angle: 361, bkb: 30, kbg: 60 },       // 7% each time it hits
    },
    // floor shockwave from landing a Kickflip
    shockwave: {
      type: 'wave', draw: 'wave', r: 5, hitPad: 1,
      speed: [px(3.2), 0], chargeSpeed: [0, 0],
      life: 26, fadeFrames: 4,
      hit: { damage: 60, angle: 70, bkb: 40, kbg: 60 },        // 6%
    },
  },
};
