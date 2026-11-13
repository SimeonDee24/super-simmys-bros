// SIMEON — all-rounder. This whole character is data: stats, body parts,
// palettes and poses. The engine never mentions him by name.
import { px } from '../engine/fixed.js';
import { anim } from '../engine/skeleton.js';

// ---------------------------------------------------------------------------
// Stats. Speeds are pixels per frame, accelerations pixels per frame^2.
// Based on a mid-weight all-rounder; roughly 1.75 px per Smash unit.
// ---------------------------------------------------------------------------
const stats = {
  weight: 98,

  // Ground
  walkSpeed: px(2.0),
  walkAccel: px(0.25),
  dashSpeed: px(3.1),      // initial dash burst
  dashFrames: 11,          // length of the initial dash
  runSpeed: px(2.8),
  runAccel: px(0.2),
  traction: px(0.18),      // ground friction
  brakeFrames: 10,         // skid length after letting go of run
  turnFrames: 10,          // run-turnaround length
  turnTraction: px(0.3),
  turnExitSpeed: px(1.6),  // speed when the turnaround goes back into a run

  // Jumps
  jumpSquat: 3,            // frames on the ground before leaving it
  jumpVel: px(4.05),       // full hop  (about 55 px high)
  shortHopVel: px(3.06),   // short hop (about 31 px high)
  doubleJumpVel: px(4.2),
  doubleJumpH: px(1.6),    // sideways speed when double jumping with a direction held
  doubleJumpAnimFrames: 18,
  jumpMaxH: px(2.9),       // sideways speed kept when jumping out of a run
  airJumps: 1,

  // Air
  gravity: px(0.152),
  fallSpeed: px(2.63),
  fastFallSpeed: px(4.2),
  airSpeed: px(2.7),
  airAccel: px(0.22),
  airFriction: px(0.026),

  // Ledge
  ledgeHang: px(44),       // how far the feet hang below the ledge
  ledgeMinHang: 8,         // frames before a ledge option can be chosen
  ledgeGetupFrames: 22,
  ledgeJumpVel: px(4.3),
  ledgeJumpH: px(1.2),

  // Landing
  softLandLag: 2,
  hardLandLag: 4,          // after a fast fall

  // Collision box against the stage (centred on x, from the feet upward)
  ecbHalfW: px(5),
  ecbHeight: px(38),
};

// ---------------------------------------------------------------------------
// Skeleton, in pixels. Height rule: 70 inches x 0.6 = 42 px.
//   feet 2 + lower leg 9 + upper leg 10 = hip at 21, torso 13, head 6, hair 2
// ---------------------------------------------------------------------------
const skeleton = {
  hipY: 21, torso: 13, shoulderDrop: 2, shoulderOff: 1, hipOff: 1,
  upperArm: 6, lowerArm: 5, upperLeg: 10, lowerLeg: 9,
  headRadius: 4, torsoRadius: 3, armRadius: 2, legRadius: 2,
};

// ---------------------------------------------------------------------------
// Body parts, drawn facing right. Each letter is a palette colour, '.' is empty.
// pivot = [column, row] the part rotates around (may sit outside the grid).
// ---------------------------------------------------------------------------
const HAIR = ['..hhHh..', '.hHhhhHh', 'hhhHhhhh', 'hhhhhhh.', 'hh......'];
const head = (eyes, cheeks, mouth) => ({
  pivot: [2, 6],
  px: ['.kkkk.', 'kkkkkl', eyes, cheeks, mouth, '.Kkkk.'],
});
const parts = {
  head_neutral: head('Kkkeke', 'Kkkkkl', 'Kkkrrk'),
  head_smile:   head('Kkkeke', 'Kkkkkl', 'Kkkmmk'),
  head_yell:    head('Kkkeke', 'Kkkrrk', 'Kkkrrk'),
  head_hurt:    head('KkkKkK', 'Kkkkkl', 'Kkkkrk'),
  hair: { pivot: [3, 8], px: HAIR },
  torso: {
    pivot: [3, 13],
    px: [
      '...kk..',
      '.ttkkt.',
      'tttcctu',
      'Ttttttu',
      'Ttttttu',
      'Ttttttt',
      'Tttttt.',
      '.Ttttt.',
      '.Ttttt.',
      '.Ttttu.',
      '.Ttttu.',
      '.Ttttt.',
      '.Jjjji.',
      '.Jjjji.',
    ],
  },
  upperArm: { pivot: [1, 0], px: ['Ttu', 'Ttu', 'Ttt', 'Kkl', 'Kkl', 'Kkl', 'Kkl'] },
  lowerArm: { pivot: [1, 0], px: ['Kkl', 'Kkl', 'Kkl', 'Kkl', 'Kkl', 'Kkl'] },
  hand_open: { pivot: [1, 0], px: ['kkl', 'kkl', '.k.'] },
  hand_fist: { pivot: [1, 0], px: ['kkkl', 'kkkl', 'Kkk.'] },
  upperLeg: { pivot: [1, 0], px: ['Jjji', 'Jjji', 'Jjji', 'Jjji', 'Jjji', 'Jjji', 'Jjji', 'Jjji', 'Jjji', 'Jjji', 'Jjj.'] },
  lowerLeg: { pivot: [1, 0], px: ['Jji', 'Jji', 'Jji', 'Jji', 'Jji', 'Jji', 'Jji', 'Jji', 'Jji', 'Jjj'] },
  foot: { pivot: [1, 1], px: ['www...', 'wwwww.', 'WwwwwW'] },
};

// ---------------------------------------------------------------------------
// Palettes. Hair and skin are shared; alts change the shirt and jeans.
// Letters: t/T/u shirt (base/shadow/light), j/J/i jeans (base/shadow/light).
// ---------------------------------------------------------------------------
const BASE_COLORS = {
  k: '#ecba8e', K: '#c98f68', l: '#f8d5ae',   // skin
  h: '#231813', H: '#42302a',                 // hair
  w: '#f6f6f2', W: '#bfc5d0',                 // sneakers
  c: '#dfe4ee',                               // chain
  e: '#1b1310', m: '#ffffff', r: '#8c3a36',   // eyes, teeth, mouth
};
const alt = (name, shirt, jeans) => ({
  name,
  colors: { ...BASE_COLORS, t: shirt[0], T: shirt[1], u: shirt[2], j: jeans[0], J: jeans[1], i: jeans[2] },
});
const BLUE_JEANS = ['#3f6fb8', '#2c5190', '#5b8cd4'];
const DARK_JEANS = ['#2c2f44', '#1d1f30', '#3e425c'];
const palettes = [
  alt('Classic', ['#2d2d37', '#1d1d26', '#41414e'], BLUE_JEANS),
  alt('Red',     ['#cc363c', '#962330', '#e8625b'], DARK_JEANS),
  alt('White',   ['#eceef2', '#b9bfcc', '#ffffff'], BLUE_JEANS),
  alt('Forest',  ['#3f8f55', '#2b6a41', '#5fb873'], ['#b89f72', '#8d7752', '#d3bd91']),
  alt('Royal',   ['#3d5fd0', '#2a419c', '#6485ea'], ['#26262e', '#18181f', '#383842']),
  alt('Gold',    ['#e7b53a', '#b78324', '#f8d66a'], ['#6f7686', '#4f5564', '#8c93a3']),
  alt('Violet',  ['#8b4fc4', '#643795', '#ab77de'], ['#9db9dc', '#7693bd', '#bcd3ee']),
];
const outline = '#100d16';

// ---------------------------------------------------------------------------
// Animations: anim(loops, [[frames, pose], ...]). See engine/skeleton.js for
// the pose format. Angles are degrees.
// ---------------------------------------------------------------------------
const WALK_A = { hip: [0, 1], torso: 4, armF: [-22, 12], armB: [24, 16], legF: [26, -6], legB: [-22, -14], face: 'smile' };
const WALK_B = { hip: [0, 0], torso: 4, armF: [-4, 10], armB: [6, 12], legF: [4, -4], legB: [10, -48], face: 'smile' };
const WALK_C = { hip: [0, 1], torso: 4, armF: [24, 16], armB: [-22, 12], legF: [-22, -14], legB: [26, -6], face: 'smile' };
const WALK_D = { hip: [0, 0], torso: 4, armF: [6, 12], armB: [-4, 10], legF: [10, -48], legB: [4, -4], face: 'smile' };

const RUN_A = { hip: [1, 2], torso: 20, head: 8, armF: [-55, 75], armB: [50, 85], legF: [55, -25], legB: [-35, -65], footB: 40, handF: 'fist', handB: 'fist' };
const RUN_B = { hip: [1, 1], torso: 20, head: 8, armF: [-10, 80], armB: [10, 85], legF: [12, -20], legB: [25, -100], footB: 30, handF: 'fist', handB: 'fist' };
const RUN_C = { hip: [1, 2], torso: 20, head: 8, armF: [50, 85], armB: [-55, 75], legF: [-35, -65], legB: [55, -25], footF: 40, handF: 'fist', handB: 'fist' };
const RUN_D = { hip: [1, 1], torso: 20, head: 8, armF: [10, 85], armB: [-10, 80], legF: [25, -100], legB: [12, -20], footF: 30, handF: 'fist', handB: 'fist' };

const animations = {
  idle: anim(true, [
    [34, { torso: 2, armF: [4, 10], armB: [-6, 8], legF: [5, -4], legB: [-6, -2], face: 'smile' }],
    [34, { hip: [0, 1], torso: 3, armF: [7, 16], armB: [-8, 12], legF: [18, -30], legB: [-4, -26], face: 'smile' }],
  ], { ease: true }),
  walk: anim(true, [[5, WALK_A], [5, WALK_B], [5, WALK_C], [5, WALK_D]]),
  run: anim(true, [[5, RUN_A], [5, RUN_B], [5, RUN_C], [5, RUN_D]]),
  brake: anim(false, [
    [4, { hip: [-1, 2], torso: -6, armF: [30, 30], armB: [-30, 20], legF: [35, -8], legB: [-12, -30] }],
    [6, { hip: [-2, 3], torso: -14, armF: [45, 35], armB: [-40, 25], legF: [42, -6], legB: [-5, -50] }],
  ]),
  crouch: anim(false, [
    [3, { hip: [0, 3], torso: 10, armF: [8, 20], armB: [-6, 16], legF: [30, -55], legB: [10, -45] }],
    [1, { hip: [-1, 9], torso: 28, head: 10, armF: [20, 60], armB: [5, 55], legF: [62, -118], legB: [48, -108] }],
  ]),
  jumpsquat: anim(false, [
    [2, { hip: [0, 2], torso: 8, armF: [-15, 15], armB: [-25, 10], legF: [25, -45], legB: [5, -35] }],
    [1, { hip: [0, 6], torso: 16, armF: [-35, 20], armB: [-45, 15], legF: [48, -90], legB: [30, -80] }],
  ]),
  jump: anim(false, [
    [3, { hip: [0, 1], torso: 2, armF: [120, 30], armB: [-100, -20], legF: [8, -8], legB: [-12, -6], footF: 30, footB: 35 }],
    [10, { torso: 4, armF: [50, 50], armB: [-45, 25], legF: [35, -60], legB: [-12, -25], footF: 20, footB: 35 }],
  ]),
  djump: anim(false, [
    [4, { hip: [0, -2], torso: 22, head: 10, armF: [35, 95], armB: [15, 100], legF: [85, -120], legB: [65, -110], handF: 'fist', handB: 'fist' }],
    [8, { hip: [0, -2], torso: 14, head: 6, armF: [20, 80], armB: [-10, 70], legF: [70, -100], legB: [45, -90], handF: 'fist', handB: 'fist' }],
    [6, { torso: 4, armF: [50, 50], armB: [-45, 25], legF: [35, -60], legB: [-12, -25], footF: 20, footB: 35 }],
  ]),
  fall: anim(true, [
    [10, { torso: 6, armF: [75, 20], armB: [-80, 15], legF: [18, -28], legB: [-14, -18], footF: 25, footB: 35 }],
    [10, { torso: 6, armF: [85, 25], armB: [-90, 20], legF: [22, -34], legB: [-10, -24], footF: 25, footB: 35 }],
  ], { ease: true }),
  ledge: anim(true, [
    [30, { torso: 4, armF: [163, 8], armB: [168, 6], legF: [10, -15], legB: [-2, -10], footF: 25, footB: 30 }],
    [30, { torso: 6, armF: [163, 8], armB: [168, 6], legF: [14, -22], legB: [2, -16], footF: 25, footB: 30 }],
  ], { ease: true }),
  ledgeGetup: anim(false, [
    [8, { torso: 4, armF: [163, 8], armB: [168, 6], legF: [10, -15], legB: [-2, -10], footF: 25 }],
    [7, { torso: 30, armF: [60, 60], armB: [50, 70], legF: [70, -100], legB: [20, -40] }],
    [7, { hip: [0, 6], torso: 24, armF: [20, 40], armB: [5, 40], legF: [50, -95], legB: [32, -82] }],
    [1, { torso: 3, armF: [6, 12], armB: [-6, 10], legF: [6, -6], legB: [-5, -4] }],
  ]),
  land: anim(false, [
    [2, { hip: [0, 5], torso: 14, armF: [25, 30], armB: [-30, 20], legF: [45, -85], legB: [28, -75] }],
    [4, { hip: [0, 1], torso: 4, armF: [8, 14], armB: [-8, 10], legF: [14, -22], legB: [-2, -18] }],
  ]),
};

export const SIMEON = {
  id: 'simeon',
  name: 'SIMEON',
  heightInches: 70,
  stats,
  skeleton,
  parts,
  palettes,
  outline,
  animations,
  defaultFace: 'smile',
  // moves: {}  <- milestone 2 adds attacks here (frame data + hitboxes per frame)
};
