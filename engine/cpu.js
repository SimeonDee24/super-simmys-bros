// CPU players. A CPU is just another input source: every frame it looks at
// the GAME STATE (never at the other player's inputs) and returns the same
// kind of button bitmask a keyboard would. Its decisions use its own seeded
// random numbers, so a match against the CPU replays identically.
//
// Levels (tunable below):
//   dummy   - training dummy: stands still, but recovers to the stage, takes
//             ledge options, gets up from knockdowns and mashes out of dizzy.
//   fighter - actually plays: approaches, attacks, uses aerials, shields,
//             edgeguards a little, and recovers.
import { BTN } from './input.js';
import { FX } from './fixed.js';
import { getStage } from '../stages/index.js';
import { getCharacter } from '../characters/index.js';

export const CPU_LEVELS = {
  dummy: {
    label: 'TRAINING DUMMY',
    fights: false,
    reaction: 0,
    ledgeWait: [20, 60],
    ledgeOptions: { getup: 5, roll: 3, jump: 2, attack: 0 },
    getupWait: [10, 40],
  },
  fighter: {
    label: 'FIGHTER',
    fights: true,
    reaction: 10,          // frames late it sees the opponent (no reading inputs)
    thinkEvery: [3, 7],    // frames between decisions
    // Defence. Each threat (an attack starting nearby, a dash or jump in, a
    // ball coming at it) gets one roll of the dice:
    defendReaction: 5,     // frames late it notices a threat (faster than its attacks)
    defendChance: 0.6,     // how often it defends at all, rather than ignoring the threat
    defendMix: { shield: 5, spotDodge: 2, roll: 2, bluff: 1 },   // ...and how
    airDodgeChance: 0.35,  // in the air: dodge an attack that is close
    oosMix: { grab: 3, roll: 2, drop: 3, jump: 2 },             // after blocking: out of shield
    bluffChance: 0.08,     // (kept for menus) Bluff instead of shielding
    jumpInChance: 0.3,     // approach with a short hop aerial
    shootChance: 0.18,
    grabChance: 0.15,      // grab when close (much more often if they are shielding)
    mashes: true,          // mashes out of grabs     // Jump Shot from mid or far range (charges a random amount)
    dashAttackChance: 0.25,
    edgeguard: true,
    ledgeWait: [6, 40],
    ledgeOptions: { getup: 4, roll: 3, jump: 3, attack: 3 },
    getupWait: [4, 20],
  },
};

const ACTIONABLE_GROUND = { idle: 1, walk: 1, dash: 1, run: 1, brake: 1, crouch: 1, crawl: 1 };

export class CpuController {
  constructor(level = 'fighter', seed = 1) {
    this.level = level;
    this.cfg = CPU_LEVELS[level];
    this.rng = (seed | 0) || 1;
    this.queue = [];        // planned inputs, one bitmask per frame
    this.last = 0;          // what it pressed last frame
    this.wait = 0;          // frames until it decides again
    this.seen = [];         // snapshots of the opponent, for reaction delay
    this.ledgeTimer = -1;
    this.downTimer = -1;
    this.lastThreat = null; // the last threat it judged
    this.oosPending = false;
  }

  rand() { let x = this.rng; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.rng = x | 0; return (x >>> 0) / 4294967296; }
  between([a, b]) { return a + Math.floor(this.rand() * (b - a + 1)); }
  weighted(opts) {
    const total = Object.values(opts).reduce((s, w) => s + w, 0);
    let r = this.rand() * total;
    for (const [k, w] of Object.entries(opts)) { if ((r -= w) < 0) return k; }
    return Object.keys(opts)[0];
  }

  // A press only counts if the button was up last frame, so held buttons
  // are released for a frame before pressing them again.
  press(mask) { return mask & ~this.last ? mask : 0; }

  sample(state, slot) {
    const out = this.decide(state, slot) | 0;
    this.last = out;
    return out;
  }

  decide(state, slot) {
    const me = state.fighters[slot];
    const opp = state.fighters[1 - slot];
    const stage = getStage(state.stageId);

    // remember what the opponent looked like, to react a little late
    this.seen.push({ x: opp.x, y: opp.y, vx: opp.vx, vy: opp.vy, state: opp.state, move: opp.move, grounded: opp.grounded, facing: opp.facing, invuln: opp.invuln, start: state.tick - opp.stateFrame });
    if (this.seen.length > 30) this.seen.shift();
    const view = this.seen[Math.max(0, this.seen.length - 1 - this.cfg.reaction)];

    if (me.state === 'dead' || me.state === 'out') { this.queue = []; return 0; }
    if (me.state !== 'ledge') this.ledgeTimer = -1;
    if (me.state !== 'knockdown') this.downTimer = -1;

    // --- things every level does ---
    if (me.state === 'dizzy') return (state.tick & 1) ? BTN.ATTACK : BTN.JUMP;   // mash
    if (me.state === 'ledge') return this.onLedge(me);
    if (me.state === 'knockdown') return this.onKnockdown(me, opp);
    if (me.state === 'grabbed') return this.cfg.mashes && (state.tick & 1) ? BTN.ATTACK : 0;
    if (me.state === 'holding') return this.onHolding(me, stage);
    if (me.state === 'respawn') return this.cfg.fights && me.stateFrame > 40 ? BTN.DOWN : 0;
    const rec = this.recover(me, stage);
    if (rec !== null) { this.queue = []; return rec; }

    if (!this.cfg.fights) return 0;

    // --- fighter ---
    const dv = this.seen[Math.max(0, this.seen.length - 1 - this.cfg.defendReaction)];
    const def = this.defend(state, me, dv, slot);
    if (def !== null) return def;
    if (this.queue.length) return this.queue.shift();
    if (this.wait > 0) { this.wait--; return this.hold(me); }
    this.wait = this.between(this.cfg.thinkEvery);
    return this.think(me, opp, view, stage);
  }

  // Keep holding shield while shielding, otherwise nothing.
  hold(me) { return me.state === 'shield' ? BTN.SHIELD : 0; }

  // ---------------------------------------------------------------------------
  // Recovery: back to the stage when off it. Returns null when not needed.
  recover(me, stage) {
    if (me.grounded || me.state === 'hitstun' || me.hitlag > 0) return null;
    const main = stage.solids[0];
    const x = me.x / FX, y = me.y / FX;
    const off = x < main.x - 1 || x > main.x + main.w + 1;
    const below = y > main.y + 2;
    if (!off && !below) return null;
    const ledge = x < main.x + main.w / 2 ? stage.ledges[0] : stage.ledges[1];
    const toStage = x < ledge.x ? 1 : -1;
    // mid-move: just steer toward the stage (matters for the up special)
    if (me.state === 'attack') return toStage > 0 ? BTN.RIGHT : BTN.LEFT;
    if (me.state === 'airdodge' || me.state === 'jumpsquat') return 0;
    const dx = Math.abs(ledge.x - x), dy = y - ledge.y;   // dy > 0: below the ledge
    let m = toStage > 0 ? BTN.RIGHT : BTN.LEFT;
    // double jump once it drops to about ledge height
    if (me.jumpsLeft > 0 && me.vy >= 0 && dy > -8) return m | this.press(BTN.JUMP);
    // out of jumps and well below the ledge: up special
    if (me.jumpsLeft === 0 && me.state === 'air' && me.vy > 0 && dy > 30) return m | BTN.UP | this.press(BTN.SPECIAL);
    // out of jumps and still low: air dodge up toward the ledge if it can reach
    if (me.jumpsLeft === 0 && !me.airDodged && me.vy > 0 && dy > 4 && dy < 26 && dx < 34) {
      return m | BTN.UP | this.press(BTN.SHIELD);
    }
    return m;
  }

  // Holding someone: a couple of pummels, then throw them toward the nearer
  // edge (forward or back), or up / down to start a combo at low percent.
  onHolding(me, stage) {
    if (me.pummelFrame > 0) return 0;
    if (this.pummels === undefined) this.pummels = this.between([0, 2]);
    if (this.pummels > 0 && me.stateFrame > 4) { this.pummels--; return this.press(BTN.ATTACK); }
    if (me.stateFrame < 6) return 0;
    this.pummels = undefined;
    const main = stage.solids[0];
    const toLeftEdge = me.x - main.x * FX, toRightEdge = (main.x + main.w) * FX - me.x;
    const edgeDir = toLeftEdge < toRightEdge ? -1 : 1;
    const r = this.rand();
    if (r < 0.25) return BTN.UP;
    if (r < 0.4) return BTN.DOWN;
    return edgeDir > 0 ? BTN.RIGHT : BTN.LEFT;   // forward or back throw, whichever faces the edge
  }

  onLedge(me) {
    if (this.ledgeTimer < 0) this.ledgeTimer = this.between(this.cfg.ledgeWait);
    if (this.ledgeTimer-- > 0) return 0;
    this.ledgeTimer = 999;   // act once
    const pick = this.weighted(this.cfg.ledgeOptions);
    const toStage = me.facing > 0 ? BTN.RIGHT : BTN.LEFT;
    return { getup: toStage, roll: BTN.SHIELD, jump: BTN.JUMP, attack: BTN.ATTACK }[pick];
  }

  onKnockdown(me, opp) {
    if (this.downTimer < 0) this.downTimer = this.between(this.cfg.getupWait);
    if (this.downTimer-- > 0) return 0;
    const close = Math.abs(opp.x - me.x) < 30 * FX;
    if (this.cfg.fights && close && this.rand() < 0.5) return BTN.ATTACK;
    const r = this.rand();
    if (r < 0.5) return BTN.UP;
    return r < 0.75 ? BTN.LEFT : BTN.RIGHT;
  }

  // ---------------------------------------------------------------------------
  // Fighting. Looks at where the opponent was `reaction` frames ago.
  think(me, opp, view, stage) {
    const c = this.cfg;
    if (opp.state === 'dead' || opp.state === 'out') return this.walkTo(me, stage.respawn.x * FX);
    const dx = view.x - me.x, dy = view.y - me.y;       // dy < 0: opponent above
    const adx = Math.abs(dx) / FX, ady = Math.abs(dy) / FX;
    const toward = dx > 0 ? BTN.RIGHT : BTN.LEFT;
    const away = dx > 0 ? BTN.LEFT : BTN.RIGHT;
    const inFront = (dx > 0) === (me.facing > 0);
    const main = stage.solids[0];
    const oppOff = view.x < main.x * FX || view.x > (main.x + main.w) * FX || view.y > main.y * FX + 4 * FX;

    // --- in the air: pick an aerial when close ---
    if (!me.grounded) {
      if (me.state !== 'air') return 0;
      if (adx < 26 && ady < 30) {
        if (dy < -14 * FX && adx < 16) return BTN.ATTACK | BTN.UP;                 // above: up air
        if (dy > 18 * FX && adx < 14) return BTN.ATTACK | BTN.DOWN;                // below: stomp
        if (!inFront) return BTN.ATTACK | away;                                     // behind: back air
        return BTN.ATTACK | (this.rand() < 0.5 ? toward : 0);                       // forward or neutral air
      }
      return toward;   // drift toward them
    }
    if (!ACTIONABLE_GROUND[me.state] && me.state !== 'shield' && me.state !== 'land') return 0;

    if (me.state === 'shield') return 0;   // drop shield when nothing is coming

    // --- edgeguard: they are off the stage ---
    if (oppOff && c.edgeguard) {
      const edgeX = (dx > 0 ? main.x + main.w - 12 : main.x + 12) * FX;
      if (Math.abs(edgeX - me.x) > 10 * FX) return this.walkTo(me, edgeX);
      if (view.state === 'ledge' || adx < 26) {
        if (!inFront) return toward;
        return this.rand() < 0.5 ? BTN.ATTACK | BTN.DOWN : BTN.ATTACK | toward;     // poke at the edge
      }
      return 0;
    }

    // --- they are invincible (just respawned): back off ---
    if (view.invuln > 0) return adx < 50 ? away : 0;

    // --- close: attack (or grab, especially a shield) ---
    if (adx < 26 && ady < 30) {
      if (!inFront) return toward;                                   // turn around first
      if (adx < 20 && ady < 10 && (view.state === 'shield' || this.rand() < c.grabChance)) return BTN.GRAB;
      if (dy < -22 * FX) return BTN.ATTACK | BTN.UP;                 // above: up tilt
      if (view.state === 'knockdown') return BTN.ATTACK | BTN.DOWN;  // lying down: down tilt
      const pick = this.rand();
      if (pick < 0.3) { this.queue = [0, 0, 0, 0, BTN.ATTACK, 0, 0, 0, 0, BTN.ATTACK]; return BTN.ATTACK; } // jab 1-2-3
      if (pick < 0.55) return BTN.ATTACK | toward;                   // forward tilt
      if (pick < 0.75) return BTN.ATTACK | BTN.DOWN;                 // down tilt
      if (pick < 0.88) { this.queue = [0, 0, 0, BTN.ATTACK]; return BTN.JUMP; } // short hop neutral air
      return BTN.ATTACK | BTN.UP;
    }

    // --- mid or far: sometimes take a Jump Shot ---
    if (adx >= 40 && adx < 200 && inFront && this.rand() < c.shootChance) {
      const hold = this.between([0, 40]);
      this.queue = new Array(hold).fill(BTN.SPECIAL);
      return BTN.SPECIAL;
    }

    // --- mid range: come in ---
    if (adx < 60) {
      const r = this.rand();
      if ((me.state === 'run' || me.state === 'dash') && inFront && adx < 46 && r < c.dashAttackChance) return BTN.ATTACK;
      if (r < c.jumpInChance) { this.queue = [toward, toward, toward, toward | BTN.ATTACK]; return BTN.JUMP | toward; }
      return toward;
    }

    // --- far: dash in ---
    if (me.state === 'run' || me.state === 'dash') return toward;
    this.queue = [0, toward, toward, toward, toward];
    return toward;
  }

  // ---------------------------------------------------------------------------
  // Defence: shield, spot dodge, roll, Bluff, or air dodge when something is
  // coming. Each threat is judged once (keyed by when it started), so it does
  // not re-roll every frame. Returns null when there is nothing to react to.
  defend(state, me, v, slot) {
    const c = this.cfg;
    const dx = v.x - me.x, dy = v.y - me.y, adx = Math.abs(dx) / FX, ady = Math.abs(dy) / FX;
    const towardMe = dx > 0 ? v.vx < 0 : v.vx > 0;
    const away = dx > 0 ? BTN.LEFT : BTN.RIGHT, toward = dx > 0 ? BTN.RIGHT : BTN.LEFT;

    // Blocked something: choose an out-of-shield option once the stun ends.
    if (me.state === 'shieldStun') { this.queue = []; this.oosPending = true; return BTN.SHIELD; }
    if (me.state === 'shield' && this.oosPending) {
      this.oosPending = false;
      const pick = this.weighted(c.oosMix);
      if (pick === 'grab' && adx < 24) { this.queue = []; return BTN.SHIELD | BTN.ATTACK; }
      if (pick === 'roll') { this.queue = [BTN.SHIELD | away]; return BTN.SHIELD; }
      if (pick === 'jump') { this.queue = [0, 0, 0, BTN.ATTACK | (this.rand() < 0.5 ? toward : 0)]; return BTN.JUMP; }
      this.queue = []; return 0;
    }

    let key = null;
    if (v.state === 'attack' && adx < 46 && ady < 40) key = 'atk' + v.start;
    else if ((v.state === 'dash' || v.state === 'run') && towardMe && adx < 42 && ady < 20) key = 'run' + v.start;
    else if (!v.grounded && v.state === 'air' && towardMe && adx < 34 && dy < 0 && dy > -50 * FX) key = 'jump' + v.start;
    else {
      // a ball heading this way
      for (const p of state.projectiles || []) {
        if (p.owner === slot) continue;
        const pdx = (me.x - p.x) / FX, pdy = (me.y - 20 * FX - p.y) / FX;
        if (Math.abs(pdx) < 60 && Math.abs(pdy) < 30 && Math.sign(pdx) === Math.sign(p.vx)) { key = 'ball' + p.born; break; }
      }
    }
    if (!key || key === this.lastThreat) return null;
    this.lastThreat = key;
    if (this.rand() >= c.defendChance) return null;

    // in the air: air dodge (away from them, or straight if they are below)
    if (!me.grounded) {
      if (me.state !== 'air' || me.airDodged || this.rand() >= c.airDodgeChance / c.defendChance) return null;
      this.queue = [];
      return BTN.SHIELD | (dy > 10 * FX ? 0 : away);
    }
    const ACT = { idle: 1, walk: 1, dash: 1, run: 1, brake: 1, crouch: 1, crawl: 1, land: 1, shield: 1 };
    if (!ACT[me.state]) return null;
    const pick = this.weighted(c.defendMix);
    if (pick === 'bluff' && me.state !== 'shield') { this.queue = []; return BTN.SPECIAL | BTN.DOWN; }
    if (pick === 'spotDodge') { this.queue = [BTN.SHIELD | BTN.DOWN]; return BTN.SHIELD; }
    if (pick === 'roll') {
      // away from them, or sometimes behind them
      this.queue = [BTN.SHIELD | (this.rand() < 0.7 ? away : toward)];
      return BTN.SHIELD;
    }
    this.queue = new Array(this.between([12, 26])).fill(BTN.SHIELD);
    return BTN.SHIELD;
  }

  // Walk (or dash if far) toward an x position.
  walkTo(me, x) {
    const d = x - me.x;
    if (Math.abs(d) < 6 * FX) return 0;
    const dir = d > 0 ? BTN.RIGHT : BTN.LEFT;
    if (Math.abs(d) > 70 * FX && me.state !== 'run' && me.state !== 'dash' && me.grounded) {
      this.queue = [0, dir, dir, dir];
      return dir;
    }
    return dir;
  }
}

// Used by menus: the order the CPU levels cycle through.
export const CPU_ORDER = ['dummy', 'fighter'];
export const cpuLabel = (level) => CPU_LEVELS[level].label;
// Characters are looked up so future CPUs can read each fighter's data.
export const cpuKnows = (charId) => !!getCharacter(charId);
