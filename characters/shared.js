// Moves and animations shared by EVERY character: grabs, pummel and the four
// throws. A character file spreads these into its own `animations` and
// `moves`, and can override any of them with its own version.
//
// All characters use the same skeleton layout, so these poses work for
// everyone; hitboxes and the held opponent's position scale with each
// character's own limb lengths.
import { anim } from '../engine/skeleton.js';

const FISTS = { handF: 'fist', handB: 'fist' };
const OPEN = { handF: 'open', handB: 'open' };
const STAND = { torso: 2, armF: [4, 10], armB: [-6, 8], legF: [5, -4], legB: [-6, -2] };
const HOLD = { hip: [0, 1], torso: 8, armF: [72, 40], armB: [66, 46], legF: [18, -20], legB: [-12, -8], ...FISTS };
// back throw spin: arms out, leaning back against the weight
const SPIN = { hip: [0, 2], torso: -8, head: -6, armF: [95, 5], armB: [88, 8], legF: [14, -18], legB: [-14, -16], ...FISTS, face: 'yell' };

export const SHARED_ANIMS = {
  // --- Grabs ---
  grab: anim(false, [
    [4, { hip: [0, 2], torso: 6, armF: [40, 70], armB: [30, 75], legF: [20, -25], legB: [-10, -15], ...OPEN }],
    [2, { hip: [1, 2], torso: 14, armF: [86, 6], armB: [80, 10], legF: [28, -20], legB: [-14, -8], ...OPEN }],
    [3, { hip: [1, 2], torso: 16, armF: [90, 4], armB: [84, 8], legF: [28, -20], legB: [-14, -8], ...OPEN }],
    [16, { hip: [0, 2], torso: 10, armF: [60, 40], armB: [50, 45], legF: [20, -20], legB: [-10, -12], ...OPEN }],
    [10, STAND],
  ]),
  dashGrab: anim(false, [
    [6, { hip: [1, 3], torso: 20, armF: [40, 70], armB: [30, 75], legF: [45, -40], legB: [-25, -20], ...OPEN }],
    [3, { hip: [2, 4], torso: 28, armF: [92, 2], armB: [86, 6], legF: [50, -30], legB: [-30, -15], ...OPEN }],
    [3, { hip: [2, 4], torso: 30, armF: [96, 2], armB: [90, 6], legF: [50, -30], legB: [-30, -15], ...OPEN }],
    [20, { hip: [0, 3], torso: 16, armF: [60, 40], armB: [50, 45], legF: [30, -30], legB: [-15, -15], ...OPEN }],
    [10, STAND],
  ]),
  // Holding someone: arms locked out in front, braced.
  holding: anim(true, [[24, HOLD], [24, { ...HOLD, hip: [0, 2], torso: 10 }]], { ease: true }),
  // Pummel: a knee into the held opponent.
  pummel: anim(false, [
    [3, { ...HOLD, legF: [60, -100], torso: 12 }],
    [3, { ...HOLD, hip: [1, 0], torso: 16, legF: [95, -125], footF: 30, face: 'yell' }],
    [7, HOLD],
  ]),
  // Being held: winces, arms flailing a little.
  grabbed: anim(true, [
    [10, { torso: -12, head: -10, armF: [40, 60], armB: [-30, 40], legF: [12, -10], legB: [-10, -6], face: 'hurt' }],
    [10, { torso: -16, head: -14, armF: [55, 45], armB: [-40, 50], legF: [16, -14], legB: [-8, -10], face: 'hurt' }],
  ], { ease: true }),

  // --- Throws ---
  // Forward: rocks back, then heaves the opponent forward with both arms.
  fthrow: anim(false, [
    [5, HOLD],
    [5, { ...HOLD, hip: [-1, 2], torso: -10, armF: [60, 70], armB: [54, 76] }],                 // rock back (frame 5)
    [12, { hip: [2, 1], torso: 24, armF: [110, 2], armB: [104, 6], legF: [36, -20], legB: [-24, -10], ...OPEN, face: 'yell' }], // heave (frame 10)
    [9, { hip: [1, 1], torso: 16, armF: [96, 10], armB: [88, 14], legF: [30, -18], legB: [-20, -8], ...OPEN }],
    [1, STAND],
  ]),
  // Back: spins around a full turn and a half with the opponent swinging round,
  // then lets go behind him. (He turns by flipping facing; see `spin` below.)
  bthrow: anim(false, [
    [4, { ...HOLD, torso: 0 }],
    [24, SPIN],
    [3, { ...SPIN, torso: -16, armF: [130, 4], armB: [124, 8], ...OPEN }],
    [12, { hip: [0, 1], torso: -6, armF: [100, 20], armB: [90, 20], legF: [10, -14], legB: [-10, -10], ...OPEN }],
    [8, STAND],
  ]),
  // Up: hoists the opponent overhead and tosses them straight up.
  uthrow: anim(false, [
    [5, { ...HOLD, hip: [0, 4], torso: 14, legF: [34, -60], legB: [14, -50] }],
    [6, { hip: [0, -1], torso: -4, head: -16, armF: [168, 20], armB: [160, 24], legF: [6, -4], legB: [-6, -4], footF: 20, footB: 20, ...OPEN, face: 'yell' }],
    [12, { torso: 0, head: -10, armF: [175, 6], armB: [168, 10], legF: [4, -2], legB: [-4, -2], ...OPEN }],
    [8, STAND],
  ]),
  // Down: lifts the opponent, then slams them into the floor in front.
  dthrow: anim(false, [
    [6, HOLD],
    [5, { hip: [0, -1], torso: -6, head: -12, armF: [150, 30], armB: [144, 34], legF: [6, -4], legB: [-6, -4], ...FISTS }],       // lifted overhead (frame 6)
    [14, { hip: [1, 7], torso: 34, head: 14, armF: [70, 4], armB: [64, 8], legF: [50, -90], legB: [30, -80], ...FISTS, face: 'yell' }], // slam (frame 11)
    [8, { hip: [0, 5], torso: 24, armF: [55, 20], armB: [48, 24], legF: [40, -70], legB: [24, -60], ...FISTS }],
    [1, STAND],
  ]),
};

// Grab boxes: `grab: { frames, boxes }` — any box touching the opponent's
// body on those frames grabs them (grabs go straight through shields). Each
// grab has a reaching box at the hands and a close box in front of the chest,
// so someone pressed right up against you still gets grabbed.
const CLOSE = { at: 'chest', r: 8, off: [6, 0] };
export const SHARED_MOVES = {
  grab:      { faf: 34, grab: { frames: [6, 7], boxes: [{ at: 'handF', r: 7, off: [2, 0] }, CLOSE] }, hitboxes: [] },
  dashGrab:  { faf: 42, slide: { speed: 0, friction: 46 }, grab: { frames: [9, 10], boxes: [{ at: 'handF', r: 8, off: [3, 0] }, CLOSE] }, hitboxes: [] },
  pivotGrab: { faf: 38, grab: { frames: [10, 11], boxes: [{ at: 'handF', r: 8, off: [6, 0] }, CLOSE] }, hitboxes: [] },
};

// Throws. `path` = where the held opponent is, relative to the thrower's
// feet in pixels ([frame, x, y]; x is forward), blended between keys.
// On frame `release` they are launched with `hit`. `dir: -1` throws
// backward. `spin` = frames on which the thrower turns around (back throw).
export const THROWS = {
  fthrow: {
    anim: 'fthrow', release: 10, faf: 32, dir: 1,
    path: [[0, 16, 0], [5, 10, -6], [10, 24, -14]],
    hit: { damage: 80, angle: 45, bkb: 95, kbg: 38 },          // 8%, sends far forward but rarely kills (about 210% at the edge)
  },
  bthrow: {
    anim: 'bthrow', release: 31, faf: 51, dir: -1,
    spin: [8, 16, 24],
    // swinging round him: in front, passing behind, out the other side...
    path: [[0, 16, 0], [4, 16, -4], [8, 18, -8], [12, 0, -10], [16, -18, -8], [20, 0, -10], [24, 18, -8], [28, 0, -10], [31, -20, -12]],
    hit: { damage: 110, angle: 45, bkb: 62, kbg: 70 },         // 11%, the kill throw: KOs from about 120% at the edge
  },
  uthrow: {
    anim: 'uthrow', release: 11, faf: 31, dir: 1,
    path: [[0, 16, 0], [5, 8, -12], [11, 2, -46]],
    hit: { damage: 70, angle: 90, bkb: 70, kbg: 60 },          // 7%, straight up: combo starter
  },
  dthrow: {
    anim: 'dthrow', release: 11, faf: 33, dir: 1,
    path: [[0, 16, 0], [6, 6, -40], [11, 14, -2]],
    hit: { damage: 50, angle: 70, bkb: 90, kbg: 28 },          // 5%, pops them up and away; never really kills
  },
};

export const PUMMEL = { damage: 13, every: 13, hitFrame: 4 };  // 1.3% knee, can repeat every 13 frames
