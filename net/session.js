// Rollback netcode for an online match. No networking in here: the room
// (net/room.js) hands it the other players' inputs as they arrive and sends
// out whatever lands in `outbox`.
//
// How it works. Every machine runs the same deterministic simulation.
//  - Your own buttons are scheduled `delay` frames ahead and sent at once,
//    so they usually arrive before the others need them.
//  - When someone's input for a frame has not arrived yet, the game guesses
//    they are still holding what they held last, and carries on.
//  - When the real input arrives and the guess was wrong, the game goes back
//    to the last frame where everything was known (`confirmed`) and replays
//    up to now with the right inputs. That is the rollback.
//  - If a machine gets too far ahead of what it knows, it waits.
import { createMatch, step, serialize, deserialize, hashState } from '../engine/sim.js';

export const NET = {
  DELAY: 2,          // frames between pressing a button and it taking effect (both online and for yourself)
  MAX_AHEAD: 9,      // most frames to run on guesses before waiting for the others
  HASH_EVERY: 60,    // frames between checks that every machine has the same game
  SYNC_COOLDOWN: 6,  // at most one waited frame per this many, when running ahead of the others
};

export class RollbackSession {
  // setup: what createMatch takes. local: the fighter numbers this machine supplies input for.
  constructor(setup, local, opts = {}) {
    this.n = setup.players.length;
    this.local = local.slice();
    this.delay = opts.delay ?? NET.DELAY;
    this.state = createMatch(setup);       // what is shown: may include guessed inputs
    this.confirmed = createMatch(setup);   // every input before `cframe` is real
    this.frame = 0;                        // frames simulated in `state`
    this.cframe = 0;                       // frames simulated in `confirmed`
    // inputs[p][f] = player p's real input for frame f. Nobody can press
    // anything for the first `delay` frames.
    this.inputs = Array.from({ length: this.n }, () => new Array(this.delay).fill(0));
    this.used = Array.from({ length: this.n }, () => []);   // what frame f was last simulated with
    this.ended = new Array(this.n).fill(-1);                // a player who left: no input from this frame on
    this.dirty = Infinity;                 // earliest frame simulated with a wrong guess
    this.outbox = [];                      // messages for the other machines
    this.hashes = new Map();               // frame -> hash of our confirmed state
    this.theirHashes = new Map();
    this.desync = -1;                      // frame at which the machines were found to disagree
    this.theirAhead = new Array(this.n).fill(null);   // how far ahead each remote player says they are
    this.cooldown = 0;
    this.lead = 0;                         // ahead(), smoothed so one late packet does not look like drift
    this.stats = { rollbacks: 0, resimmed: 0, maxRollback: 0, waits: 0, syncWaits: 0 };
  }

  known(p) { return this.ended[p] >= 0 ? Infinity : this.inputs[p].length; }
  // The input to simulate frame f with: the real one, or a guess.
  inputAt(p, f) {
    const a = this.inputs[p];
    if (this.ended[p] >= 0 && f >= this.ended[p]) return 0;
    if (f < a.length) return a[f];
    return a.length ? a[a.length - 1] : 0;
  }
  // How many frames this machine is ahead of the slowest player it knows about.
  ahead() {
    let slow = Infinity;
    for (let p = 0; p < this.n; p++) if (!this.local.includes(p) && this.ended[p] < 0) slow = Math.min(slow, this.inputs[p].length - this.delay);
    return slow === Infinity ? 0 : this.frame - slow;
  }

  // Real inputs from another machine: player p, frames `from` onward.
  receive(p, from, values, ahead = null) {
    if (this.local.includes(p) || this.ended[p] >= 0) return;
    if (ahead !== null) this.theirAhead[p] = ahead;
    const a = this.inputs[p];
    for (let i = 0; i < values.length; i++) {
      const f = from + i;
      if (f < a.length) continue;          // already have it
      if (f > a.length) return;            // a gap: cannot happen on an ordered link, never guess across it
      a.push(values[i] | 0);
      if (f < this.frame && this.used[p][f] !== a[f]) this.dirty = Math.min(this.dirty, f);
    }
  }
  // Player p has left: their fighter gets no input from frame f on.
  drop(p, f) {
    if (this.ended[p] >= 0) return;
    this.inputs[p].length = Math.min(this.inputs[p].length, f);
    this.ended[p] = f;
    this.local = this.local.filter((q) => q !== p);
    if (f < this.frame) this.dirty = Math.min(this.dirty, f);
  }
  receiveHash(f, h) {
    this.theirHashes.set(f, h);
    this.compare(f);
  }
  compare(f) {
    const a = this.hashes.get(f), b = this.theirHashes.get(f);
    if (a !== undefined && b !== undefined) {
      if (a !== b && this.desync < 0) this.desync = f;
      this.theirHashes.delete(f);
    }
  }

  // One 60 Hz tick. sample(p, state) returns the buttons held for local
  // player p. Returns true if the game moved on a frame, false if it waited.
  tick(sample) {
    // 1. everything known up to here becomes final
    let limit = this.frame;
    for (let p = 0; p < this.n; p++) limit = Math.min(limit, this.known(p));
    while (this.cframe < limit) {
      const f = this.cframe;
      step(this.confirmed, this.inputs.map((_, p) => this.inputAt(p, f)));
      this.cframe++;
      if (this.cframe % NET.HASH_EVERY === 0) {
        const h = hashState(this.confirmed);
        this.hashes.set(this.cframe, h);
        if (this.hashes.size > 20) this.hashes.delete(this.hashes.keys().next().value);
        this.outbox.push({ t: 'h', f: this.cframe, h });
        this.compare(this.cframe);
      }
    }
    // 2. a guess turned out wrong: replay from the last final frame
    if (this.dirty < this.frame) {
      const to = this.frame, back = to - this.cframe;
      this.state = deserialize(serialize(this.confirmed));
      this.frame = this.cframe;
      while (this.frame < to) this.advance();
      this.stats.rollbacks++; this.stats.resimmed += back; this.stats.maxRollback = Math.max(this.stats.maxRollback, back);
    }
    this.dirty = Infinity;
    this.lead += (this.ahead() - this.lead) * 0.1;
    // 3. too far ahead of what is known: wait for the others
    if (this.frame - this.cframe >= NET.MAX_AHEAD) { this.stats.waits++; return false; }
    // running ahead of the other machines: let them catch up, a frame at a time
    if (this.cooldown > 0) this.cooldown--;
    else {
      let theirs = Infinity;
      for (let p = 0; p < this.n; p++) if (this.theirAhead[p] !== null && this.ended[p] < 0) theirs = Math.min(theirs, this.theirAhead[p]);
      if (theirs !== Infinity && (this.lead - theirs) / 2 >= 1) { this.cooldown = NET.SYNC_COOLDOWN; this.stats.syncWaits++; return false; }
    }
    // 4. this frame's buttons, to take effect `delay` frames from now
    const at = this.frame + this.delay, ahead = Math.round(this.lead * 100) / 100;
    for (const p of this.local) {
      const v = sample(p, this.state) | 0;
      this.inputs[p][at] = v;
      this.outbox.push({ t: 'i', s: p, f: at, v: [v], a: ahead });
    }
    // 5. simulate
    this.advance();
    return true;
  }
  advance() {
    const f = this.frame, ins = new Array(this.n);
    for (let p = 0; p < this.n; p++) { ins[p] = this.inputAt(p, f); this.used[p][f] = ins[p]; }
    step(this.state, ins);
    this.frame++;
  }

  // The match is over once the final (not guessed) game has one fighter left.
  get over() { return this.confirmed.fighters.filter((f) => f.state !== 'out').length <= 1; }
}
