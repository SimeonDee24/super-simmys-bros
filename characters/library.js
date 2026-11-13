// MOVE LIBRARY
// Moves kept on the side so any character can use them later. Each entry is
// self-contained: its animation (`anim`) and its frame data and hitboxes
// (`move`). Hitboxes follow body parts, so a move fits any character's size.
//
// To give a character one of these, in their file:
//   import { LIBRARY, useMoves } from './library.js';
//   const extra = useMoves({ nair: 'nair_heldKick', dashAttack: 'dashAttack_slide' });
//   ...then spread extra.animations into their animations and extra.moves
//   into their moves (after their own, so the library versions win).
import { px } from '../engine/fixed.js';
import { anim } from '../engine/skeleton.js';

const FISTS = { handF: 'fist', handB: 'fist' };
const STAND = { torso: 2, armF: [4, 10], armB: [-6, 8], legF: [5, -4], legB: [-6, -2] };
const AIR = { torso: 6, armF: [75, 20], armB: [-80, 15], legF: [18, -28], legB: [-14, -18], footF: 25, footB: 35 };

const hit = (from, to, at, r, damage, angle, bkb, kbg, extra = {}) => ({
  frames: [from, to], at, r, damage: Math.round(damage * 10), angle, bkb, kbg, ...extra,
});
const hits = (from, to, parts, damage, angle, bkb, kbg, extra) =>
  parts.map(([at, r]) => hit(from, to, at, r, damage, angle, bkb, kbg, extra));

const BACK = { dir: -1 };
const BAIR_TUCK = { rot: 15, torso: 6, head: -4, legF: [110, -150], legB: [95, -145], armF: [-30, 60], armB: [100, 40], footF: 20, footB: 20, ...FISTS };
const BAIR_KICK = { rot: 90, torso: 0, head: -70, legF: [4, -2], legB: [-4, -2], armF: [40, 120], armB: [15, 125], footF: -90, footB: -90, ...FISTS, face: 'yell' };
const SLIDE = { hip: [-1, 11], torso: -38, head: -15, legF: [82, -2], legB: [65, -115], armF: [-60, 20], armB: [-80, 10], footF: 35, face: 'yell' };

export const LIBRARY = {
  // Neutral air: the original quick "get off me" kick (Simeon, v0.3 – v0.11).
  // Out on frame 3, one leg held straight out in front for a long time with
  // the arms spread. 8% early (frames 3-5), 5% late (frames 6-24).
  nair_heldKick: {
    slot: 'nair',
    anim: anim(false, [
      [3, { torso: -6, legF: [45, -60], legB: [-10, -50], armF: [30, 60], armB: [-30, 50], ...FISTS }],
      [20, { torso: -14, legF: [78, -4], legB: [-25, -75], armF: [-55, 30], armB: [70, 30], footF: 20, ...FISTS, face: 'yell' }],
      [8, { torso: -8, legF: [60, -20], legB: [-20, -60], armF: [-30, 40], armB: [40, 40], footF: 20 }],
      [7, AIR],
    ]),
    move: { faf: 27, landLag: 4, autoCancel: [3, 26], hitboxes: [
      ...hits(3, 5, [['toeF', 6], ['shinF', 5], ['hip', 6]], 8, 361, 20, 100),
      ...hits(6, 24, [['toeF', 5], ['shinF', 5], ['hip', 6]], 5, 361, 10, 100),
    ] },
  },

  // Dash attack: the feet-first baseball slide (Simeon, v0.4 – v0.5).
  // Slides in fast; 8% early (frames 6-9), then a weaker 6% hit that pops
  // them up while he keeps sliding (frames 10-25).
  dashAttack_slide: {
    slot: 'dashAttack',
    anim: anim(false, [
      [6, { hip: [0, 6], torso: -18, legF: [70, -30], legB: [40, -70], armF: [-40, 30], armB: [-60, 20] }],
      [18, SLIDE], [3, SLIDE],
      [5, { hip: [0, 7], torso: 4, legF: [55, -95], legB: [40, -90], armF: [10, 40], armB: [-10, 40] }],
      [1, STAND],
    ]),
    move: { faf: 33, slide: { speed: px(3.0), friction: px(0.07) }, hitboxes: [
      ...hits(6, 9, [['toeF', 6], ['shinF', 5], ['hip', 5]], 8, 60, 60, 55),
      ...hits(10, 25, [['toeF', 5], ['shinF', 5], ['hip', 5]], 6, 110, 50, 40),
    ] },
  },

  // Back air: knees tucked to the chest, then both legs blast straight out
  // behind him with his body flat (Simeon, v0.10 – v0.13). Out frame 6,
  // 12% clean (frames 6-8), 8% late (frames 9-11). Strong KO move.
  bair_doubleKick: {
    slot: 'bair',
    anim: anim(false, [
      [2, { rot: 5, torso: 6, legF: [60, -100], legB: [50, -105], armF: [20, 60], armB: [60, 60], ...FISTS }],
      [3, BAIR_TUCK],
      [1, BAIR_TUCK],
      [4, BAIR_KICK], [3, BAIR_KICK],
      [7, { rot: 45, torso: 6, legF: [30, -50], legB: [20, -60], armF: [40, 60], armB: [30, 70] }],
      [6, AIR],
    ]),
    move: { faf: 22, landLag: 4, autoCancel: [6, 15], trail: { part: 'toeB', from: 5, to: 9, width: 7, straight: true }, hitboxes: [
      ...hits(6, 8, [['toeB', 8], ['toeF', 8], ['shinB', 7], ['kneeB', 6]], 12, 361, 15, 105, BACK),
      ...hits(9, 11, [['toeB', 7], ['toeF', 7], ['shinB', 6], ['kneeB', 5]], 8, 361, 15, 100, BACK),
    ] },
  },
};

// Build the animations and moves for a set of slots, e.g.
//   useMoves({ nair: 'nair_heldKick' })  ->  { animations: { nair }, moves: { nair } }
export function useMoves(slots) {
  const animations = {}, moves = {};
  for (const [slot, name] of Object.entries(slots)) {
    const entry = LIBRARY[name];
    if (!entry) throw new Error('No move called ' + name + ' in the library');
    animations[slot] = entry.anim;
    moves[slot] = entry.move;
  }
  return { animations, moves };
}
