// Movement and stage collision. All integer math.
import { FX } from './fixed.js';
import { enterAir, land, setState } from './fighter.js';
import { CONFIG } from '../config/config.js';

export function moveFighter(f, stage, st) {
  const solids = stage.solids;
  const hw = st.ecbHalfW, h = st.ecbHeight;

  if (f.grounded) {
    f.x += f.vx;
    const g = solids[f.ground];
    // Walked or slid off the edge.
    if (f.x < g.x * FX || f.x > (g.x + g.w) * FX) { f.vy = 0; enterAir(f, 'fall'); }
    return;
  }

  const x0 = f.x, y0 = f.y;

  // Horizontal move, then push out of walls.
  f.x += f.vx;
  f.wallSide = 0;
  for (let i = 0; i < solids.length; i++) {
    const s = solids[i];
    const L = s.x * FX, R = (s.x + s.w) * FX, T = s.y * FX, B = (s.y + s.h) * FX;
    if (f.y > T && f.y - h < B && f.x + hw > L && f.x - hw < R) {
      if (x0 <= (L + R) >> 1) { f.x = L - hw; f.wallSide = 1; }
      else { f.x = R + hw; f.wallSide = -1; }
      f.vx = 0;
    }
  }

  // Vertical move: land on top surfaces, bonk on undersides.
  f.y += f.vy;
  for (let i = 0; i < solids.length; i++) {
    const s = solids[i];
    const L = s.x * FX, R = (s.x + s.w) * FX, T = s.y * FX, B = (s.y + s.h) * FX;
    if (f.vy >= 0 && y0 <= T && f.y >= T && f.x >= L && f.x <= R) {
      f.y = T;
      land(f, i, st);
      return;
    }
    if (f.vy < 0 && y0 - h >= B && f.y - h < B && f.x + hw > L && f.x - hw < R) {
      f.y = B + h;
      f.vy = 0;
    }
  }
}

// Milestone 1: crossing a blast zone just puts the fighter back on the
// respawn point. Milestone 2 turns this into a real KO (stock loss,
// explosion effect, respawn platform).
export function checkBlastZones(f, stage, st) {
  const b = stage.blast;
  if (f.x < b.left * FX || f.x > b.right * FX || f.y < b.top * FX || f.y > b.bottom * FX) {
    f.falls++;
    f.x = stage.respawn.x * FX;
    f.y = stage.respawn.y * FX;
    f.vx = 0; f.vy = 0;
    f.fastFall = 0;
    f.jumpsLeft = st.airJumps;
    f.invuln = CONFIG.RESPAWN_INVULN;
    f.grounded = 0; f.ground = -1;
    setState(f, 'air', 'fall');
  }
}
