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
    shieldChance: 0.35,    // when the opponent attacks nearby
    dodgeChance: 0.12,     // spot dodge instead of shielding
    bluffChance: 0.08,     // Bluff (counter) instead of shielding
    jumpInChance: 0.3,     // approach with a short hop aerial
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
    this.seen.push({ x: opp.x, y: opp.y, state: opp.state, move: opp.move, grounded: opp.grounded, facing: opp.facing, invuln: opp.invuln });
    if (this.seen.length > 30) this.seen.shift();
    const view = this.seen[Math.max(0, this.seen.length - 1 - this.cfg.reaction)];

    if (me.state === 'dead' || me.state === 'out') { this.queue = []; return 0; }
    if (me.state !== 'ledge') this.ledgeTimer = -1;
    if (me.state !== 'knockdown') this.downTimer = -1;

    // --- things every level does ---
    if (me.state === 'dizzy') return (state.tick & 1) ? BTN.ATTACK : BTN.JUMP;   // mash
    if (me.state === 'ledge') return this.onLedge(me);
    if (me.state === 'knockdown') return this.onKnockdown(me, opp);
    if (me.state === 'respawn') return this.cfg.fights && me.stateFrame > 40 ? BTN.DOWN : 0;
    const rec = this.recover(me, stage);
    if (rec !== null) { this.queue = []; return rec; }

    if (!this.cfg.fights) return 0;

    // --- fighter ---
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
    if (me.state === 'airdodge' || me.state === 'attack' || me.state === 'jumpsquat') return 0;
    const ledge = x < main.x + main.w / 2 ? stage.ledges[0] : stage.ledges[1];
    const toStage = x < ledge.x ? 1 : -1;
    const dx = Math.abs(ledge.x - x), dy = y - ledge.y;   // dy > 0: below the ledge
    let m = toStage > 0 ? BTN.RIGHT : BTN.LEFT;
    // double jump once it drops to about ledge height
    if (me.jumpsLeft > 0 && me.vy >= 0 && dy > -8) return m | this.press(BTN.JUMP);
    // out of jumps and still low: air dodge up toward the ledge if it can reach
    if (me.jumpsLeft === 0 && !me.airDodged && me.vy > 0 && dy > 4 && dy < 26 && dx < 34) {
      return m | BTN.UP | this.press(BTN.SHIELD);
    }
    return m;
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

    // --- defend: they are attacking close by ---
    if (view.state === 'attack' && adx < 40 && ady < 34) {
      const r = this.rand();
      if (r < c.bluffChance) return BTN.SPECIAL | BTN.DOWN;
      if (r < c.bluffChance + c.dodgeChance) { this.queue = [BTN.SHIELD | BTN.DOWN]; return BTN.SHIELD; }
      if (r < c.bluffChance + c.dodgeChance + c.shieldChance) {
        this.queue = new Array(this.between([10, 20])).fill(BTN.SHIELD);
        return BTN.SHIELD;
      }
    }
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

    // --- close: attack ---
    if (adx < 26 && ady < 30) {
      if (!inFront) return toward;                                   // turn around first
      if (dy < -22 * FX) return BTN.ATTACK | BTN.UP;                 // above: up tilt
      if (view.state === 'knockdown') return BTN.ATTACK | BTN.DOWN;  // lying down: down tilt
      const pick = this.rand();
      if (pick < 0.3) { this.queue = [0, 0, 0, 0, BTN.ATTACK, 0, 0, 0, 0, BTN.ATTACK]; return BTN.ATTACK; } // jab 1-2-3
      if (pick < 0.55) return BTN.ATTACK | toward;                   // forward tilt
      if (pick < 0.75) return BTN.ATTACK | BTN.DOWN;                 // down tilt
      if (pick < 0.88) { this.queue = [0, 0, 0, BTN.ATTACK]; return BTN.JUMP; } // short hop neutral air
      return BTN.ATTACK | BTN.UP;
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
