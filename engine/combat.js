// Attacks hitting fighters: hitboxes, damage, knockback, hitstun and hitlag.
// Integer math only. Percent and damage are stored in TENTHS of a percent
// (damage: 70 means 7.0%), knockback in thousandths of a Smash knockback unit.
import { FX, sinDeg, cosDeg, mulTrig } from './fixed.js';
import { CONFIG } from '../config/config.js';
import { samplePose, solve, hurtboxes } from './skeleton.js';
import { getCharacter } from '../characters/index.js';
import { setState, breakShield } from './fighter.js';

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
  const lag = lagFor(hb);
  att.hitlag = lag;
  vic.hitlag = lag;
  att.hitGroups |= 1 << (hb.group || 0);

  const lifts = angle > 0 && angle < 180;
  if (lifts || !vic.grounded) { vic.grounded = 0; vic.ground = -1; }
  vic.fastFall = 0;
  vic.tumbling = 0;
  vic.airDodged = 0;
  vic.shieldStun = 0;
  vic.ledge = -1;
  vic.move = '';
  vic.facing = dir > 0 ? -1 : 1; // face the attacker
  setState(vic, 'hitstun', kb >= CONFIG.TUMBLE_KB && !vic.grounded ? 'tumble' : 'hurt');

  // For effects and (later) sound: where and how hard the last hit landed.
  vic.hitX = hit.px; vic.hitY = hit.py;
  vic.lastHitTick = state.tick;
  vic.lastHitDmg = hb.damage;
}

// --- Shield ---
const SHIELDING = { shield: 1, shieldStun: 1 };

// Bubble radius shrinks as shield health runs out.
export function shieldRadius(f) {
  const span = CONFIG.SHIELD_MAX_R - CONFIG.SHIELD_MIN_R;
  return (CONFIG.SHIELD_MIN_R * FX) + Math.trunc((span * FX * Math.max(0, f.shieldHp)) / CONFIG.SHIELD_MAX);
}
export function shieldCentre(f) {
  return [f.x, f.y - getCharacter(f.charId).stats.shieldY * FX];
}
function circlesTouch(b, cx, cy, r) {
  const dx = b.cx - cx, dy = b.cy - cy, rr = b.r + r;
  return dx * dx + dy * dy <= rr * rr;
}

function lagFor(hb) {
  let lag = CONFIG.HITLAG_BASE + Math.trunc((hb.damage * CONFIG.HITLAG_PER_DMG) / 1000);
  lag = Math.min(CONFIG.HITLAG_MAX, Math.trunc((lag * (hb.lagMult || 100)) / 100));
  return hb.lag !== undefined ? hb.lag : lag;
}

// An attack hit the shield bubble.
function applyShieldHit(state, att, vic, hb) {
  const lag = lagFor(hb);
  att.hitlag = lag; vic.hitlag = lag;
  att.hitGroups |= 1 << (hb.group || 0);
  vic.shieldHitTick = state.tick;
  vic.shieldHp -= Math.trunc((hb.damage * CONFIG.SHIELD_DMG_MULT * 100) / 100);
  if (vic.shieldHp <= 0) { breakShield(vic); vic.breakTick = state.tick; return; }
  // pushed away from the attacker, and stuck in shield for a moment
  const away = vic.x >= att.x ? 1 : -1;
  vic.vx = away * (CONFIG.SHIELD_PUSH_BASE + Math.trunc((hb.damage * CONFIG.SHIELD_PUSH_PER_PCT) / 10));
  vic.shieldStun = Math.trunc((hb.damage * CONFIG.SHIELDSTUN_MULT) / 1000) + 2;
  setState(vic, 'shieldStun', 'shield');
  vic.animFrame = 99;
}

// The defender let go of shield just before the hit: parry. No damage, and
// the attacker is frozen for longer so the defender can punish.
function applyParry(state, att, vic, hb) {
  const lag = lagFor(hb);
  vic.hitlag = lag;
  att.hitlag = lag + CONFIG.PARRY_FREEZE;
  att.hitGroups |= 1 << (hb.group || 0);
  vic.parryTick = state.tick;
  setState(vic, 'idle', 'idle');
}

// --- Counter specials ---
// A move with `counter: { window: [a, b], mult, min, then }` catches any hit
// that lands on frames a..b: no damage, both freeze, and the defender
// switches into the `then` move, whose `counterDamage` hitboxes deal the
// caught attack's damage x mult% (at least `min`).
function inCounter(f) {
  if (f.state !== 'attack' || !f.move) return null;
  const c = getCharacter(f.charId).moves[f.move].counter;
  return c && f.stateFrame >= c.window[0] && f.stateFrame <= c.window[1] ? c : null;
}

function applyCounter(state, att, vic, hb, ctr) {
  att.hitGroups |= 1 << (hb.group || 0);
  vic.counterDmg = Math.max(ctr.min, Math.trunc((hb.damage * ctr.mult) / 100));
  vic.counterTick = state.tick;
  vic.facing = att.x >= vic.x ? 1 : -1;
  const air = !vic.grounded;
  vic.move = ctr.then; vic.moveAir = air ? 1 : 0; vic.hitGroups = 0;
  setState(vic, 'attack', ctr.then);
  vic.intangible = ctr.intangible || 10;
  // freeze both; the attacker stays frozen long enough for the counter to land
  vic.hitlag = ctr.freeze;
  att.hitlag = ctr.freeze + ctr.attackerExtra;
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
      const ctr = inCounter(vic);
      const vch = getCharacter(vic.charId);
      const hurt = hurtboxes(vch.skeleton, fighterSolve(vic, vch), vic.facing);
      const shielding = SHIELDING[vic.state];
      const parrying = vic.state === 'shieldDrop' && vic.stateFrame <= CONFIG.PARRY_WINDOW;
      const [scx, scy] = shieldCentre(vic);
      const sr = shieldRadius(vic);
      let found = null;
      for (let i = 0; i < boxes.length && !found; i++) {
        const b = boxes[i];
        if (b.def.downed && vic.state !== 'knockdown') continue;
        if (b.def.onlyGround && !vic.grounded) continue;   // separate versions for grounded
        if (b.def.onlyAir && vic.grounded) continue;       // and airborne targets
        // The shield bubble takes the hit first. Body parts sticking out of a
        // small shield can still be hit ("shield poking").
        if ((shielding || parrying) && circlesTouch(b, scx, scy, sr)) {
          found = { def: b.def, px: b.cx >> 8, py: b.cy >> 8, shield: 1, parry: parrying ? 1 : 0 };
          break;
        }
        for (let k = 0; k < hurt.length; k++) {
          const h = hurt[k];
          const hx1 = vic.x + h[0], hy1 = vic.y + h[1], hx2 = vic.x + h[2], hy2 = vic.y + h[3];
          // circle against rectangle: nearest point of the hurtbox to the hitbox centre
          const nx = b.cx < hx1 ? hx1 : b.cx > hx2 ? hx2 : b.cx;
          const ny = b.cy < hy1 ? hy1 : b.cy > hy2 ? hy2 : b.cy;
          const dx = b.cx - nx, dy = b.cy - ny;
          if (dx * dx + dy * dy <= b.r * b.r) {
            found = { def: b.def, px: nx >> 8, py: ny >> 8, parry: parrying ? 1 : 0 };
            break;
          }
        }
      }
      if (found) { if (ctr && !found.shield) found.counter = ctr; hits.push([att, vic, found]); }
    }
  }
  for (const [att, vic, hit] of hits) {
    if (hit.def.counterDamage) hit.def = { ...hit.def, damage: att.counterDmg };
    if (hit.counter) applyCounter(state, att, vic, hit.def, hit.counter);
    else if (hit.parry) applyParry(state, att, vic, hit.def);
    else if (hit.shield) applyShieldHit(state, att, vic, hit.def);
    else applyHit(state, att, vic, hit);
  }
}
