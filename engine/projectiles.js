// Projectiles (Simeon's basketball, and anything thrown or fired later).
// They live in the game state as plain integer data, like fighters, so they
// are deterministic, hashed and replayable.
//
// A move spawns one by having `spawn: { frame, from, projectile }` in its data;
// the projectile's behaviour comes from the character's `projectiles` table.
import { FX, approach } from './fixed.js';
import { getStage } from '../stages/index.js';
import { getCharacter } from '../characters/index.js';
import { hurtboxes } from './skeleton.js';
import {
  fighterSolve, jointAt, UNHITTABLE, SHIELDING, shieldCentre, shieldRadius,
  applyHit, applyShieldHit, applyParry, inCounter, applyCounter,
} from './combat.js';
import { CONFIG } from '../config/config.js';

const def = (p) => getCharacter(p.charId).projectiles[p.kind];

export function countProjectiles(state, owner, kind) {
  let n = 0;
  for (const p of state.projectiles || []) if (p.owner === owner && (!kind || p.kind === kind)) n++;
  return n;
}

// Called by the move on its spawn frame. `charge` (0..max) makes the shot
// travel further and higher.
export function spawnProjectile(state, f, mv) {
  const ch = getCharacter(f.charId);
  const d = ch.projectiles[mv.spawn.projectile];
  const at = jointAt(fighterSolve(f, ch), mv.spawn.from);
  const c = Math.min(f.charge, mv.charge ? mv.charge.max : 0);
  if (!state.projectiles) state.projectiles = [];
  state.projectiles.push({
    kind: mv.spawn.projectile, charId: f.charId, owner: f.slot,
    x: f.x + f.facing * at[0], y: f.y + at[1],
    vx: f.facing * (d.speed[0] + c * d.chargeSpeed[0]),
    vy: -(d.speed[1] + c * d.chargeSpeed[1]),
    bounces: 0, rolling: 0, life: d.life, spent: 0, spin: 0,
  });
}

// Move every projectile one frame: gravity, bouncing off the stage, rolling.
export function stepProjectiles(state) {
  const list = state.projectiles;
  if (!list || !list.length) return;
  const stage = getStage(state.stageId);
  const b = stage.blast;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i], d = def(p), r = d.r * FX;
    p.life--;
    p.spin += p.vx;
    if (p.rolling) {
      p.vx = approach(p.vx, 0, d.rollFriction);
      p.x += p.vx;
      const s = stage.solids[p.rolling - 1];
      if (p.x < s.x * FX || p.x > (s.x + s.w) * FX) p.rolling = 0;   // rolled off the edge
      if (p.vx === 0) p.life = Math.min(p.life, d.fadeFrames);
    } else {
      p.vy = Math.min(p.vy + d.gravity, d.maxFall);
      const y0 = p.y;
      p.x += p.vx;
      p.y += p.vy;
      for (let k = 0; k < stage.solids.length; k++) {
        const s = stage.solids[k];
        const L = s.x * FX, R = (s.x + s.w) * FX, T = s.y * FX, B = (s.y + s.h) * FX;
        if (p.x + r <= L || p.x - r >= R) continue;
        if (p.vy >= 0 && y0 + r <= T && p.y + r >= T) {
          // landed on top: bounce, or start rolling once the bounces get small
          p.y = T - r;
          p.bounces++;
          const up = Math.trunc((p.vy * d.bounce) / 256);
          if (up < d.minBounce || p.bounces > d.maxBounces) { p.vy = 0; p.rolling = k + 1; }
          else { p.vy = -up; p.vx = Math.trunc((p.vx * d.bounceKeepX) / 256); }
        } else if (p.vy < 0 && y0 - r >= B && p.y - r <= B) {
          p.y = B + r; p.vy = -Math.trunc(p.vy / 2);                     // bonk the underside
        } else if (p.y + r > T && p.y - r < B) {
          p.x = p.vx > 0 ? L - r : R + r; p.vx = -Math.trunc((p.vx * 3) / 4); // bounce off a wall
        }
      }
    }
    const out = p.x < b.left * FX || p.x > b.right * FX || p.y > b.bottom * FX || p.y < b.top * FX;
    if (out || p.life <= 0) list.splice(i, 1);
  }
}

// Projectiles against fighters: shield, parry and counters all apply.
export function resolveProjectileHits(state) {
  const list = state.projectiles;
  if (!list || !list.length) return;
  for (const p of list) {
    if (p.spent) continue;
    const d = def(p);
    // a slow-rolling ball is harmless; a rolling one hits weaker than in flight
    const speed = Math.abs(p.vx);
    if (p.rolling && speed < d.minRollSpeed) continue;
    const hb = p.rolling ? d.rollHit : d.hit;
    const ball = { cx: p.x, cy: p.y, r: (d.r + d.hitPad) * FX };
    const src = { x: p.x, dir: p.vx >= 0 ? 1 : -1 };
    for (const vic of state.fighters) {
      if (vic.slot === p.owner || vic.invuln > 0 || vic.intangible > 0 || UNHITTABLE[vic.state]) continue;
      const owner = state.fighters[p.owner];
      const shielding = SHIELDING[vic.state];
      const parrying = vic.state === 'shieldDrop' && vic.stateFrame <= CONFIG.PARRY_WINDOW;
      let result = null;
      if (shielding || parrying) {
        const [sx, sy] = shieldCentre(vic), sr = shieldRadius(vic);
        const dx = ball.cx - sx, dy = ball.cy - sy, rr = ball.r + sr;
        if (dx * dx + dy * dy <= rr * rr) result = parrying ? 'parry' : 'shield';
      }
      if (!result) {
        const vch = getCharacter(vic.charId);
        for (const h of hurtboxes(vch.skeleton, fighterSolve(vic, vch), vic.facing)) {
          const hx1 = vic.x + h[0], hy1 = vic.y + h[1], hx2 = vic.x + h[2], hy2 = vic.y + h[3];
          const nx = ball.cx < hx1 ? hx1 : ball.cx > hx2 ? hx2 : ball.cx;
          const ny = ball.cy < hy1 ? hy1 : ball.cy > hy2 ? hy2 : ball.cy;
          const dx = ball.cx - nx, dy = ball.cy - ny;
          if (dx * dx + dy * dy <= ball.r * ball.r) { result = parrying ? 'parry' : 'body'; break; }
        }
      }
      if (!result) continue;
      const ctr = result === 'body' ? inCounter(vic) : null;
      if (ctr) applyCounter(state, owner, vic, hb, ctr, src);
      else if (result === 'parry') applyParry(state, owner, vic, hb, src);
      else if (result === 'shield') applyShieldHit(state, owner, vic, hb, src);
      else applyHit(state, owner, vic, { def: hb, px: p.x >> 8, py: p.y >> 8 }, src);
      // the ball pops off whatever it hit and becomes harmless
      p.spent = 1;
      p.rolling = 0;
      p.vx = -Math.trunc(p.vx / 3);
      p.vy = -d.popUp;
      p.life = Math.min(p.life, d.fadeFrames);
      break;
    }
  }
}
