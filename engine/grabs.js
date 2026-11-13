// Grabs, holds, pummels and throws. The throw data itself is shared by all
// characters (characters/shared.js).
import { FX } from './fixed.js';
import { CONFIG } from '../config/config.js';
import { getCharacter } from '../characters/index.js';
import { hurtboxes } from './skeleton.js';
import { fighterSolve, jointAt, UNHITTABLE, applyHit } from './combat.js';
import { setState } from './fighter.js';

const NOT_GRABBABLE = { grabbed: 1, thrown: 1, holding: 1, throwing: 1 };

// Put the held opponent at (x, y) px from the grabber's feet; x is forward.
export function placeHeld(g, vic, x, y, facing = g.facing) {
  vic.x = g.x + facing * x * FX;
  vic.y = g.y + y * FX;
  vic.vx = 0; vic.vy = 0;
  if (x !== 0) vic.facing = x > 0 ? -facing : facing;   // face the grabber
}

// Grab boxes against bodies. Run after normal hits, so a grabber who just got
// hit does not also grab.
export function resolveGrabs(state) {
  for (const att of state.fighters) {
    if (att.state !== 'attack' || !att.move) continue;
    const ch = getCharacter(att.charId);
    const gb = ch.moves[att.move].grab;
    if (!gb || att.stateFrame < gb.frames[0] || att.stateFrame > gb.frames[1]) continue;
    const solved = fighterSolve(att, ch);
    const circles = gb.boxes.map((b) => {
      const j = jointAt(solved, b.at);
      return [att.x + att.facing * (j[0] + (b.off ? b.off[0] * FX : 0)), att.y + j[1] + (b.off ? b.off[1] * FX : 0), b.r * FX];
    });
    for (const vic of state.fighters) {
      if (vic === att || vic.invuln > 0 || vic.intangible > 0 || UNHITTABLE[vic.state] || NOT_GRABBABLE[vic.state]) continue;
      const vch = getCharacter(vic.charId);
      let touch = false;
      const hurt = hurtboxes(vch.skeleton, fighterSolve(vic, vch), vic.facing);
      for (const [cx, cy, r] of circles) {
        for (const h of hurt) {
          const hx1 = vic.x + h[0], hy1 = vic.y + h[1], hx2 = vic.x + h[2], hy2 = vic.y + h[3];
          const nx = cx < hx1 ? hx1 : cx > hx2 ? hx2 : cx, ny = cy < hy1 ? hy1 : cy > hy2 ? hy2 : cy;
          if ((cx - nx) * (cx - nx) + (cy - ny) * (cy - ny) <= r * r) { touch = true; break; }
        }
        if (touch) break;
      }
      if (!touch) continue;
      // Caught.
      att.holding = vic.slot; att.move = ''; att.vx = 0; att.pummelFrame = 0;
      setState(att, 'holding', 'holding');
      vic.heldBy = att.slot;
      vic.grabTimer = CONFIG.GRAB_TIME_BASE + Math.trunc((vic.percent * CONFIG.GRAB_TIME_PER_PCT) / 10);
      vic.move = ''; vic.shieldStun = 0; vic.ledge = -1; vic.tumbling = 0; vic.fastFall = 0; vic.hitstun = 0;
      vic.grounded = att.grounded; vic.ground = att.ground;
      setState(vic, 'grabbed', 'grabbed');
      placeHeld(att, vic, CONFIG.HOLD_DISTANCE, 0);
      vic.grabTick = state.tick;
      break;
    }
  }
}

// Let go: both are pushed apart and stuck for a moment (the victim less).
export function releaseGrab(g, vic) {
  g.holding = -1;
  g.vx = -g.facing * CONFIG.GRAB_RELEASE_PUSH;
  g.releaseFrames = CONFIG.GRAB_RELEASE_GRABBER;
  setState(g, 'grabRelease', 'land');
  if (vic && vic.heldBy === g.slot) {
    vic.heldBy = -1;
    vic.y = g.y; vic.grounded = g.grounded; vic.ground = g.ground;
    vic.vx = g.facing * CONFIG.GRAB_RELEASE_PUSH;
    vic.releaseFrames = CONFIG.GRAB_RELEASE_VICTIM;
    setState(vic, 'grabRelease', 'hurt');
  }
}

// The throw lets go of the opponent and launches them.
export function launchThrow(state, g, vic, t) {
  vic.heldBy = -1;
  g.holding = -1;
  vic.grounded = 0; vic.ground = -1;
  const dir = t.dir * g.throwFacing;
  applyHit(state, g, vic, { def: t.hit, px: vic.x >> 8, py: (vic.y >> 8) - 20 }, { x: g.x, dir });
}

// Where the thrown opponent is on this frame of the throw (blended path).
export function throwPos(t, frame) {
  const p = t.path;
  if (frame <= p[0][0]) return [p[0][1], p[0][2]];
  for (let i = 1; i < p.length; i++) {
    if (frame <= p[i][0]) {
      const [f0, x0, y0] = p[i - 1], [f1, x1, y1] = p[i];
      const u = frame - f0, d = f1 - f0;
      return [x0 + Math.trunc(((x1 - x0) * u) / d), y0 + Math.trunc(((y1 - y0) * u) / d)];
    }
  }
  const last = p[p.length - 1];
  return [last[1], last[2]];
}
