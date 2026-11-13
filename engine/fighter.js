// Fighter state machine. Milestone 1: movement only.
// Later milestones add states to the STATES table (attacks, shield, grabs,
// ledge, hitstun...) without changing how the table is driven.
import { BTN } from './input.js';
import { CONFIG } from '../config/config.js';
import { FX, approach, clamp, sinDeg, cosDeg, mulTrig } from './fixed.js';
import { getCharacter } from '../characters/index.js';
import { getStage } from '../stages/index.js';

export function newFighter(slot, charId, alt, spawn, stocks) {
  const st = getCharacter(charId).stats;
  return {
    slot, charId, alt,
    x: spawn.x * FX, y: spawn.y * FX, vx: 0, vy: 0,
    facing: spawn.facing,
    state: 'idle', stateFrame: 0,
    anim: 'idle', animFrame: 0,
    grounded: 1, ground: spawn.ground || 0,
    jumpsLeft: st.airJumps, fastFall: 0, landLag: 0,
    ledge: -1, ledgeCd: 0,  // ledge being held, and frames until one can be grabbed again
    wallSide: 0,            // -1 / 1 while touching a wall in the air (for wall jumps)
    prevIn: 0, tapDir: 0, tapTimer: 0,
    buf: 0, bufTimer: 0, dashBuf: 0, dashBufTimer: 0, // input buffer
    percent: 0, stocks, falls: 0,
    // Attacks
    move: '', moveAir: 0, hitGroups: 0,
    // Being hit
    hitlag: 0, hitstun: 0, intangible: 0, tumbling: 0, kbAngle: 0, kbSpeed: 0, gv: 0,
    hitX: 0, hitY: 0, lastHitTick: -1, lastHitDmg: 0,
    koX: 0, koY: 0,         // where the last KO happened (pixels), for the blast effect
    invuln: 0,
  };
}

export function setAnim(f, name) {
  if (f.anim !== name) { f.anim = name; f.animFrame = 0; }
}
export function setState(f, state, animName) {
  f.state = state;
  f.stateFrame = 0;
  if (animName) setAnim(f, animName);
}

export function enterAir(f, animName) {
  f.grounded = 0;
  f.ground = -1;
  setState(f, 'air', animName || 'fall');
}

export function land(f, groundIndex, st) {
  f.y = f.y | 0;
  f.vy = 0;
  f.grounded = 1;
  f.ground = groundIndex;
  f.landLag = f.fastFall ? st.hardLandLag : st.softLandLag;
  if (f.state === 'attack') {
    // Landing during an aerial: its own landing lag, unless inside an auto-cancel window.
    const mv = getCharacter(f.charId).moves[f.move];
    if (f.stateFrame >= mv.autoCancel[0] && f.stateFrame < mv.autoCancel[1]) f.landLag = mv.landLag;
  } else if (f.state === 'hitstun') {
    f.landLag = CONFIG.HITSTUN_LAND_LAG;
  }
  if (f.tumbling || (f.state === 'hitstun' && f.anim === 'tumble')) {
    // Hit the floor while tumbling: knocked down.
    f.tumbling = 0;
    f.hitstun = 0; f.fastFall = 0; f.jumpsLeft = st.airJumps; f.wallSide = 0; f.vx = 0;
    setState(f, 'knockdown', 'lie');
    return;
  }
  f.move = '';
  f.hitstun = 0;
  f.fastFall = 0;
  f.jumpsLeft = st.airJumps;
  f.wallSide = 0;
  setState(f, 'land', 'land');
}

export function startMove(f, name, air) {
  f.move = name;
  f.moveAir = air ? 1 : 0;
  f.hitGroups = 0;
  f.buf &= ~BTN.ATTACK;
  const mv = getCharacter(f.charId).moves[name];
  if (mv.intangible) f.intangible = mv.intangible;
  setState(f, 'attack', name);
}

// Ground attack button: no direction = jab, up = up tilt, down = down tilt,
// sideways = forward tilt.
function tryGroundAttack(c) {
  if (!(c.pressed & BTN.ATTACK)) return false;
  const f = c.f;
  if (c.input & BTN.UP) startMove(f, 'utilt', false);
  else if (c.input & BTN.DOWN) startMove(f, 'dtilt', false);
  else if (c.dir) { f.facing = c.dir; startMove(f, 'ftilt', false); }
  else startMove(f, 'jab1', false);
  return true;
}

// Air attack button: direction relative to facing picks the aerial.
function tryAerial(c) {
  if (!(c.pressed & BTN.ATTACK)) return false;
  const f = c.f;
  let name = 'nair';
  if (c.input & BTN.UP) name = 'uair';
  else if (c.input & BTN.DOWN) name = 'dair';
  else if (c.dir === f.facing) name = 'fair';
  else if (c.dir === -f.facing) name = 'bair';
  startMove(f, name, true);
  return true;
}

// Shared air movement: drift, fast fall, gravity.
function airMotion(c) {
  const { f, st } = c;
  if (c.dir) {
    const target = c.dir * st.airSpeed;
    const slower = c.dir > 0 ? f.vx < target : f.vx > target;
    f.vx = approach(f.vx, target, slower ? st.airAccel : st.airFriction);
  } else {
    f.vx = approach(f.vx, 0, st.airFriction);
  }
  // Fast fall: tap down at or after the peak
  if ((c.pressed & BTN.DOWN) && f.vy >= 0 && !f.fastFall) f.fastFall = 1;
  if (f.fastFall) f.vy = st.fastFallSpeed;
  else f.vy = Math.min(f.vy + st.gravity, st.fallSpeed);
}

// Attack while dashing or running.
function tryDashAttack(c) {
  if (!(c.pressed & BTN.ATTACK)) return false;
  startMove(c.f, 'dashAttack', false);
  c.f.vx = c.f.facing * c.ch.moves.dashAttack.slide.speed;
  return true;
}

function tryJump(c) {
  if (c.pressed & BTN.JUMP) { c.f.buf &= ~BTN.JUMP; setState(c.f, 'jumpsquat', 'jumpsquat'); return true; }
  return false;
}
function startDash(c, d) {
  const f = c.f;
  f.facing = d;
  f.vx = d * c.st.dashSpeed;
  f.tapTimer = 0;
  f.dashBuf = 0; f.dashBufTimer = 0;
  setState(f, 'dash', 'run');
}
function toCrouch(c) {
  if (c.input & BTN.DOWN) { setState(c.f, 'crouch', 'crouch'); return true; }
  return false;
}

const STATES = {
  idle(c) {
    const { f, st } = c;
    f.vx = approach(f.vx, 0, st.traction);
    if (tryGroundAttack(c) || tryJump(c) || toCrouch(c)) return;
    if (c.dir) {
      f.facing = c.dir;
      if (c.dashInput) startDash(c, c.dir); else setState(f, 'walk', 'walk');
    }
  },

  walk(c) {
    const { f, st } = c;
    if (tryGroundAttack(c) || tryJump(c) || toCrouch(c)) return;
    if (!c.dir) { setState(f, 'idle', 'idle'); return; }
    if (c.dashInput) { startDash(c, c.dir); return; }
    f.facing = c.dir;
    f.vx = approach(f.vx, c.dir * st.walkSpeed, st.walkAccel);
  },

  // Initial dash: a fixed burst of speed. Tapping the other way restarts it
  // in that direction (dash dancing).
  dash(c) {
    const { f, st } = c;
    if (tryDashAttack(c) || tryJump(c)) return;
    if (c.tap === -f.facing) { startDash(c, c.tap); return; }
    f.vx = f.facing * st.dashSpeed;
    if (f.stateFrame >= st.dashFrames) {
      if (c.dir === f.facing) setState(f, 'run', 'run');
      else setState(f, 'brake', 'brake');
    }
  },

  run(c) {
    const { f, st } = c;
    if (tryDashAttack(c) || tryJump(c) || toCrouch(c)) return;
    if (c.dir === f.facing) f.vx = approach(f.vx, f.facing * st.runSpeed, st.runAccel);
    else if (c.dir === -f.facing) { f.facing = -f.facing; setState(f, 'turn', 'brake'); }
    else setState(f, 'brake', 'brake');
  },

  // Skid to a stop after letting go of run.
  brake(c) {
    const { f, st } = c;
    f.vx = approach(f.vx, 0, st.traction);
    if (tryGroundAttack(c) || tryJump(c)) return;
    if (c.dashInput) { startDash(c, c.dashInput); return; }
    if (f.stateFrame >= st.brakeFrames) setState(f, 'idle', 'idle');
  },

  // Run turnaround: slide, then run the other way if the direction is held.
  turn(c) {
    const { f, st } = c;
    f.vx = approach(f.vx, 0, st.turnTraction);
    if (tryJump(c)) return;
    if (f.stateFrame >= st.turnFrames) {
      if (c.dir === f.facing) { f.vx = f.facing * st.turnExitSpeed; setState(f, 'run', 'run'); }
      else setState(f, 'idle', 'idle');
    }
  },

  crouch(c) {
    const { f, st } = c;
    f.vx = approach(f.vx, 0, st.traction);
    if (tryGroundAttack(c) || tryJump(c)) return;
    if (!(c.input & BTN.DOWN)) setState(f, 'idle', 'idle');
    else if (c.dir) { f.facing = c.dir; setState(f, 'crawl', 'crawl'); }
  },

  // Walking while crouched.
  crawl(c) {
    const { f, st } = c;
    if (tryGroundAttack(c) || tryJump(c)) return;
    if (!(c.input & BTN.DOWN)) { setState(f, c.dir ? 'walk' : 'idle', c.dir ? 'walk' : 'idle'); return; }
    if (!c.dir) { setState(f, 'crouch', 'crouch'); f.animFrame = 99; return; } // stay down, skip the crouch-down blend
    f.facing = c.dir;
    f.vx = approach(f.vx, c.dir * st.crawlSpeed, st.walkAccel);
  },

  // KO'd: gone until the respawn delay passes. Out of stocks = out for good.
  dead(c) {
    const { f } = c;
    if (f.stateFrame < CONFIG.KO_RESPAWN_DELAY) return;
    if (f.stocks <= 0) { setState(f, 'out', 'idle'); return; }
    const stage = getStage(c.match.stageId);
    f.x = (stage.respawn.x + (f.slot === 0 ? -1 : 1) * CONFIG.RESPAWN_SLOT_OFFSET) * FX;
    f.y = (stage.respawn.y - CONFIG.RESPAWN_DROP_PX) * FX;
    f.facing = f.slot === 0 ? 1 : -1;
    f.invuln = 2;
    setState(f, 'respawn', 'idle');
  },
  out() {},

  // Standing on the respawn platform as it floats down. Invincible. Any
  // movement input (or waiting too long) leaves the platform.
  respawn(c) {
    const { f, st } = c;
    const stage = getStage(c.match.stageId);
    const D = CONFIG.RESPAWN_DESCEND;
    const left = Math.max(0, D - f.stateFrame);
    f.y = stage.respawn.y * FX - Math.trunc((CONFIG.RESPAWN_DROP_PX * FX * left) / D);
    f.invuln = 2;
    if (f.stateFrame < D) return;
    const wants = c.dir || (c.pressed & BTN.JUMP) || (c.input & BTN.DOWN);
    if (wants || f.stateFrame >= D + CONFIG.RESPAWN_PLATFORM_FRAMES) {
      f.invuln = CONFIG.RESPAWN_INVULN;
      f.jumpsLeft = st.airJumps;
      f.vx = 0;
      if (c.pressed & BTN.JUMP) { f.buf &= ~BTN.JUMP; f.vy = -st.jumpVel; enterAir(f, 'jump'); }
      else { f.vy = 0; enterAir(f, 'fall'); }
    }
  },

  // Jump startup. Leaving the ground: JUMP still held = full hop, released = short hop.
  jumpsquat(c) {
    const { f, st } = c;
    if (f.stateFrame >= st.jumpSquat) {
      f.vy = -((c.input & BTN.JUMP) ? st.jumpVel : st.shortHopVel);
      f.vx = clamp(f.vx, -st.jumpMaxH, st.jumpMaxH);
      enterAir(f, 'jump');
    }
  },

  air(c) {
    const { f, st } = c;
    // Double jump
    if ((c.pressed & BTN.JUMP) && f.jumpsLeft > 0) {
      f.buf &= ~BTN.JUMP;
      f.jumpsLeft--;
      f.vy = -st.doubleJumpVel;
      f.fastFall = 0;
      if (c.dir) f.vx = c.dir * st.doubleJumpH;
      f.anim = 'djump'; f.animFrame = 0;
    }
    const attacked = tryAerial(c);
    if (attacked || (c.pressed & BTN.JUMP)) f.tumbling = 0;
    // The down press that starts a down air does not also fast fall.
    if (attacked) c.pressed &= ~BTN.DOWN;
    airMotion(c);
    if (attacked) return;

    if (f.tumbling) { /* keep the tumble animation */ }
    else if (!(f.anim === 'djump' && f.animFrame < st.doubleJumpAnimFrames)) {
      setAnim(f, f.vy < 0 ? 'jump' : 'fall');
    }
  },

  // Hanging from a ledge. Toward the stage (or up) = get up, jump = ledge jump,
  // down or away = let go, attack = ledge attack. (Ledge roll, intangibility
  // and trumping arrive with milestone 3.)
  ledge(c) {
    const { f, st } = c;
    if (f.stateFrame < st.ledgeMinHang) return;
    if (c.pressed & BTN.ATTACK) {
      // Ledge attack: he is on the stage from now on; the move lifts him up.
      const l = getStage(c.match.stageId).ledges[f.ledge];
      f.grounded = 1; f.ground = l.solid; f.vx = 0; f.vy = 0;
      startMove(f, 'ledgeAttack', false);
      return;
    }
    if (c.pressed & BTN.JUMP) {
      f.buf &= ~BTN.JUMP;
      f.ledge = -1; f.ledgeCd = CONFIG.LEDGE_REGRAB_FRAMES;
      f.vy = -st.ledgeJumpVel; f.vx = f.facing * st.ledgeJumpH;
      enterAir(f, 'jump');
    } else if (c.dir === f.facing || (c.input & BTN.UP)) {
      setState(f, 'ledgeGetup', 'ledgeGetup');
    } else if ((c.input & BTN.DOWN) || c.dir === -f.facing) {
      f.ledge = -1; f.ledgeCd = CONFIG.LEDGE_REGRAB_FRAMES;
      enterAir(f, 'fall');
    }
  },

  // Climb up: rise beside the wall, then step onto the stage.
  ledgeGetup(c) {
    const { f, st } = c;
    const l = getStage(c.match.stageId).ledges[f.ledge];
    const rise = st.ledgeGetupFrames - 7;
    if (f.stateFrame <= rise) {
      f.y = l.y * FX + Math.trunc((st.ledgeHang * (rise - f.stateFrame)) / rise);
    } else {
      f.y = l.y * FX;
      f.x += f.facing * FX * 2;
    }
    if (f.stateFrame >= st.ledgeGetupFrames) {
      f.grounded = 1; f.ground = l.solid; f.ledge = -1;
      f.vx = 0; f.vy = 0;
      setState(f, 'idle', 'idle');
    }
  },

  // Any attack. Ground moves slide to a stop; aerials keep normal air control.
  // On frame `faf` (first actionable frame) the fighter can act again.
  attack(c) {
    const { f, st } = c;
    const mv = c.ch.moves[f.move];
    if (mv.fromLedge && f.ledge >= 0) {
      // Climbing up from the ledge, then stepping onto the stage.
      const l = getStage(c.match.stageId).ledges[f.ledge];
      const rise = mv.fromLedge.rise;
      if (f.stateFrame <= rise) f.y = l.y * FX + Math.trunc((st.ledgeHang * (rise - f.stateFrame)) / rise);
      else { f.y = l.y * FX; if (f.stateFrame <= rise + 4) f.x += f.facing * FX * 2; else f.ledge = -1; }
      f.vx = 0;
    } else if (f.moveAir) airMotion(c);
    else f.vx = approach(f.vx, 0, mv.slide ? mv.slide.friction : st.traction);
    // combo link (jab 1 -> 2 -> 3)
    if (mv.next && (c.pressed & BTN.ATTACK) && f.stateFrame >= mv.next.from) { startMove(f, mv.next.move, false); return; }
    if (f.stateFrame < mv.faf) return;
    f.move = '';
    f.ledge = -1;
    if (f.moveAir) { setState(f, 'air', f.vy < 0 ? 'jump' : 'fall'); STATES.air(c); return; } // act on this same frame
    if (mv.endsCrouched && (c.input & BTN.DOWN)) { setState(f, 'crouch', 'crouch'); f.animFrame = 99; }
    else setState(f, 'idle', 'idle');
    STATES[f.state](c); // act on this same frame
  },

  // Launched or flinching. Knockback speed decays every frame; in the air,
  // gravity builds up separately on top of it.
  hitstun(c) {
    const { f, st } = c;
    f.kbSpeed = Math.max(0, f.kbSpeed - CONFIG.KB_DECAY - (f.grounded ? st.traction : 0));
    const kbx = mulTrig(f.kbSpeed, cosDeg(f.kbAngle));
    const kby = -mulTrig(f.kbSpeed, sinDeg(f.kbAngle));
    if (f.grounded) { f.vx = kbx; f.vy = 0; }
    else {
      f.gv = Math.min(f.gv + st.gravity, st.fallSpeed);
      f.vx = kbx;
      f.vy = kby + f.gv;
    }
    if (f.stateFrame >= f.hitstun) {
      f.hitstun = 0;
      if (f.grounded) setState(f, 'idle', 'idle');
      else if (f.anim === 'tumble') {
        // Hitstun is over but he keeps tumbling until he acts. Landing like
        // this is a knockdown.
        f.vy = Math.min(f.vy, st.fallSpeed); // momentum carries over
        f.tumbling = 1;
        setState(f, 'air', 'tumble');
      } else setState(f, 'air', 'fall');
    }
  },

  // Lying on the floor after a missed tech. Attack = getup attack,
  // left/right = roll that way, jump or up = stand up.
  knockdown(c) {
    const { f, st } = c;
    f.vx = approach(f.vx, 0, st.traction);
    if (f.stateFrame < CONFIG.KNOCKDOWN_MIN) return;
    if (c.pressed & BTN.ATTACK) { startMove(f, 'getupAttack', false); return; }
    if (c.dir) {
      f.facing = c.dir;
      f.intangible = CONFIG.GETUP_INTANGIBLE;
      setState(f, 'getupRoll', 'getupRoll');
      return;
    }
    if ((c.pressed & BTN.JUMP) || (c.input & BTN.UP) || f.stateFrame >= CONFIG.KNOCKDOWN_MAX) {
      f.buf &= ~BTN.JUMP;
      f.intangible = CONFIG.GETUP_INTANGIBLE;
      setState(f, 'getupStand', 'getupStand');
    }
  },
  getupStand(c) {
    c.f.vx = 0;
    if (c.f.stateFrame >= CONFIG.GETUP_STAND_FRAMES) setState(c.f, 'idle', 'idle');
  },
  getupRoll(c) {
    const { f, st } = c;
    f.vx = f.stateFrame < st.getupRollFrames - 4 ? f.facing * st.getupRollSpeed : 0;
    if (f.stateFrame >= st.getupRollFrames) { f.vx = 0; setState(f, 'idle', 'idle'); }
  },

  land(c) {
    const { f, st } = c;
    f.vx = approach(f.vx, 0, st.traction);
    if (f.stateFrame >= f.landLag) {
      if (tryGroundAttack(c) || tryJump(c)) return;
      setState(f, 'idle', 'idle');
    }
  },
};

// Advance one fighter by one tick using only its previous state and this
// frame's input bitmask.
export function updateFighter(match, f, input) {
  const ch = getCharacter(f.charId);
  const st = ch.stats;
  const pressed = input & ~f.prevIn;
  let dir = 0;
  if (input & BTN.LEFT) dir -= 1;
  if (input & BTN.RIGHT) dir += 1;

  // Double-tap detection for dashing.
  let tap = 0;
  if (pressed & BTN.LEFT) tap = -1; else if (pressed & BTN.RIGHT) tap = 1;
  let dashInput = tap !== 0 && tap === f.tapDir && f.tapTimer > 0 ? tap : 0;
  if (tap) { f.tapDir = tap; f.tapTimer = CONFIG.DOUBLE_TAP_WINDOW; }
  else if (f.tapTimer > 0) f.tapTimer--;

  // Input buffer. Jump and attack presses, and double-tap dashes, are
  // remembered for a few frames so that pressing slightly early (during the
  // end of an attack, a landing, hitlag...) still works the moment it can.
  // As in Smash Ultimate, a buffered button that is still being held stays
  // buffered for as long as it is held, so pressing jump early during an
  // aerial and keeping it down jumps on the very first frame possible.
  const BUFFERED = BTN.JUMP | BTN.ATTACK;
  if (pressed & BUFFERED) { f.buf |= pressed & BUFFERED; f.bufTimer = CONFIG.BUFFER_FRAMES; }
  else if (f.buf & input) { f.buf &= input; f.bufTimer = CONFIG.BUFFER_FRAMES; }
  else if (f.bufTimer > 0 && --f.bufTimer === 0) f.buf = 0;
  if (dashInput) { f.dashBuf = dashInput; f.dashBufTimer = CONFIG.BUFFER_FRAMES; }
  else if (f.dashBufTimer > 0 && --f.dashBufTimer === 0) f.dashBuf = 0;
  if (!dashInput && f.dashBuf && dir === f.dashBuf) dashInput = f.dashBuf; // still holding that way

  f.stateFrame++;
  f.animFrame++;
  if (f.invuln > 0) f.invuln--;
  if (f.ledgeCd > 0) f.ledgeCd--;
  if (f.intangible > 0) f.intangible--;
  STATES[f.state]({ match, f, ch, st, input, pressed: pressed | f.buf, dir, tap, dashInput });
  f.prevIn = input;
}
