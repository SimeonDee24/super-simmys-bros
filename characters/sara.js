// SARA — runs a coffee shop, plays every sport going and is always just back
// from a trip. She shares every normal attack, grab and throw with Simeon
// (same skeleton, same animations); her look, a few stats, her smash attacks
// and her four specials are her own.
import { px } from '../engine/fixed.js';
import { anim } from '../engine/skeleton.js';
import { SIMEON } from './simeon.js';

const stats = {
  ...SIMEON.stats,
  weight: 95,                 // a touch lighter than Simeon
  runSpeed: px(2.9),
  airSpeed: px(2.75),
};

// ---------------------------------------------------------------------------
// Body parts: pixel art at 2 art pixels per world pixel, facing right.
// Dark hair pulled back into a low ponytail, a black long-sleeved team
// shirt (or her shop apron in the second skin).
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
// Dark hair pulled straight back off her forehead into a low ponytail, tied
// at the nape (S) and hanging halfway down her back.
// (hair column = head column + 5, row = head row + 4)
const HAIR = [
  '',
  '',
  '.........hhhhh',
  '.......hhhnhhhhh',
  '......hhhHhhnhhhh',
  '.....hhhHhhhnhh',
  '....hhhHhhhhh',
  '....hhHhhhh',
  '....hhHhhh',
  '....hhHhh',
  '....hhHh',
  '...hhHhh',
  '..ShHhh',
  '..ShHh',
  '.hhHhh',
  '.hhHh',
  '.hHhh',
  '.hHhh',
  '.hhHh',
  '.hHhh',
  '.hhHh',
  '.hHhh',
  'hhHhh',
  'hhhHh',
  'hhHhh',
  'hhhHh',
  '.hHhh',
  '.hhHh',
  '.hhh',
  '..h',
].map((r) => r.padEnd(18, '.'));
const rows = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));
const parts = {
  ...SIMEON.parts,   // hands, legs and sneakers are shared
  head_neutral: face(),
  head_smile: face([10, 9, 'ppp']),
  head_yell: face([4, 9, 'kbb'], [10, 9, 'krr'], [11, 9, 'rr']),
  head_hurt: face([5, 9, 'kkkk'], [6, 9, 'eee'], [10, 10, 'rr']),
  hair: { pivot: [10, 18], px: HAIR },
  // long-sleeved top with lettering across the chest (d). The apron (a / A)
  // only shows in the skins that colour it differently from the top.
  torso: {
    pivot: [6, 26],
    px: [
      '.....kkkk.....',
      '.....KkkkK....',
      '....uAKkkAu...',
      '...TTAtttAtu..',
      '..TTtAaaaAtuu.',
      '.TTttAaaaaatu.',
      '.TTtAaaaaaatu.',
      '.TTtAaaaaaatu.',
      '.TTtAdddadatu.',
      '.TTxAaaaaaauu.',
      '.TTtAddadddtu.',
      '..TtAaaaaaau..',
      '..TtAaddddau..',
      '..TxAaaaaaau..',
      '..TtAaaDDaau..',
      '..TtAaaaaaau..',
      '..TtAaaaaaau..',
      '..TAAaaaaaAA..',
      '..AAAaaaaaaA..',
      '.TAAaaaaaaaa..',
      '.TAAaaaaaaaaa.',
      '.xAAaaaaaaaaa.',
      '.JAAaaaaaaaai.',
      '.JJAAaaaaaaii.',
      '.JJjAAAAAAjii.',
      '.JJjjjjjjjjii.',
      '.JJjjjjjjjjii.',
      '..JJjjjjjjii..',
    ],
  },
  // long sleeves, with a cuff at the wrist
  upperArm: { pivot: [2, 0], px: rows(13, (i) => (i === 12 ? '.Ttt.' : i === 6 ? 'TTxtu' : 'TTttu')) },
  lowerArm: { pivot: [2, 0], px: rows(11, (i) => (i >= 9 ? '.xTx.' : i === 4 ? 'TTxtu' : i > 6 ? '.Tttu' : 'TTttu')) },
};

const darker = (hex, k) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('');
const BASE_COLORS = {
  ...SIMEON.palettes[0].colors,
  k: '#ecc4a4', K: '#cf9c7c', l: '#f8dcc4', q: '#b47e62', o: '#e59a86', p: '#cb7880',   // lightly tanned skin, rosy cheeks, lips
  h: '#1d1512', H: '#2e221c', n: '#4d3a30', b: '#2a1c16',                               // very dark brown hair, brows
  g: '#ff7a59',
};
const alt = (name, tee, apron, jeans, scrunchie, extra = {}) => ({
  name,
  colors: { ...BASE_COLORS, t: tee[0], T: tee[1], u: tee[2], x: darker(tee[1], 0.85), a: apron, A: darker(apron, 0.72), j: jeans[0], J: jeans[1], i: jeans[2], y: darker(jeans[1], 0.78), S: scrunchie, ...extra },
});
const palettes = [
  // black long-sleeved team shirt with white lettering, grey joggers
  alt('Game Day', ['#2a2a32', '#1b1b22', '#3d3d48'], '#2a2a32', ['#9aa0ad', '#787e8c', '#b9bfca'], '#1b1b22', { A: '#2a2a32', d: '#f6f6f2', D: '#f6f6f2', g: '#f6f6f2' }),
  // at the shop: cream top under a terracotta apron, jeans
  alt('House Blend', ['#f1ebdd', '#cfc7b4', '#fffaf0'], '#b5533c', ['#3f6fb8', '#2c5190', '#5b8cd4'], '#ffd23a', { d: '#fff3df', D: '#8a5a36' }),
];

// ---------------------------------------------------------------------------
// Poses and animations for her smash attacks and specials.
// ---------------------------------------------------------------------------
const FISTS = { handF: 'fist', handB: 'fist' };
const STAND = { torso: 2, armF: [4, 10], armB: [-6, 8], legF: [5, -4], legB: [-6, -2] };
const AIR = { torso: 6, armF: [75, 20], armB: [-80, 15], legF: [18, -28], legB: [-14, -18], footF: 25, footB: 35 };
const THROW_BACK = { torso: -14, head: -4, armF: [-120, 60], armB: [50, 30], legF: [20, -14], legB: [-14, -6], handF: 'fist' };
const THROW_OUT = { torso: 16, armF: [98, 5], armB: [-40, 40], legF: [28, -22], legB: [-20, -4], handF: 'open', face: 'yell' };
// kneeling on her suitcase as it rolls, one arm pointing the way
const RIDE = { hip: [0, 6], torso: 14, head: -10, armF: [96, 4], armB: [-30, 70], legF: [78, -150], legB: [58, -140], footF: 40, footB: 40, handF: 'open', face: 'yell' };
// hanging from a paper plane held overhead
const GLIDE = { torso: -8, head: -14, armF: [168, 4], armB: [150, 20], legF: [12, -22], legB: [-12, -34], footF: 30, footB: 40, ...FISTS, face: 'smile' };

const animations = {
  // To-Go: winds up and flings a coffee cup. The same throw, held a little
  // longer and thrown harder, for the Double Shot.
  toGo: anim(false, [
    [5, { torso: -8, armF: [-70, 70], armB: [30, 40], legF: [14, -10], legB: [-10, -6], handF: 'fist' }],
    [5, THROW_BACK],
    [3, THROW_BACK],
    [3, { torso: 10, armF: [60, 10], armB: [-30, 40], legF: [26, -20], legB: [-18, -4], handF: 'fist', face: 'yell' }],
    [10, THROW_OUT],
    [12, { torso: 8, armF: [60, 20], armB: [-20, 30], legF: [12, -8], legB: [-8, -4] }],
    [1, STAND],
  ]),
  doubleShot: anim(false, [
    [5, { torso: -8, armF: [-70, 70], armB: [30, 40], legF: [14, -10], legB: [-10, -6], handF: 'fist' }],
    [5, THROW_BACK],
    [7, { ...THROW_BACK, hip: [-1, 2], torso: -24, armF: [-150, 50], legF: [26, -24] }],
    [3, { torso: 14, armF: [60, 10], armB: [-30, 40], legF: [30, -24], legB: [-20, -4], handF: 'fist', face: 'yell' }],
    [12, { ...THROW_OUT, hip: [1, 2], torso: 26, legF: [36, -34] }],
    [14, { torso: 8, armF: [60, 20], armB: [-20, 30], legF: [12, -8], legB: [-8, -4] }],
    [1, STAND],
  ]),
  // Boarding Call: hops onto her rolling suitcase and rides it forward.
  boardingCall: anim(false, [
    [6, { hip: [0, 3], torso: 10, armF: [30, 30], armB: [-20, 40], legF: [30, -50], legB: [-10, -30] }],
    [6, { ...RIDE, torso: 4, armF: [40, 40], face: 'smile' }],
    [24, RIDE],
    [6, { hip: [0, 3], torso: 4, armF: [120, 20], armB: [-60, 30], legF: [50, -80], legB: [10, -60], handF: 'open' }],
    [10, { torso: 4, armF: [60, 30], armB: [-30, 30], legF: [14, -12], legB: [-12, -6] }],
    [2, STAND],
  ]),
  // Takeoff: a quick crouch, then she is carried up under a paper plane.
  takeoff: anim(false, [
    [4, { hip: [0, 6], torso: 14, armF: [60, 60], armB: [40, 70], legF: [50, -95], legB: [30, -80], ...FISTS }],
    [4, { ...GLIDE, legF: [30, -50], legB: [10, -50] }],
    [16, GLIDE],
    [16, { ...GLIDE, torso: -2, legF: [20, -30], legB: [-4, -40] }],
    [8, { ...GLIDE, armF: [150, 20], armB: [120, 40], face: 'neutral' }],
    [4, AIR],
  ]),
  // Fresh Pot: lifts the coffee pot high, then swings it down and pours it
  // out across the floor.
  freshPot: anim(false, [
    [5, { torso: -4, armF: [100, 30], armB: [-30, 40], legF: [12, -10], legB: [-10, -6], handF: 'fist' }],
    [6, { hip: [0, -1], torso: -12, head: -8, armF: [170, 14], armB: [-50, 30], legF: [10, -6], legB: [-10, -4], handF: 'fist' }],
    [3, { hip: [0, -1], torso: -14, head: -8, armF: [176, 14], armB: [-50, 30], legF: [10, -6], legB: [-10, -4], handF: 'fist', face: 'yell' }],
    [3, { hip: [1, 3], torso: 22, armF: [70, 4], armB: [-60, 40], legF: [34, -36], legB: [-22, -8], handF: 'fist', face: 'yell' }],
    [10, { hip: [1, 5], torso: 34, head: -8, armF: [44, 2], armB: [-60, 40], legF: [40, -50], legB: [-26, -10], handF: 'fist', face: 'yell' }],
    [12, { hip: [0, 2], torso: 14, armF: [50, 20], armB: [-30, 30], legF: [20, -18], legB: [-14, -6] }],
    [4, STAND],
  ]),
  // --- Smash attacks ---
  // Match Point: a full tennis forehand, racket taken right back and swung through.
  fsmash: anim(false, [
    [6, { torso: -6, armF: [-40, 40], armB: [40, 50], legF: [14, -10], legB: [-12, -6], ...FISTS }],
    [6, { hip: [-1, 1], torso: -20, head: 6, armF: [-125, 35], armB: [70, 40], legF: [22, -18], legB: [-16, -6], ...FISTS }],
    [3, { hip: [-1, 1], torso: -24, head: 8, armF: [-135, 35], armB: [74, 40], legF: [22, -18], legB: [-16, -6], ...FISTS, face: 'yell' }],
    [2, { hip: [1, 1], torso: 6, armF: [30, 10], armB: [-20, 40], legF: [30, -24], legB: [-20, -4], ...FISTS, face: 'yell' }],
    [3, { hip: [2, 2], torso: 22, head: -6, armF: [112, 4], armB: [-40, 40], legF: [38, -34], legB: [-26, -4], ...FISTS, face: 'yell' }],
    [8, { hip: [2, 2], torso: 28, head: -8, armF: [190, 50], armB: [-50, 40], legF: [40, -38], legB: [-28, -4], ...FISTS, face: 'yell' }],
    [14, { hip: [0, 1], torso: 12, armF: [120, 60], armB: [-20, 40], legF: [22, -20], legB: [-16, -4], ...FISTS }],
    [8, STAND],
  ]),
  // Steam Wand: dips with the milk pitcher, then thrusts it up as it blasts steam.
  usmash: anim(false, [
    [4, { torso: 8, armF: [30, 30], armB: [-30, 40], legF: [12, -10], legB: [-10, -6], handF: 'fist' }],
    [4, { hip: [0, 3], torso: 14, armF: [10, 60], armB: [-40, 50], legF: [22, -26], legB: [-12, -14], handF: 'fist' }],
    [2, { hip: [0, 3], torso: 14, armF: [8, 60], armB: [-40, 50], legF: [22, -26], legB: [-12, -14], handF: 'fist' }],
    [3, { hip: [0, -1], torso: -8, head: -14, armF: [176, 2], armB: [-50, 30], legF: [8, -4], legB: [-8, -4], handF: 'fist', face: 'yell' }],
    [12, { hip: [0, -1], torso: -8, head: -14, armF: [178, 0], armB: [-50, 30], legF: [8, -4], legB: [-8, -4], handF: 'fist', face: 'yell' }],
    [12, { torso: 2, armF: [90, 40], armB: [-20, 30], legF: [8, -6], legB: [-8, -4], handF: 'fist' }],
    [8, STAND],
  ]),
  // Baggage Claim: crouches and swings her suitcase low in front, then round behind her.
  dsmash: anim(false, [
    [5, { hip: [0, 2], torso: 10, armF: [-30, 20], armB: [-40, 50], legF: [20, -24], legB: [-12, -14], handF: 'fist' }],
    [5, { hip: [0, 5], torso: 18, armF: [-62, 20], armB: [-40, 50], legF: [30, -44], legB: [-16, -22], handF: 'fist' }],
    [2, { hip: [0, 5], torso: 18, armF: [-66, 20], armB: [-40, 50], legF: [30, -44], legB: [-16, -22], handF: 'fist', face: 'yell' }],
    [4, { hip: [0, 6], torso: 26, head: -8, armF: [64, 4], armB: [-60, 40], legF: [34, -50], legB: [-24, -20], handF: 'fist', face: 'yell' }],
    [3, { hip: [0, 6], torso: 8, armF: [4, 2], armB: [-30, 40], legF: [30, -48], legB: [-26, -22], handF: 'fist', face: 'yell' }],
    [5, { hip: [0, 6], torso: -14, head: 8, armF: [-72, -4], armB: [60, 40], legF: [26, -44], legB: [-30, -26], handF: 'fist', face: 'yell' }],
    [14, { hip: [0, 3], torso: 6, armF: [-20, 20], armB: [20, 40], legF: [18, -20], legB: [-14, -12], handF: 'fist' }],
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
  // Neutral special: To-Go. Tap to fling a coffee cup straight ahead (6%).
  // Hold a moment longer for a Double Shot: a bigger, faster cup (12%).
  toGo: { faf: 38, charge: { at: 10, max: 14 }, variant: { minCharge: 9, move: 'doubleShot' },
    spawn: { frame: 14, from: 'fistF', projectile: 'cup' }, hitboxes: [] },
  doubleShot: { faf: 50, charge: { at: 10, max: 14 },
    spawn: { frame: 19, from: 'fistF', projectile: 'bigCup' }, hitboxes: [] },

  // Side special: Boarding Call. Hops onto her rolling suitcase and rides it
  // forward: 10%, and it carries on through shields' pushback like any dash.
  // Stays on the floor when used there. Once per jump in the air.
  boardingCall: { faf: 54, landLag: 14, once: true, noDrift: true, float: { gravity: 20, fall: 25 },
    gear: { kind: 'suitcaseRide', from: 6, to: 40 },
    rocket: { frame: 12, frames: 24, speed: [px(3.9), px(3.9)], lift: 0, gravity: 30, drag: 10, bounce: [px(0.8), px(1.6)], ground: true },
    ledgeGrab: { from: 26 },
    trail: { part: 'fistF', from: 12, to: 36, width: 7, straight: true },
    hitboxes: hits(12, 36, [['kneeF', 9], ['fistF', 6]], 10, 50, 50, 78) },

  // Up special: Takeoff. Carried up under a paper plane for half a second,
  // steering freely left and right. The plane's nose hits once (7%). She
  // falls helpless afterwards.
  takeoff: { faf: 52, landLag: 16, helpless: true,
    gear: { kind: 'plane', from: 4, to: 46 },
    fly: { frame: 8, frames: 30, rise: px(3.3), accel: px(0.6), drift: px(1.9), steer: px(0.14) },
    ledgeGrab: { from: 8, rising: true },
    hitboxes: [hit(8, 38, 'fistF', 8, 7, 80, 50, 70, { off: [3, -6] })] },

  // Down special: Fresh Pot. Swings the coffee pot down (8%) and pours a
  // wave of hot coffee along the floor (7%). In the air there is no floor to
  // pour on, so it is only the swing. One wave at a time.
  freshPot: { faf: 44, limit: 1, gear: { kind: 'pot', from: 0, to: 34 },
    spawn: { frame: 17, from: 'fistF', projectile: 'spill' },
    trail: { part: 'weaponMidF', from: 14, to: 18, width: 8, arc: true },
    hitboxes: hits(15, 18, [['weaponMidF', 8], ['fistF', 6]], 8, 60, 45, 70) },

  // --- Smash attacks (see simeon.js for how they are performed) ---
  // Forward: Match Point. A tennis forehand with the whole body behind it.
  // The racket head hits hardest. 16%.
  fsmash: { faf: 50, charge: { at: 12, max: 60, smash: true }, gear: { kind: 'racket', from: 0, to: 42 },
    trail: { part: 'weaponF', from: 15, to: 21, width: 10, arc: true }, hitboxes: [
      hit(16, 20, 'weaponF', 9, 16, 361, 34, 100, { chargeScale: [160, 224], lagMult: 150 }),
      ...hits(16, 20, [['weaponMidF', 7], ['fistF', 6]], 13, 361, 30, 92, { chargeScale: [130, 182], lagMult: 130 }),
    ] },
  // Up: Steam Wand. A column of steam from the milk pitcher: three small
  // hits that hold them in it, then a burst. 14% in all.
  usmash: { faf: 46, charge: { at: 8, max: 60, smash: true }, gear: { kind: 'pitcher', from: 0, to: 34, active: [11, 24] }, hitboxes: [
      ...[0, 1, 2].flatMap((i) => [[0, -6], [0, -19], [0, -31]].map((off, k) => hit(11 + i * 3, 13 + i * 3, 'fistF', k === 2 ? 7 : 8, 2.5, 100, 0, 100, { fkb: 18, group: i, off }))),
      ...[[0, -8], [0, -22], [0, -34]].map((off) => hit(21, 24, 'fistF', 9, 6.5, 88, 40, 105, { group: 3, off, chargeScale: [65, 120], lagMult: 150 })),
    ] },
  // Down: Baggage Claim. Swings her suitcase low in front, then round behind
  // her. 13% either side; the back swing launches a little less.
  dsmash: { faf: 50, charge: { at: 10, max: 60, smash: true }, gear: { kind: 'suitcase', from: 0, to: 40 },
    trail: { part: 'weaponMidF', from: 12, to: 24, width: 9, arc: true }, hitboxes: [
      ...hits(13, 16, [['weaponMidF', 10], ['fistF', 6]], 13, 32, 32, 96, { chargeScale: [130, 182], lagMult: 150, group: 0 }),
      ...hits(20, 24, [['weaponMidF', 10], ['fistF', 6]], 13, 32, 30, 88, { chargeScale: [130, 182], lagMult: 150, group: 1, dir: -1 }),
    ] },
};

export const SARA = {
  ...SIMEON,
  id: 'sara',
  name: 'SARA',
  lastName: 'DEE',
  heightInches: 70,
  stats,
  parts,
  palettes,
  trailColors: ['#8a5a36', '#e0a56a', '#fff3df'],   // coffee, caramel, cream
  animations: { ...SIMEON.animations, ...animations },
  moves: { ...SIMEON.moves, ...moves },
  specials: { neutral: 'toGo', side: 'boardingCall', up: 'takeoff', down: 'freshPot' },
  projectiles: {
    // a to-go cup, thrown flat
    cup: {
      type: 'dart', draw: 'cup', r: 4, hitPad: 2,
      speed: [px(4.2), px(0.5)], chargeSpeed: [0, 0],
      gravity: px(0.05), maxFall: px(4),
      life: 50, fadeFrames: 4,
      hit: { damage: 60, angle: 361, bkb: 25, kbg: 50 },       // 6%
    },
    // the Double Shot: a large one, thrown hard
    bigCup: {
      type: 'dart', draw: 'cup', r: 6, hitPad: 2,
      speed: [px(5.4), px(0.5)], chargeSpeed: [0, 0],
      gravity: px(0.04), maxFall: px(4),
      life: 60, fadeFrames: 4,
      hit: { damage: 120, angle: 361, bkb: 40, kbg: 80 },      // 12%
    },
    // hot coffee running along the floor
    spill: {
      type: 'wave', draw: 'wave', r: 5, hitPad: 1,
      speed: [px(2.7), 0], chargeSpeed: [0, 0],
      life: 34, fadeFrames: 4,
      hit: { damage: 70, angle: 75, bkb: 40, kbg: 60 },        // 7%
    },
  },
};
