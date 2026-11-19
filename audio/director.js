// Sound director: works out which sounds to play by comparing the game state
// with how it looked one tick earlier. It only reads the state, so sound can
// never change a match (and replays stay identical with or without it).
//
//   const d = new SoundDirector();
//   for (const e of d.update(state)) sfx.play(e.name, e.strength, e.pan);
import { getCharacter } from '../characters/index.js';
import { teamsLeft } from '../engine/sim.js';

const DODGES = { roll: 1, spotdodge: 1, airdodge: 1, ledgeRoll: 1 };

export class SoundDirector {
  constructor() { this.reset(); }
  reset() { this.prev = null; this.balls = new Map(); }

  update(state) {
    const out = [];
    const prev = this.prev;
    const snap = state.fighters.map((f) => ({
      state: f.state, move: f.move, stateFrame: f.stateFrame, grounded: f.grounded, jumpsLeft: f.jumpsLeft,
      lastHitTick: f.lastHitTick, shieldHitTick: f.shieldHitTick, parryTick: f.parryTick, counterTick: f.counterTick,
      fastFall: f.fastFall, charge: f.charge,
    }));
    if (prev) {
      state.fighters.forEach((f, i) => {
        const w = prev[i];
        const pan = Math.max(-0.8, Math.min(0.8, (f.x / 256 - 240) / 300));
        const add = (name, strength = 1) => out.push({ name, strength, pan });
        const ch = getCharacter(f.charId);

        // --- being hit, blocking ---
        if (f.lastHitTick !== w.lastHitTick && f.lastHitTick >= 0) {
          const d = f.lastHitDmg;
          add(d >= 120 ? 'hitL' : d >= 60 ? 'hitM' : 'hitS', 0.7 + d / 250);
        }
        if (f.shieldHitTick !== w.shieldHitTick && f.shieldHitTick >= 0) add('shieldHit');
        if (f.parryTick !== w.parryTick && f.parryTick >= 0) add('parry');
        if (f.counterTick !== w.counterTick && f.counterTick >= 0) add('counter');

        // --- state changes ---
        if (f.state !== w.state) {
          const s = f.state;
          if (s === 'shield' && w.state !== 'shieldStun') add('shieldOn');
          else if (s === 'shieldBreak') add('shieldBreak');
          else if (DODGES[s]) add('dodge');
          else if (s === 'tech' || s === 'techWall') add('tech');
          else if (s === 'getupRoll') { add('dodge'); if (w.state !== 'knockdown') add('tech'); }
          else if (s === 'holding') add('grab');
          else if (s === 'throwing') add('throw');
          else if (s === 'ledge') add('ledge');
          else if (s === 'dead') add('ko');
          else if (s === 'out') add(teamsLeft(state) <= 1 ? 'game' : 'ko');
          else if (s === 'respawn') add('respawn');
          else if (s === 'knockdown') add('knockdown');
          else if (s === 'dash') add('dash');
          else if (s === 'brake' || s === 'turn') add('skid');
        }
        // --- jumping and landing ---
        if (w.grounded && !f.grounded && f.vy < 0 && f.state === 'air') add('jump');
        if (!w.grounded && !f.grounded && f.jumpsLeft < w.jumpsLeft && f.state === 'air') add('djump');
        if (!w.grounded && f.grounded && f.state !== 'knockdown' && f.state !== 'dead') add(w.fastFall || f.state === 'attack' ? 'landHard' : 'land');
        if (f.fastFall && !w.fastFall) add('fastfall');
        if (f.grounded && (f.state === 'run' || f.state === 'dash') && f.stateFrame % 9 === 1 && f.stateFrame !== w.stateFrame) add('step');
        if (f.grounded && f.state === 'walk' && f.stateFrame % 14 === 1 && f.stateFrame !== w.stateFrame) add('step', 0.6);

        // --- attacks and specials ---
        const mv = f.state === 'attack' && f.move ? ch.moves[f.move] : null;
        if (mv) {
          const started = f.move !== w.move || w.state !== 'attack';
          if (started && mv.counter) add('flick');
          // while a charge is held: a rising tick
          if (mv.charge && f.charge !== w.charge && f.charge > 0 && f.charge % 8 === 0) add('charge', f.charge / mv.charge.max);
          // things that happen on one exact frame of the move (frozen during hitlag)
          if (f.stateFrame !== w.stateFrame || started) {
            const fr = f.stateFrame;
            if (!mv.deck) {
              let dmg = -1;
              for (const hb of mv.hitboxes) if (hb.frames[0] === fr) dmg = Math.max(dmg, hb.chargeScale ? hb.chargeScale[0] : hb.damage);
              if (dmg >= 0) add(dmg >= 120 ? 'swingL' : dmg >= 60 ? 'swingM' : 'swingS');
            }
            if (mv.grab && mv.grab.frames && mv.grab.frames[0] === fr) add('swingS');
            if (mv.rocket && fr === mv.rocket.frame) add(mv.burst ? 'misfire' : mv.wear ? 'skate' : 'rocket');
            if (mv.plunge && fr === mv.plunge.frame) add(mv.wear ? 'skate' : 'jump');
            if (mv.plunge && fr === mv.plunge.fallAt) add('swingL');
            if (mv.fly && fr >= mv.fly.frame && fr <= mv.fly.frame + mv.fly.frames && fr % 5 === 0) add('prop');
            if (mv.deck && fr === mv.deck.blast) add('bass', 0.6 + (mv.charge ? f.charge / mv.charge.max : 0));
            if (mv.teleport && fr === mv.teleport.vanish) add('warpOut');
            if (mv.teleport && fr === mv.teleport.appear) add('warpIn');
          }
        }
      });
    }
    // --- the kill screen: a heavy crack when it starts ---
    if (state.killCam && state.killFreeze > 0 && (!this.killTick || this.killTick !== state.killCam.tick)) {
      this.killTick = state.killCam.tick;
      out.push({ name: 'hitL', strength: 1.6, pan: 0 }); out.push({ name: 'bass', strength: 1, pan: 0 });
    }
    // --- projectiles: thrown, bouncing, caught ---
    const balls = new Map();
    for (const p of state.projectiles || []) {
      const key = p.owner + ':' + p.kind + ':' + p.born;
      const d = getCharacter(p.charId).projectiles[p.kind];
      const pan = Math.max(-0.8, Math.min(0.8, (p.x / 256 - 240) / 300));
      const was = this.balls.get(key);
      if (!was && prev && p.boom) { out.push({ name: 'bass', strength: 1, pan }); out.push({ name: 'hitL', strength: 1, pan }); }   // went off in someone's hand
      else if (!was && prev && !d.silent) out.push({ name: { vape: 'vape', arrow: 'arrow', wave: 'wave', card: 'vape', ace: 'vape', cork: 'arrow', butt: 'arrow', cloud: 'vape', oil: 'arrow', bomb: 'throw', frisbee: 'vape', vball: 'shoot', cookie: 'arrow', truck: 'rocket' }[d.draw] || 'shoot', strength: 1, pan });
      else if (was && p.boom && !was.boom) { out.push({ name: 'bass', strength: 1, pan }); out.push({ name: 'hitL', strength: 1, pan }); }
      else if (was && p.bounces > was.bounces) out.push({ name: 'bounce', strength: 1, pan });
      balls.set(key, { bounces: p.bounces, boom: p.boom | 0, draw: d.draw, pan });
    }
    for (const [key, was] of this.balls) if (!balls.has(key) && (was.draw === 'vape' || was.draw === 'frisbee')) out.push({ name: 'catch', strength: 1, pan: was.pan });
    this.balls = balls;
    this.prev = snap;
    return out;
  }
}
