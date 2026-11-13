// Movement and stage collision. All integer math.
import { FX } from './fixed.js';
import { enterAir, land, setState } from './fighter.js';
import { BTN } from './input.js';
import { CONFIG } from '../config/config.js';

export function moveFighter(f, stage, st) {
  const solids = stage.solids;
  const hw = st.ecbHalfW, h = st.ecbHeight;

  if (NO_PHYSICS[f.state]) return; // position is set by the state

  if (f.grounded) {
    f.x += f.vx;
    const g = solids[f.ground];
    const gl = g.x * FX, gr = (g.x + g.w) * FX;
    if (f.state === 'attack' || f.state === 'getupRoll') {
      // Ground attacks and rolls stop at the edge instead of sliding off.
      if (f.x < gl) { f.x = gl; f.vx = 0; } else if (f.x > gr) { f.x = gr; f.vx = 0; }
    } else if (f.x < gl || f.x > gr) {
      // Walked, slid or was knocked off the edge.
      f.vy = 0;
      if (f.state === 'hitstun') { f.grounded = 0; f.ground = -1; }
      else enterAir(f, 'fall');
    }
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

  tryLedgeGrab(f, stage, st);
}

// Automatic ledge grab: while falling, if the hands are close to a ledge.
// Holding down prevents it.
function tryLedgeGrab(f, stage, st) {
  if (f.state !== 'air' || f.vy < 0 || f.ledgeCd > 0 || (f.prevIn & BTN.DOWN)) return;
  const handY = f.y - st.ledgeHang;
  for (let i = 0; i < stage.ledges.length; i++) {
    const l = stage.ledges[i];
    const out = (f.x - l.x * FX) * l.dir; // distance outside the ledge
    if (out < -CONFIG.LEDGE_INSIDE_X * FX || out > CONFIG.LEDGE_REACH_X * FX) continue;
    if (Math.abs(handY - l.y * FX) > CONFIG.LEDGE_REACH_Y * FX) continue;
    f.ledge = i;
    f.ledgeQueue = 0;
    const li = CONFIG.LEDGE_INTANGIBLE;
    f.intangible = Math.max(f.intangible, f.ledgeGrabs < li.length ? li[f.ledgeGrabs] : 0);
    f.ledgeGrabs++;
    f.tumbling = 0;
    f.airDodged = 0;
    f.x = l.x * FX + l.dir * st.ecbHalfW;
    f.y = l.y * FX + st.ledgeHang;
    f.vx = 0; f.vy = 0;
    f.facing = -l.dir;
    f.fastFall = 0;
    f.jumpsLeft = st.airJumps;
    f.wallSide = 0;
    setState(f, 'ledge', 'ledge');
    return;
  }
}

const NO_PHYSICS = { ledge: 1, ledgeGetup: 1, ledgeRoll: 1, dead: 1, out: 1, respawn: 1, grabbed: 1, thrown: 1 };

// Crossing a blast zone is a KO: lose a stock and wait to respawn.
// (Milestone 2 adds launch-based KOs; the rule here stays the same.)
export function checkBlastZones(f, stage) {
  if (f.state === 'dead' || f.state === 'out' || f.state === 'respawn') return;
  const b = stage.blast;
  if (f.x < b.left * FX || f.x > b.right * FX || f.y < b.top * FX || f.y > b.bottom * FX) {
    f.falls++;
    f.stocks--;
    f.percent = 0; // damage resets with every stock
    f.koX = Math.max(0, Math.min(CONFIG.SCREEN_W, f.x >> 8));
    f.koY = Math.max(0, Math.min(CONFIG.SCREEN_H, f.y >> 8));
    f.vx = 0; f.vy = 0;
    f.fastFall = 0;
    f.grounded = 0; f.ground = -1;
    f.ledge = -1; f.ledgeCd = 0;
    f.tumbling = 0; f.intangible = 0; f.airDodged = 0;
    f.shieldHp = CONFIG.SHIELD_MAX; f.mash = 0;
    setState(f, 'dead', 'fall');
  }
}

// Fighters standing on the ground push each other instead of walking or
// running through. Airborne fighters, and anyone rolling or dodging, pass
// through freely (cross-ups still work). Nobody gets pushed off an edge.
const NO_PUSH = {
  dead: 1, out: 1, respawn: 1, grabbed: 1, thrown: 1, holding: 1, throwing: 1,
  ledge: 1, ledgeGetup: 1, ledgeRoll: 1, roll: 1, spotdodge: 1, getupRoll: 1, knockdown: 1,
};
export function pushApart(state, stage) {
  const [a, b] = state.fighters;
  if (!a || !b || !a.grounded || !b.grounded || a.ground !== b.ground) return;
  if (NO_PUSH[a.state] || NO_PUSH[b.state] || a.intangible > 0 || b.intangible > 0) return;
  const dist = Math.abs(b.x - a.x);
  const W = CONFIG.PUSH_WIDTH * FX;
  if (dist >= W) return;
  const dir = b.x > a.x || (b.x === a.x && a.slot < b.slot) ? 1 : -1;   // +1: b is to the right of a
  const hard = CONFIG.PUSH_HARD * FX;
  // gentle push while they overlap a little; a firm one past the hard limit
  let each = Math.min(CONFIG.PUSH_RATE, (W - dist) >> 1);
  if (dist < hard) each = Math.max(each, ((hard - dist) + 1) >> 1);
  const g = stage.solids[a.ground];
  const L = g.x * FX, R = (g.x + g.w) * FX;
  const move = (f, dx) => { const x = Math.max(L, Math.min(R, f.x + dx)); const done = x - f.x; f.x = x; return done; };
  const da = move(a, -dir * each);
  const db = move(b, dir * each);
  // one of them is stopped at the edge: the other takes the rest of the push
  const shortA = each - Math.abs(da), shortB = each - Math.abs(db);
  if (shortA > 0) move(b, dir * shortA);
  if (shortB > 0) move(a, -dir * shortB);
}
