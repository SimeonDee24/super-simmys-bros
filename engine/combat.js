// Attacks hitting fighters: hitboxes, damage, knockback, hitstun and hitlag.
// Integer math only. Percent and damage are stored in TENTHS of a percent
// (damage: 70 means 7.0%), knockback in thousandths of a Smash knockback unit.
import { FX, sinDeg, cosDeg, mulTrig } from './fixed.js';
import { CONFIG } from '../config/config.js';
import { samplePose, solve, hurtboxes } from './skeleton.js';
import { getCharacter } from '../characters/index.js';
import { setState } from './fighter.js';

export function fighterSolve(f, ch) {
  const a = ch.animations[f.anim] || ch.animations.idle;
  return solve(ch.skeleton, samplePose(a, f.animFrame));
}

// Body points a hitbox can be attached to, so it follows the animation.
// A point n pixels past the end of a limb (past the wrist or ankle).
const tip = (limb, n) => [limb.c[0] + mulTrig(n * FX, sinDeg(limb.low)), limb.c[1] + mulTrig(n * FX, cosDeg(limb.low))];
const mid = (p, q) => [(p[0] + q[0]) >> 1, (p[1] + q[1]) >> 1];
const JOINT = {
  fistF: (s) => tip(s.armF, 2), handF: (s) => s.armF.c, elbowF: (s) => s.armF.b,
  fistB: (s) => tip(s.armB, 2), handB: (s) => s.armB.c, elbowB: (s) => s.armB.b,
  toeF: (s) => tip(s.legF, 3), footF: (s) => s.legF.c, shinF: (s) => mid(s.legF.b, s.legF.c), kneeF: (s) => s.legF.b,
  toeB: (s) => tip(s.legB, 3), footB: (s) => s.legB.c, shinB: (s) => mid(s.legB.b, s.legB.c), kneeB: (s) => s.legB.b,
  hip: (s) => s.hip, neck: (s) => s.neck, chest: (s) => mid(s.hip, s.neck),
};

export const jointAt = (solved, name) => JOINT[name](solved);

// Hitboxes that are out on this exact frame of the fighter's current move,
// as circles in world fixed-point: { cx, cy, r, def }.
export function activeHitboxes(f, ch, includeSpent = false) {
  if (f.state !== 'attack' || !f.move) return [];
  const mv = ch.moves[f.move];
  const fr = f.stateFrame;
  let s = null;
  const out = [];
  for (const hb of mv.hitboxes) {
    if (fr < hb.frames[0] || fr > hb.frames[1]) continue;
    if (!includeSpent && (f.hitGroups & (1 << (hb.group || 0)))) continue;
    s = s || fighterSolve(f, ch);
    const j = JOINT[hb.at](s);
    const ox = hb.off ? hb.off[0] * FX : 0, oy = hb.off ? hb.off[1] * FX : 0;
    const r = hb.r * FX;
    const cx = f.x + f.facing * (j[0] + ox), cy = f.y + j[1] + oy;
    out.push({ cx, cy, r, def: hb });
  }
  return out;
}

const UNHITTABLE = { dead: 1, out: 1, respawn: 1 };

// Smash knockback formula, in thousandths.
//   KB = ((p/10 + p*d/20) * 200/(w+100) * 1.4 + 18) * growth/100 + base
// p = victim percent after the hit, d = damage, w = victim weight.
export function knockback(p10, d10, weight, bkb, kbg) {
  const a = Math.trunc(((20 * p10 + p10 * d10) * 280 * 1000) / (2000 * (weight + 100)));
  return Math.trunc(((a + 18000) * kbg) / 100) + bkb * 1000;
}

// Set (fixed) knockback, used by moves that must send the same distance at any
// percent, such as the first hit of a multi-hit move:
//   KB = ((fkb/2 + 1) * 1.4 * 200/(w+100) + 18) * growth/100 + base
export function setKnockback(fkb, weight, bkb, kbg) {
  const a = Math.trunc(((fkb * 500 + 1000) * 280) / (weight + 100));
  return Math.trunc(((a + 18000) * kbg) / 100) + bkb * 1000;
}

function applyHit(state, att, vic, hit) {
  const hb = hit.def;
  const st = getCharacter(vic.charId).stats;
  vic.percent = Math.min(9999, vic.percent + hb.damage);
  let kb = hb.fkb ? setKnockback(hb.fkb, st.weight, hb.bkb, hb.kbg)
    : knockback(vic.percent, hb.damage, st.weight, hb.bkb, hb.kbg);

  // Launch angle. 361 = "Sakurai angle": flat at low knockback on the
  // ground, rising to 38 degrees; 45 in the air.
  let angle = hb.angle;
  if (angle === 361) {
    const C = CONFIG.SAKURAI;
    if (!vic.grounded) angle = C.air;
    else if (kb < C.lowKb) angle = 0;
    else if (kb >= C.highKb) angle = C.ground;
    else angle = Math.trunc((C.ground * (kb - C.lowKb)) / (C.highKb - C.lowKb));
  }
  // Hit downward while standing: bounce up off the floor instead.
  if (vic.grounded && angle > 180) { angle = 360 - angle; kb = Math.trunc((kb * 8) / 10); }
  const dir = att.facing * (hb.dir || 1);
  const launch = dir > 0 ? angle : 180 - angle;

  vic.kbAngle = ((launch % 360) + 360) % 360;
  vic.kbSpeed = Math.trunc((kb * CONFIG.KB_SPEED_NUM) / CONFIG.KB_SPEED_DEN);
  vic.gv = 0;
  vic.hitstun = Math.max(1, Math.trunc((kb * CONFIG.HITSTUN_NUM) / CONFIG.HITSTUN_DEN));
  // Hitlag: short for normal moves; a move can ask for more (smash attacks will).
  let lag = CONFIG.HITLAG_BASE + Math.trunc((hb.damage * CONFIG.HITLAG_PER_DMG) / 1000);
  lag = Math.min(CONFIG.HITLAG_MAX, Math.trunc((lag * (hb.lagMult || 100)) / 100));
  if (hb.lag !== undefined) lag = hb.lag;
  att.hitlag = lag;
  vic.hitlag = lag;
  att.hitGroups |= 1 << (hb.group || 0);

  const lifts = angle > 0 && angle < 180;
  if (lifts || !vic.grounded) { vic.grounded = 0; vic.ground = -1; }
  vic.fastFall = 0;
  vic.tumbling = 0;
  vic.ledge = -1;
  vic.move = '';
  vic.facing = dir > 0 ? -1 : 1; // face the attacker
  setState(vic, 'hitstun', kb >= CONFIG.TUMBLE_KB && !vic.grounded ? 'tumble' : 'hurt');

  // For effects and (later) sound: where and how hard the last hit landed.
  vic.hitX = hit.px; vic.hitY = hit.py;
  vic.lastHitTick = state.tick;
  vic.lastHitDmg = hb.damage;
}

// Called once per tick after everyone has moved. All hits are found first,
// then applied, so two attacks landing on the same frame trade.
export function resolveHits(state) {
  const hits = [];
  for (const att of state.fighters) {
    if (att.state !== 'attack') continue;
    const boxes = activeHitboxes(att, getCharacter(att.charId));
    if (!boxes.length) continue;
    for (const vic of state.fighters) {
      if (vic === att || vic.invuln > 0 || vic.intangible > 0 || UNHITTABLE[vic.state]) continue;
      const vch = getCharacter(vic.charId);
      const hurt = hurtboxes(vch.skeleton, fighterSolve(vic, vch), vic.facing);
      let found = null;
      for (let i = 0; i < boxes.length && !found; i++) {
        const b = boxes[i];
        if (b.def.downed && vic.state !== 'knockdown') continue;
        if (b.def.onlyGround && !vic.grounded) continue;   // separate versions for grounded
        if (b.def.onlyAir && vic.grounded) continue;       // and airborne targets
        for (let k = 0; k < hurt.length; k++) {
          const h = hurt[k];
          const hx1 = vic.x + h[0], hy1 = vic.y + h[1], hx2 = vic.x + h[2], hy2 = vic.y + h[3];
          // circle against rectangle: nearest point of the hurtbox to the hitbox centre
          const nx = b.cx < hx1 ? hx1 : b.cx > hx2 ? hx2 : b.cx;
          const ny = b.cy < hy1 ? hy1 : b.cy > hy2 ? hy2 : b.cy;
          const dx = b.cx - nx, dy = b.cy - ny;
          if (dx * dx + dy * dy <= b.r * b.r) {
            found = { def: b.def, px: nx >> 8, py: ny >> 8 };
            break;
          }
        }
      }
      if (found) hits.push([att, vic, found]);
    }
  }
  for (const [att, vic, hit] of hits) applyHit(state, att, vic, hit);
}
