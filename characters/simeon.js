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
  walkAccel: px(0.45),
  crawlSpeed: px(0.9),     // walking while crouched
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
  jumpVel: px(4.95),       // full hop  (about 55 px high)
  shortHopVel: px(3.68),   // short hop (about 31 px high)
  doubleJumpVel: px(5.05),
  doubleJumpH: px(1.6),    // sideways speed when double jumping with a direction held
  doubleJumpAnimFrames: 18,
  jumpMaxH: px(2.9),       // sideways speed kept when jumping out of a run
  airJumps: 1,

  // Air
  gravity: px(0.23),
  fallSpeed: px(3.2),
  fastFallSpeed: px(4.9),
  airSpeed: px(2.7),
  airAccel: px(0.22),
  airFriction: px(0.026),

  // Ledge
  ledgeHang: px(44),       // how far the feet hang below the ledge
  ledgeMinHang: 8,         // frames before a ledge option can be chosen
  ledgeGetupFrames: 22,
  ledgeJumpVel: px(5.29),
  ledgeJumpH: px(1.2),

  // Shield and dodges. intangible = [first, last] frame he cannot be hit.
  shieldY: 22,             // shield bubble centre, px above the feet
  roll: { intangible: [4, 15], faf: 31, move: [3, 18], speed: px(2.2), turnAt: 11 },
  spotDodge: { intangible: [3, 17], faf: 27 },
  airDodge: { intangible: [3, 29], faf: 42 },                       // neutral
  airDodgeDir: { intangible: [3, 19], faf: 48, speed: px(2.2), sideSpeed: px(3.1), glide: 20, lenience: 3 }, // with a direction
  //   sideSpeed: straight left/right dodges go further than up, down or diagonal

  // Knockdown (missed tech)
  getupRollSpeed: px(2.4), getupRollFrames: 26,

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
  spinPivot: 8,            // whole-body rotation turns around a point this far above the hip
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
  // g = sneaker accent (heel tab and side stripe); white on most palettes
  foot: { pivot: [1, 1], px: ['gww...', 'wwgww.', 'WwwwwW'] },
};

// ---------------------------------------------------------------------------
// Palettes. Hair and skin are shared; alts change the shirt and jeans.
// Letters: t/T/u shirt (base/shadow/light), j/J/i jeans (base/shadow/light).
// ---------------------------------------------------------------------------
const BASE_COLORS = {
  k: '#ecba8e', K: '#c98f68', l: '#f8d5ae',   // skin
  h: '#231813', H: '#42302a',                 // hair
  w: '#f6f6f2', W: '#bfc5d0', g: '#f6f6f2',   // sneakers (g = accent)
  c: '#dfe4ee',                               // chain
  e: '#1b1310', m: '#ffffff', r: '#8c3a36',   // eyes, teeth, mouth
};
const alt = (name, shirt, jeans, extra = {}) => ({
  name,
  colors: { ...BASE_COLORS, t: shirt[0], T: shirt[1], u: shirt[2], j: jeans[0], J: jeans[1], i: jeans[2], ...extra },
});
const BLUE_JEANS = ['#3f6fb8', '#2c5190', '#5b8cd4'];
const DARK_JEANS = ['#2c2f44', '#1d1f30', '#3e425c'];
const palettes = [
  alt('Classic', ['#2d2d37', '#1d1d26', '#41414e'], BLUE_JEANS, { g: '#2fa35a' }), // white sneakers with green accents
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

// Shared bits of attack poses.
const FISTS = { handF: 'fist', handB: 'fist' };
const STAND = { torso: 2, armF: [4, 10], armB: [-6, 8], legF: [5, -4], legB: [-6, -2] };
const AIR = { torso: 6, armF: [75, 20], armB: [-80, 15], legF: [18, -28], legB: [-14, -18], footF: 25, footB: 35 };
// down air: knees pulled up high, then both feet driven straight down
const DAIR_TUCK = { hip: [0, -4], torso: 10, head: 8, legF: [80, -135], legB: [70, -130], armF: [70, 60], armB: [50, 70], footF: 20, footB: 20, ...FISTS };
const DAIR_STOMP = { hip: [0, 2], torso: -4, head: 12, legF: [6, -2], legB: [-4, -2], armF: [150, 25], armB: [-145, -15], footF: 50, footB: 50, ...FISTS, face: 'yell' };
const FTILT_KICK = { hip: [-1, 0], torso: -14, legF: [92, -2], legB: [-6, -4], armF: [-45, 25], armB: [45, 35], footF: 30, ...FISTS, face: 'yell' };
const DTILT_LOW = { hip: [-1, 9], torso: 24, head: 8, legF: [62, -112], legB: [50, -108], armF: [10, 50], armB: [-10, 40] };
const DTILT_SWEEP = { hip: [-2, 12], torso: 10, legF: [76, -4], legB: [60, -124], armF: [-30, 30], armB: [-50, 20], footF: 20, face: 'yell' };
const SLIDE = { hip: [-1, 11], torso: -38, head: -15, legF: [82, -2], legB: [65, -115], armF: [-60, 20], armB: [-80, 10], footF: 35, face: 'yell' };
// body thrown level, both legs driven straight out behind
// dash attack: a low kick with the front leg, then a high kick with the other leg
const DA_KICK1 = { rot: -55, hip: [0, 4], torso: 0, head: 20, legF: [30, -4], legB: [-30, -60], armF: [60, 70], armB: [20, 80], footF: -40, ...FISTS, face: 'yell' };
const DA_SWITCH = { rot: -60, hip: [0, 6], torso: 0, head: 22, legF: [-10, -60], legB: [55, -110], armF: [40, 80], armB: [60, 70], footB: -20, ...FISTS };
const DA_KICK2 = { rot: -75, hip: [0, 9], torso: 0, head: 25, legF: [-25, -50], legB: [14, -4], armF: [40, 80], armB: [70, 70], footB: -60, ...FISTS, face: 'yell' };
// knockdown: lying on his back, and the getup attack's spinning sweep
const LIE = { rot: -90, hip: [-8, 23], torso: 0, head: 0, armF: [20, 30], armB: [-10, 20], legF: [5, -10], legB: [-5, -6], footF: 80, footB: 80, face: 'hurt' };
const GUA_FRONT = { rot: -30, hip: [-2, 17], torso: 0, legF: [62, -4], legB: [100, -110], armF: [-40, 30], armB: [-60, 20], footF: 40, ...FISTS, face: 'yell' };
const GUA_BACK = { rot: -30, hip: [-2, 17], torso: 0, legF: [100, -110], legB: [-128, -4], armF: [-40, 30], armB: [-60, 20], footB: -40, ...FISTS, face: 'yell' };
// ledge attack: a low kick out onto the stage from a crouch
const LEDGE_KICK = { hip: [-1, 6], torso: -10, head: -4, legF: [88, -4], legB: [40, -100], armF: [-40, 40], armB: [30, 50], footF: 30, ...FISTS, face: 'yell' };
// roll: curled up low with knees to chest and arms wrapped round them
const ROLL_BALL = { hip: [0, 12], torso: 62, head: 40, armF: [60, 110], armB: [40, 115], legF: [100, -150], legB: [90, -145], footF: 40, footB: 40, ...FISTS };
const BAIR_KICK = { rot: 72, torso: 6, head: -30, legF: [-6, -8], legB: [-16, -2], armF: [60, 70], armB: [40, 80], footF: -60, footB: -60, ...FISTS, face: 'yell' };
const UAIR_KICK = { torso: -8, head: -10, legF: [55, -105], legB: [70, -105], armF: [-20, 70], armB: [-45, 60], footF: 40, ...FISTS, face: 'yell' };
const UAIR_TUCK = { torso: 12, head: 10, legF: [70, -100], legB: [55, -95], armF: [30, 80], armB: [10, 85], ...FISTS };

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
  crawl: anim(true, [
    [8, { hip: [-1, 9], torso: 30, head: 10, armF: [28, 60], armB: [0, 55], legF: [74, -118], legB: [40, -104] }],
    [8, { hip: [-1, 9], torso: 30, head: 10, armF: [6, 55], armB: [22, 60], legF: [52, -112], legB: [60, -114] }],
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
  // --- Being hit ---
  hurt: anim(true, [
    [6, { torso: -22, head: -18, armF: [110, 30], armB: [-120, -20], legF: [35, -40], legB: [-25, -30], footF: 20, footB: 30, face: 'hurt' }],
    [6, { torso: -28, head: -22, armF: [125, 40], armB: [-105, -10], legF: [45, -50], legB: [-15, -40], footF: 20, footB: 30, face: 'hurt' }],
  ]),
  tumble: anim(true, [
    [7, { hip: [0, -3], torso: -50, head: -30, armF: [150, 20], armB: [-150, -10], legF: [70, -50], legB: [10, -60], footF: 30, footB: 40, face: 'hurt' }],
    [7, { hip: [0, -3], torso: -70, head: -40, armF: [120, 40], armB: [-120, -30], legF: [95, -70], legB: [35, -40], footF: 30, footB: 40, face: 'hurt' }],
  ]),

  // --- Shield and dodges ---
  shield: anim(false, [
    [3, { hip: [0, 2], torso: 8, armF: [70, 100], armB: [50, 110], legF: [20, -30], legB: [-10, -25], ...FISTS }],
    [1, { hip: [0, 3], torso: 10, head: 6, armF: [75, 105], armB: [55, 110], legF: [24, -38], legB: [-6, -30], ...FISTS }],
  ]),
  // Roll: drops into a tight low ball and scoots along the floor (no
  // somersault), so it reads the same rolling either way. A forward roll
  // turns him around while he is balled up (see engine/fighter.js).
  roll: anim(false, [
    [3, { hip: [0, 5], torso: 30, head: 20, armF: [40, 80], armB: [20, 80], legF: [60, -110], legB: [40, -100], ...FISTS }],
    [4, ROLL_BALL],
    [6, { ...ROLL_BALL, hip: [1, 11] }],
    [6, ROLL_BALL],
    [6, { hip: [0, 6], torso: 24, head: 10, armF: [30, 60], armB: [10, 60], legF: [50, -95], legB: [35, -85] }],
    [6, STAND],
  ]),
  spotDodge: anim(false, [
    [3, { hip: [0, 1], torso: 10, legF: [25, -40], legB: [-5, -30], armF: [40, 60], armB: [30, 70] }],
    [12, { hip: [-3, 3], torso: -28, head: -15, legF: [40, -55], legB: [-20, -50], armF: [-30, 40], armB: [-60, 30] }],
    [6, { hip: [-2, 1], torso: -16, head: -8, legF: [30, -45], legB: [-15, -40], armF: [-20, 40], armB: [-40, 30] }],
    [6, STAND],
  ]),
  airDodge: anim(false, [
    [3, { torso: 10, armF: [60, 90], armB: [40, 100], legF: [60, -100], legB: [40, -90], ...FISTS }],
    [24, { torso: 20, head: 15, armF: [90, 110], armB: [70, 115], legF: [80, -125], legB: [65, -120], ...FISTS }],
    [10, { torso: 8, armF: [70, 40], armB: [-60, 30], legF: [30, -50], legB: [-10, -40] }],
    [5, AIR],
  ]),
  dizzy: anim(true, [
    [18, { hip: [-1, 2], torso: -10, head: -20, armF: [10, 20], armB: [-5, 15], legF: [10, -15], legB: [-5, -10], face: 'hurt' }],
    [18, { hip: [1, 2], torso: 12, head: 20, armF: [5, 15], armB: [-10, 20], legF: [5, -10], legB: [-10, -15], face: 'hurt' }],
  ], { ease: true }),

  // --- Knockdown and getting up ---
  lie: anim(false, [[3, { ...LIE, hip: [-8, 19] }], [1, LIE]]),
  getupStand: anim(false, [
    [8, LIE],
    [10, { rot: -40, hip: [0, 9], torso: 20, legF: [70, -120], legB: [55, -110], armF: [40, 60], armB: [20, 60] }],
    [6, { hip: [0, 6], torso: 16, legF: [48, -90], legB: [32, -80], armF: [20, 40], armB: [0, 40] }],
    [1, STAND],
  ]),
  getupRoll: anim(false, [
    [4, LIE],
    [7, { rot: 0, hip: [0, 10], torso: 40, head: 30, legF: [80, -130], legB: [70, -125], armF: [60, 80], armB: [40, 80] }],
    [7, { rot: 180, hip: [0, -4], torso: 40, head: 30, legF: [80, -130], legB: [70, -125], armF: [60, 80], armB: [40, 80] }],
    [7, { rot: 360, hip: [0, 8], torso: 30, head: 20, legF: [70, -120], legB: [60, -110], armF: [40, 60], armB: [20, 60] }],
    [1, STAND],
  ]),
  getupAttack: anim(false, [
    [10, LIE],
    [7, { rot: -45, hip: [-4, 19], torso: 0, legF: [100, -110], legB: [90, -100], armF: [-40, 30], armB: [-60, 20], ...FISTS }],
    [2, GUA_FRONT],
    [2, { rot: -30, hip: [-2, 17], torso: 0, legF: [100, -110], legB: [100, -110], armF: [-40, 30], armB: [-60, 20], ...FISTS, face: 'yell' }],
    [2, GUA_BACK], [2, GUA_BACK],
    [10, { hip: [0, 6], torso: 16, legF: [48, -90], legB: [32, -80], armF: [20, 40], armB: [0, 40] }],
    [5, STAND],
  ]),

  // Ledge attack: pull up from the ledge, then a low sweeping kick onto the stage.
  ledgeAttack: anim(false, [
    [8, { torso: 4, armF: [163, 8], armB: [168, 6], legF: [10, -15], legB: [-2, -10], footF: 25 }],
    [8, { torso: 30, armF: [60, 60], armB: [50, 70], legF: [70, -100], legB: [20, -40] }],
    [4, { hip: [0, 6], torso: 24, armF: [20, 40], armB: [5, 40], legF: [50, -95], legB: [32, -82] }],
    [2, LEDGE_KICK], [3, LEDGE_KICK],
    [10, { hip: [0, 4], torso: 10, legF: [40, -70], legB: [10, -50], armF: [-10, 40], armB: [20, 40] }],
    [5, STAND],
  ]),

  // --- Attacks. A pose is fully reached at the frame equal to the sum of
  // the frame counts before it, so line that up with the move's active frames.
  // Repeating a pose holds it. ---
  // Jab combo: lead punch, cross with the other hand, then a kick.
  jab1: anim(false, [
    [2, { torso: 4, armF: [30, 95], armB: [-10, 70], ...FISTS }],
    [4, { hip: [1, 0], torso: 10, armF: [88, 4], armB: [-25, 80], legF: [12, -6], legB: [-12, -4], ...FISTS, face: 'yell' }],
    [9, { torso: 6, armF: [50, 60], armB: [-15, 70], ...FISTS }],
    [1, STAND],
  ]),
  jab2: anim(false, [
    [2, { torso: 8, armF: [60, 50], armB: [20, 95], ...FISTS }],
    [4, { hip: [1, 0], torso: 12, armF: [20, 100], armB: [90, 4], legF: [12, -6], legB: [-12, -4], ...FISTS, face: 'yell' }],
    [10, { torso: 6, armF: [40, 70], armB: [30, 70], ...FISTS }],
    [1, STAND],
  ]),
  jab3: anim(false, [
    [3, { torso: -4, legF: [40, -60], armF: [-20, 40], armB: [30, 50], ...FISTS }],
    [3, { torso: -12, legF: [86, -4], legB: [-8, -6], armF: [-40, 30], armB: [40, 40], footF: 30, ...FISTS, face: 'yell' }],
    [3, { torso: -12, legF: [86, -4], legB: [-8, -6], armF: [-40, 30], armB: [40, 40], footF: 30, ...FISTS, face: 'yell' }],
    [10, { torso: -4, legF: [40, -50], armF: [-20, 40], armB: [30, 50] }],
    [6, STAND],
  ]),
  // Forward tilt: leaning-back roundhouse kick.
  ftilt: anim(false, [
    [5, { hip: [-1, 1], torso: -4, legF: [40, -85], legB: [-4, -10], armF: [-30, 60], armB: [35, 70], ...FISTS }],
    [3, FTILT_KICK], [3, FTILT_KICK],
    [7, { torso: -6, legF: [45, -55], armF: [-25, 35], armB: [30, 45] }],
    [4, STAND],
  ]),
  // Up tilt: rising uppercut, from a low wind-up to a fist straight overhead.
  utilt: anim(false, [
    [4, { hip: [0, 4], torso: 14, armF: [15, 95], armB: [-25, 60], legF: [32, -58], legB: [14, -48], ...FISTS }],
    [3, { hip: [0, 1], torso: 6, armF: [80, 45], armB: [-35, 50], legF: [14, -22], legB: [-2, -16], ...FISTS, face: 'yell' }],
    [4, { hip: [0, -2], torso: -6, head: -10, armF: [165, 8], armB: [-45, 40], legF: [4, -2], legB: [-6, -2], footF: 25, footB: 25, ...FISTS, face: 'yell' }],
    [4, { hip: [0, -2], torso: -8, head: -12, armF: [190, 5], armB: [-45, 40], legF: [4, -2], legB: [-6, -2], footF: 25, footB: 25, ...FISTS, face: 'yell' }],
    [7, { torso: 0, armF: [110, 50], armB: [-20, 40], ...FISTS }],
    [3, STAND],
  ]),
  // Down tilt: crouching leg sweep along the floor.
  dtilt: anim(false, [
    [5, DTILT_LOW],
    [3, DTILT_SWEEP], [3, DTILT_SWEEP],
    [8, DTILT_LOW],
    [1, DTILT_LOW],
  ]),
  // Dash attack: two kicks while still travelling forward: a low kick with the
  // front leg (hit 1), then the other leg swings through for a higher kick (hit 2).
  dashAttack: anim(false, [
    [3, { hip: [1, 2], torso: 14, legF: [45, -70], legB: [-25, -30], armF: [-30, 60], armB: [40, 70], ...FISTS }],
    [3, { hip: [1, 1], torso: 4, legF: [70, -50], legB: [-25, -25], armF: [-35, 55], armB: [45, 65], ...FISTS }],
    [2, DA_KICK1], [4, DA_KICK1],
    [5, DA_SWITCH],
    [2, DA_KICK2], [6, DA_KICK2],
    [8, { torso: 4, legF: [10, -30], legB: [40, -60], armF: [20, 40], armB: [-20, 40] }],
    [7, STAND],
  ]),
  // Neutral air: one leg held out, arms spread.
  nair: anim(false, [
    [3, { torso: -6, legF: [45, -60], legB: [-10, -50], armF: [30, 60], armB: [-30, 50], ...FISTS }],
    [20, { torso: -14, legF: [78, -4], legB: [-25, -75], armF: [-55, 30], armB: [70, 30], footF: 20, ...FISTS, face: 'yell' }],
    [8, { torso: -8, legF: [60, -20], legB: [-20, -60], armF: [-30, 40], armB: [40, 40], footF: 20 }],
    [7, AIR],
  ]),
  // Forward air: fist wound up behind the head, then swung over the top and
  // down in front in a big arc.
  fair: anim(false, [
    [4, { torso: -6, armF: [140, 30], armB: [-40, 50], legF: [20, -30], legB: [-10, -30], ...FISTS }],
    [4, { torso: -18, head: -8, armF: [215, 20], armB: [-50, 60], legF: [28, -45], legB: [-15, -35], ...FISTS }],
    [2, { torso: 4, armF: [150, 5], armB: [-40, 60], legF: [20, -30], legB: [-15, -35], ...FISTS, face: 'yell' }],
    [2, { torso: 22, armF: [95, 5], armB: [-30, 60], legF: [10, -20], legB: [-25, -40], ...FISTS, face: 'yell' }],
    [2, { torso: 34, head: 12, armF: [50, 5], armB: [-25, 55], legF: [10, -20], legB: [-25, -40], ...FISTS, face: 'yell' }],
    [8, { torso: 38, head: 15, armF: [25, 5], armB: [-20, 50], legF: [10, -20], legB: [-25, -40], ...FISTS }],
    [9, AIR],
  ]),
  // Back air: dropkick, body level with both legs thrust out behind.
  bair: anim(false, [
    [6, { rot: 30, torso: 10, legF: [40, -90], legB: [30, -100], armF: [40, 60], armB: [30, 70], ...FISTS }],
    [4, BAIR_KICK], [3, BAIR_KICK],
    [8, { rot: 40, torso: 10, legF: [20, -60], legB: [10, -70], armF: [40, 60], armB: [30, 70] }],
    [8, AIR],
  ]),
  // Up air: a full backflip with one leg extended, so the foot sweeps from
  // in front, over the head, to behind. rot runs from 0 to -360.
  uair: anim(false, [
    [3, { ...UAIR_TUCK, rot: 0 }],
    [2, { ...UAIR_KICK, rot: -45 }],   // frame 3: knee-up kick in front, close to the body
    [3, { ...UAIR_KICK, rot: -130 }],  // frame 5: over the head
    [6, { ...UAIR_KICK, rot: -215 }],  // frame 8: behind the head
    [6, { ...UAIR_TUCK, rot: -320 }],
    [2, { ...AIR, rot: -360 }],
  ], { ease: false }),
  // Down air: a heavy double-foot stomp straight down. Slow to start,
  // spikes if the feet land the hit cleanly.
  dair: anim(false, [
    [6, { ...AIR }],
    [10, DAIR_TUCK],
    [2, DAIR_STOMP], [3, DAIR_STOMP],
    [10, { torso: 4, legF: [30, -50], legB: [15, -45], armF: [80, 40], armB: [-60, 30], footF: 20, footB: 20 }],
    [6, AIR],
  ]),

  land: anim(false, [
    [2, { hip: [0, 5], torso: 14, armF: [25, 30], armB: [-30, 20], legF: [45, -85], legB: [28, -75] }],
    [4, { hip: [0, 1], torso: 4, armF: [8, 14], armB: [-8, 10], legF: [14, -22], legB: [-2, -18] }],
  ]),
};

// ---------------------------------------------------------------------------
// Moves. Hit timing and damage follow a mid-weight all-rounder; the recovery
// after each move is shortened so normal attacks feel quick.
//   faf          first frame he can act again
//   hitboxes     (low(...) = extra hitbox that only hits knocked-down opponents)
//                hit(firstFrame, lastFrame, bodyPart, radiusPx, damage%, angle, baseKB, KBgrowth, extras)
//                  Hitboxes are circles that follow a body part:
//                    fistF/B, handF/B, elbowF/B, toeF/B, footF/B, shinF/B, kneeF/B, hip, chest, neck
//                  angle: 0 = straight forward, 90 = up, 270 = down (spike), 361 = automatic
//                  extras: dir: -1 (launch backward), group (each group hits once per use),
//                          fkb (fixed knockback: same launch at any percent),
//                          onlyGround / onlyAir (only hits grounded / airborne targets),
//                          off: [x, y] px, lag (fixed hitlag frames), lagMult (percent of normal hitlag)
//                  listed first = wins when several overlap, so put sweet spots first
//   landLag      aerials: landing lag if he lands during frames autoCancel[0] .. autoCancel[1]-1
//   trail        swipe arc drawn behind a body part while the move is out:
//                  { part, from, to } (frames), so the hitbox is easy to see
//   next         combo link: pressing attack from frame `from` starts `move`
//   intangible   cannot be hit during frames 1..intangible
//   fromLedge    started from the ledge: climbs up over `rise` frames first
//   slide        ground move that slides: starting speed and friction
//   endsCrouched stay crouching afterwards if down is held
// ---------------------------------------------------------------------------
const hit = (from, to, at, r, damage, angle, bkb, kbg, extra = {}) => ({
  frames: [from, to], at, r, damage: Math.round(damage * 10), angle, bkb, kbg, ...extra,
});
// Several hitboxes sharing the same numbers, e.g. along a whole leg.
const hits = (from, to, parts, damage, angle, bkb, kbg, extra) =>
  parts.map(([at, r]) => hit(from, to, at, r, damage, angle, bkb, kbg, extra));
const BACK = { dir: -1 };
// Extra low hitbox that only hits opponents lying on the floor, so grounded
// moves can hit someone who is knocked down. off is measured from the hip.
const low = (from, to, r, damage, angle, bkb, kbg, x) => hit(from, to, 'hip', r, damage, angle, bkb, kbg, { downed: true, off: [x, 16] });
const LEG_F = [['toeF', 6], ['shinF', 5], ['kneeF', 5]];
const LEG_B = [['toeB', 6], ['shinB', 5], ['kneeB', 5], ['toeF', 5]];
const ARM_F = [['fistF', 7], ['elbowF', 5]];

const moves = {
  // --- Jab combo: press attack again to continue into the next hit ---
  jab1: { faf: 16, next: { move: 'jab2', from: 5 }, hitboxes: [...hits(2, 3, [['fistF', 5], ['elbowF', 4]], 2.2, 361, 22, 15), low(2, 3, 6, 2.2, 361, 22, 15, 12)] },
  jab2: { faf: 18, next: { move: 'jab3', from: 5 }, hitboxes: [...hits(2, 3, [['fistB', 5], ['elbowB', 4]], 1.7, 361, 22, 15), low(2, 3, 6, 1.7, 361, 22, 15, 12)] },
  jab3: { faf: 26, trail: { part: 'toeF', from: 2, to: 5 }, hitboxes: [...hits(3, 5, LEG_F, 4, 361, 35, 110), low(3, 5, 6, 4, 361, 35, 110, 14)] },

  // --- Tilts ---
  ftilt: { faf: 22, trail: { part: 'toeF', from: 3, to: 7 }, hitboxes: [...hits(5, 7, LEG_F, 7, 361, 8, 100), low(5, 7, 7, 7, 361, 8, 100, 15)] },
  utilt: { faf: 28, trail: { part: 'fistF', from: 4, to: 11 }, hitboxes: [
    ...hits(5, 11, [['fistF', 8], ['elbowF', 6]], 5.5, 96, 62, 105),
    hit(5, 8, 'chest', 6, 5.5, 96, 62, 105, { off: [5, 0] }),   // close to the body on the way up
    low(5, 7, 7, 5.5, 96, 62, 105, 10),
  ] },
  dtilt: { faf: 23, endsCrouched: true, trail: { part: 'toeF', from: 4, to: 7 }, hitboxes: [
    hit(5, 7, 'kneeF', 5, 7, 80, 30, 80), hit(5, 7, 'shinF', 5, 7, 80, 30, 80), hit(5, 7, 'toeF', 6, 5, 80, 30, 80),
  ] },
  // Two hits, built like Joker's. Both hits always come out, whether or not
  // the first one connects.
  //   Hit 1 (frames 6-7): 2%, FIXED knockback, so at any percent it only
  //     nudges the opponent forward and holds them for hit 2. Grounded and
  //     airborne targets get separate versions (pushed along the floor vs.
  //     popped slightly up).
  //   Hit 2 (frames 15-21): 6% kick on the leg and foot, automatic angle,
  //     base 60 / growth 85: the hit that actually launches.
  dashAttack: { faf: 40, slide: { speed: px(2.8), friction: px(0.07) }, trail: { part: 'toeB', from: 14, to: 20 }, hitboxes: [
    ...hits(6, 7, [['toeF', 5], ['shinF', 5], ['kneeF', 5], ['hip', 6]], 2, 0, 0, 95, { group: 0, fkb: 60, onlyGround: true }),
    ...hits(6, 7, [['toeF', 5], ['shinF', 5], ['kneeF', 5], ['hip', 6]], 2, 30, 0, 95, { group: 0, fkb: 45, onlyAir: true }),
    ...hits(15, 21, [['toeB', 5], ['shinB', 5], ['kneeB', 5]], 6, 361, 60, 85, { group: 1 }),
  ] },

  // Getup attack from lying down: kicks in front, then behind. He cannot be
  // hit while getting up (see `intangible`).
  getupAttack: { faf: 40, intangible: 23, trail: { part: 'toeF', from: 16, to: 20 }, hitboxes: [
    ...hits(18, 19, [['toeF', 6], ['shinF', 5]], 7, 361, 80, 50),
    ...hits(22, 23, [['toeB', 6], ['shinB', 5]], 7, 361, 80, 50, BACK),
  ] },

  // Ledge attack: climbs up during frames 1-20 (cannot be hit), kicks on 21-23.
  ledgeAttack: { faf: 40, fromLedge: { rise: 16 }, intangible: 20, trail: { part: 'toeF', from: 19, to: 23 }, hitboxes:
    hits(21, 23, [['toeF', 6], ['shinF', 5], ['kneeF', 5]], 9, 361, 90, 20) },

  // --- Aerials ---
  nair: { faf: 27, landLag: 4, autoCancel: [3, 26], hitboxes: [
    ...hits(3, 5, [['toeF', 6], ['shinF', 5], ['hip', 6]], 8, 361, 20, 100),
    ...hits(6, 24, [['toeF', 5], ['shinF', 5], ['hip', 6]], 5, 361, 10, 100),
  ] },
  // Kick timed like Inkling's: strongest right at the start, at the foot.
  // Overhead punch swing. Comes out on frame 8 and never spikes: the fist
  // knocks forward at every point of the arc. Big hitbox on the fist.
  fair: { faf: 31, landLag: 8, autoCancel: [3, 28], trail: { part: 'fistF', from: 6, to: 13, width: 9 }, hitboxes: [
    hit(8, 9, 'fistF', 16, 12, 361, 30, 98),
    hit(8, 9, 'elbowF', 12, 11, 361, 30, 95),
    hit(8, 12, 'chest', 11, 10, 361, 25, 92, { off: [11, -6] }),   // fills the arc in front of him
    hit(10, 12, 'fistF', 15, 10, 361, 25, 92),
    hit(10, 12, 'elbowF', 11, 9, 361, 25, 92),
  ] },
  bair: { faf: 22, landLag: 4, autoCancel: [6, 15], trail: { part: 'toeB', from: 4, to: 8 }, hitboxes: [
    ...hits(6, 7, LEG_B, 10.5, 361, 12, 106, BACK),
    ...hits(8, 10, LEG_B, 7, 361, 12, 100, BACK),
  ] },
  // A tight arc around his upper body: from close in front, over his head, to behind.
  uair: { faf: 20, landLag: 4, autoCancel: [3, 14], trail: { part: 'toeF', from: 3, to: 9 }, hitboxes:
    hits(3, 8, [['kneeF', 4], ['shinF', 4], ['toeF', 3]], 7, 80, 40, 120) },
  // Stomp: both feet spike on frames 16-18 (sweet spot), then a weaker
  // sideways hit on 19-21.
  dair: { faf: 37, landLag: 12, autoCancel: [3, 34], trail: { part: 'footF', from: 15, to: 19 }, hitboxes: [
    ...hits(16, 18, [['footF', 5], ['footB', 5], ['shinF', 4], ['shinB', 4]], 14, 270, 20, 80),
    ...hits(19, 21, [['footF', 5], ['footB', 5], ['shinF', 4], ['shinB', 4]], 10, 361, 20, 100),
  ] },
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
  moves,
};
