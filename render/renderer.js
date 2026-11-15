// Draws everything. The screen is laid out in 480x270 units, but the canvas
// itself is as sharp as the window allows (up to about 1080p). The match is
// seen through a zooming camera; the HUD and menus stay fixed on the screen.
// Reads the game state but never changes it.
import { CONFIG } from '../config/config.js';
import { GAME_VERSION } from '../config/version.js';
import { FX, toPx } from '../engine/fixed.js';
import { samplePose, solve, hurtboxes } from '../engine/skeleton.js';
import { activeHitboxes, jointAt, shieldRadius, shieldCentre } from '../engine/combat.js';
import { getCharacter } from '../characters/index.js';
import { getStage } from '../stages/index.js';
import { DollRenderer } from './doll.js';
import { Background } from './background.js';
import { drawLabel as drawText } from './font.js';

const W = CONFIG.SCREEN_W, H = CONFIG.SCREEN_H;
const PLAYER_COLORS = ['#ff5a5a', '#5aa2ff', '#ffd23a', '#4fd06a'];   // red, blue, yellow, green

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + Math.max(0, Math.min(1, a)).toFixed(3) + ')';
}
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), f = (v) => Math.round(v * k).toString(16).padStart(2, '0');
  return '#' + f((n >> 16) & 255) + f((n >> 8) & 255) + f(n & 255);
}
// Damage number colour: white, then redder and finally darker as it climbs.
function damageColor(p) {
  const t = Math.min(1, p / 150), d = Math.max(0, Math.min(1, (p - 150) / 150));
  const h = (v) => Math.round(v).toString(16).padStart(2, '0');
  const gb = 255 * Math.pow(1 - t, 1.25);
  return '#' + h(255 - 105 * d) + h(gb * (1 - d)) + h(gb * (1 - d));
}

// Hard-edged filled circle (render only).
function disc(ctx, cx, cy, r) {
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy));
    ctx.fillRect(Math.round(cx) - half, Math.round(cy) + dy, half * 2 + 1, 1);
  }
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.doll = new DollRenderer();
    this.bgs = new Map();   // one pre-rendered background per stage
    this.thumbs = new Map();
    this.bg = null;
    this.cam = { x: W / 2, y: H / 2, z: 1 };   // world point at the screen centre, and zoom
    this.camTick = -1;
    this.S = 1;             // real canvas pixels per screen unit (the screen is 480x270 units)
    this.maxScale = 4;      // sharpness cap: 4 = 1080p. Lowered automatically on slow machines.
    this.time = 0;
    this.effects = [];      // short-lived visual effects (render only)
    this.seen = [];         // last drawn flags per fighter, to spot changes
    this.players = [];      // per fighter in the match: { port, label } (which colour and tag they get)
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  // Who is in the match: players[i] = { port: 0-3, label: 'P1' | 'CPU' }.
  setPlayers(players) { this.players = players; }
  pcol(slot) { const p = this.players[slot]; return PLAYER_COLORS[p ? p.port : slot & 3]; }
  plabel(slot) { const p = this.players[slot]; return p ? p.label : 'P' + (slot + 1); }

  // Fill the window (keeping 16:9) and draw at the screen's real resolution,
  // up to about 1080p, so shapes and edges come out smooth.
  resize() {
    const dpr = window.devicePixelRatio || 1;
    const fit = Math.max(0.5, Math.min(window.innerWidth / W, window.innerHeight / H));
    this.canvas.style.width = Math.floor(W * fit) + 'px';
    this.canvas.style.height = Math.floor(H * fit) + 'px';
    const s = Math.max(1, Math.min(this.maxScale, fit * dpr));
    this.canvas.width = Math.round(W * s);
    this.canvas.height = Math.round(H * s);
    this.S = this.canvas.width / W;
  }

  // Called when the game is running slowly: draw at a lower resolution.
  // Returns false once it is already as low as it goes.
  lowerQuality() {
    if (this.maxScale <= 1.5) return false;
    this.maxScale = Math.max(1.5, Math.min(this.maxScale, this.S) * 0.75);
    this.resize();
    return true;
  }

  // Drawing in screen units (480x270, for the HUD and menus) or in world
  // pixels as seen through the camera.
  ui() { this.ctx.setTransform(this.S, 0, 0, this.S, 0, 0); }
  world(view = this.view) {
    const k = this.S * view.z;
    this.ctx.setTransform(k, 0, 0, k, this.S * (W / 2 - view.x * view.z), this.S * (H / 2 - view.y * view.z));
  }
  toScreen(wx, wy, view = this.view) { return [(wx - view.x) * view.z + W / 2, (wy - view.y) * view.z + H / 2]; }
  flash(alpha, color = '#ffffff') {
    const ctx = this.ctx;
    this.ui(); ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; this.world();
  }

  setStage(stage) {
    if (!this.bgs.has(stage.id)) this.bgs.set(stage.id, new Background(stage));
    this.bg = this.bgs.get(stage.id);
  }

  resetEffects() { this.effects = []; this.seen = []; this.camTick = -1; }

  // A small still picture of a stage for menus.
  thumb(stage) {
    if (!this.thumbs.has(stage.id)) {
      this.setStage(stage);
      const c = document.createElement('canvas');
      c.width = 384; c.height = 216;
      const cx = c.getContext('2d');
      this.bg.draw(cx, 0, { x: W / 2, y: H / 2, z: 1, S: c.width / W });
      cx.setTransform(1, 0, 0, 1, 0, 0);
      this.thumbs.set(stage.id, c);
    }
    return this.thumbs.get(stage.id);
  }

  // Smash-style camera: frames all the fighters, zooming in when they are
  // close together and pulling back as they spread out. It never looks past
  // the camera limits, which sit a little inside the blast zones.
  updateCamera(state, stage) {
    const c = CONFIG.CAMERA, b = stage.blast;
    const bx0 = b.left + 20, bx1 = b.right - 20, by0 = b.top + 30, by1 = Math.min(b.bottom - 10, 335);   // the camera stops above the bottom blast zone, so you can fall off screen and come back
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, any = false;
    for (const f of state.fighters) {
      if (f.state === 'dead' || f.state === 'out') continue;
      any = true;
      const px = clamp(toPx(f.x), bx0 + c.marginX, bx1 - c.marginX), py = clamp(toPx(f.y), by0 + 44 + c.marginTop, by1 - c.marginBottom);
      x0 = Math.min(x0, px - c.marginX); x1 = Math.max(x1, px + c.marginX);
      y0 = Math.min(y0, py - 44 - c.marginTop); y1 = Math.max(y1, py + c.marginBottom);
    }
    if (!any) { const m = stage.solids[0]; x0 = m.x; x1 = m.x + m.w; y0 = m.y - 130; y1 = m.y + 60; }
    const z = clamp(Math.min(W / (x1 - x0), H / (y1 - y0)), c.zoomMin, c.zoomMax);
    const hw = W / 2 / z, hh = H / 2 / z;
    const tx = bx0 + hw < bx1 - hw ? clamp((x0 + x1) / 2, bx0 + hw, bx1 - hw) : (bx0 + bx1) / 2;
    const ty = by0 + hh < by1 - hh ? clamp((y0 + y1) / 2, by0 + hh, by1 - hh) : (by0 + by1) / 2;
    if (this.camTick < 0 || state.tick < this.camTick) { this.cam.x = tx; this.cam.y = ty; this.cam.z = z; }
    else {
      for (let n = Math.min(4, state.tick - this.camTick); n > 0; n--) {
        this.cam.x += (tx - this.cam.x) * c.ease;
        this.cam.y += (ty - this.cam.y) * c.ease;
        this.cam.z += (z - this.cam.z) * c.zoomEase;
      }
    }
    this.camTick = state.tick;
  }

  drawMatch(state, opts = {}) {
    const ctx = this.ctx;
    const stage = getStage(state.stageId);
    this.setStage(stage);
    this.time++;
    this.updateCamera(state, stage);
    // screen shake while a KO blast is fresh
    let shX = 0, shY = 0;
    for (const e of this.effects) {
      const age = state.tick - e.tick;
      if (e.type === 'ko' && age >= 0 && age < 18) {
        const amp = ((18 - age) / 18) * 5 / this.cam.z;
        shX += Math.sin(age * 2.7) * amp; shY += Math.cos(age * 3.9) * amp;
      }
    }
    this.view = { x: this.cam.x + shX, y: this.cam.y + shY, z: this.cam.z, S: this.S };
    this.bg.draw(ctx, this.time, this.view);
    this.world();

    for (const f of state.fighters) this.drawShadow(f, stage);
    for (const f of state.fighters) {
      if (f.state === 'dead' || f.state === 'out') continue;
      const ch = getCharacter(f.charId);
      if (this.vanished(f, ch)) {
        // mid-teleport: only a glint of light where he is travelling
        this.star(f.x / FX, f.y / FX - 22, 5 + (state.tick & 3), (ch.trailColors || ['#fff', '#9fe9ff'])[1], '#ffffff', state.tick * 0.7);
        continue;
      }
      if (f.state === 'respawn') this.drawRespawnPlatform(toPx(f.x), toPx(f.y), f.slot);
      const blink = f.invuln > 0 && (state.tick >> 2) & 1;
      // the fighter who got hit shakes during hitlag
      let shake = f.hitlag > 0 && f.state === 'hitstun' ? ((f.hitlag & 1) ? 0.8 : -0.8) : 0;
      // charging a move: he trembles, harder the longer it is held
      const cm = f.state === 'attack' && f.move ? ch.moves[f.move] : null;
      if (cm && cm.charge && !cm.spawn && f.charge > 0 && f.stateFrame === cm.charge.at) shake = ((state.tick & 2) ? 1 : -1) * (0.3 + (0.6 * f.charge) / cm.charge.max);
      // dodging: a pale shimmer while he cannot be hit
      const dodging = f.intangible > 0 && (f.state === 'roll' || f.state === 'spotdodge' || f.state === 'airdodge' || f.state === 'ledgeRoll' || f.state === 'ledge' || f.state === 'ledgeGetup');
      const tint = blink ? '#ffffff' : dodging && (state.tick & 2) ? '#d8f4ff' : null;
      // directional air dodge: fading afterimages trailing behind him
      if (f.state === 'airdodge' && f.dodgeDir && (f.vx || f.vy)) {
        for (const [k, alpha] of [[6, 0.18], [3, 0.32]]) {
          this.doll.drawAnim(ctx, ch, f.alt, f.anim, f.animFrame, (f.x - f.vx * k) / FX, (f.y - f.vy * k) / FX, f.facing,
            { flash: '#bfeaff', alpha });
        }
      }
      this.doll.drawAnim(ctx, ch, f.alt, f.anim, f.animFrame, f.x / FX + shake, f.y / FX, f.facing,
        { flash: tint || undefined, swap: cm && cm.wear,
          // twirl: [from, to] frames during which he spins on the spot
          squash: cm && cm.twirl && cm.twirl.some(([a, b]) => f.stateFrame >= a && f.stateFrame <= b) ? Math.cos(f.stateFrame * 0.85) : undefined });
      if (f.state === 'shield' || f.state === 'shieldStun') this.drawShield(state, f, 0, 0);
      if (f.state === 'dizzy') this.drawDizzy(f, 0, 0);
      this.drawProp(state, f, ch);
      this.drawGear(state, f, ch);
      this.drawDeck(state, f, ch);
    }

    for (const f of state.fighters) this.drawTrail(f, getCharacter(f.charId), 0, 0);
    for (const f of state.fighters) this.drawCard(state, f, getCharacter(f.charId), 0, 0);
    for (const f of state.fighters) this.drawHeldBall(f, getCharacter(f.charId), 0, 0);
    for (const p of state.projectiles || []) this.drawProjectile(p, 0, 0);
    for (const f of state.fighters) this.drawChargeMeter(state, f, getCharacter(f.charId), 0, 0);
    this.drawEffects(state);
    if (opts.showBoxes) { this.world(); this.drawBoxes(state, stage, 0, 0); }
    this.ui();
    if (state.fighters.length > 2) for (const f of state.fighters) this.drawTag(state, f);
    for (const f of state.fighters) this.drawOffscreen(state, f);
    for (const e of this.effects) if (e.type === 'ko') this.drawKo(e, state.tick - e.tick);
    this.drawHud(state);
    if (opts.debugLines) {
      let y = 4;
      for (const line of opts.debugLines) { drawText(ctx, line, 4, y, '#ffffff', 1, 'left', '#000000'); y += 7; }
    }
  }

  // Things a move brings out, set by `gear: { kind, from, to, active }` in its
  // data: a bat, hockey stick or guitar in the front hand, a ball, a foaming
  // beaker, poker chips, a microphone on a cord, a pair of speakers.
  drawGear(state, f, ch) {
    const mv = f.state === 'attack' && f.move ? ch.moves[f.move] : null;
    const g = mv && mv.gear;
    if (!g || f.stateFrame < g.from || f.stateFrame > g.to) return;
    const ctx = this.ctx, fr = f.stateFrame, dir = f.facing;
    const s = solve(ch.skeleton, samplePose(ch.animations[f.anim], f.animFrame));
    const hx = f.x / FX + dir * (s.armF.c[0] / FX), hy = f.y / FX + s.armF.c[1] / FX;   // front hand
    const act = g.active ? (fr >= g.active[0] && fr <= g.active[1] ? (fr - g.active[0]) / (g.active[1] - g.active[0]) : -1) : -1;
    const cols = ch.trailColors || ['#ff9a3c', '#ffe14a', '#ffffff'];
    const OUT = '#100d16';
    // held along the forearm: +y runs from the hand out past the knuckles
    const held = (draw) => { ctx.save(); ctx.translate(hx, hy); ctx.scale(dir, 1); ctx.rotate((-s.armF.low * Math.PI) / 180); draw(); ctx.restore(); };
    const poly = (pts, fill) => { ctx.fillStyle = fill; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill(); };
    if (g.kind === 'bat') held(() => {
      poly([[-1.5, -3.5], [1.5, -3.5], [2.6, 12], [2.4, 17.5], [-2.4, 17.5], [-2.6, 12]], OUT);
      poly([[-0.8, -3], [0.8, -3], [1.9, 12], [1.7, 16.8], [-1.7, 16.8], [-1.9, 12]], '#d9a866');
      poly([[-0.8, -3], [0, -3], [0.4, 12], [0.2, 16.8], [-1.7, 16.8], [-1.9, 12]], '#f0cb94');
      ctx.fillStyle = '#7a4f28'; ctx.fillRect(-1, -3, 2, 4);
    });
    else if (g.kind === 'stick') held(() => {
      poly([[-1.3, -4], [1.3, -4], [1.3, 15], [7.5, 15.5], [7.5, 18.5], [-1.3, 18.5]], OUT);
      poly([[-0.6, -3.4], [0.6, -3.4], [0.6, 15.6], [6.8, 16.1], [6.8, 17.8], [-0.6, 17.8]], '#e9dcc0');
      ctx.fillStyle = cols[0]; ctx.fillRect(-0.6, 2, 1.2, 3); ctx.fillStyle = '#2a2a33'; ctx.fillRect(1.5, 16.4, 5.3, 1.4);
    });
    else if (g.kind === 'guitar') held(() => {
      ctx.fillStyle = OUT; ctx.fillRect(-1.4, -6.5, 2.8, 16);
      ctx.beginPath(); ctx.ellipse(0, 13.5, 5, 5.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6b4a2a'; ctx.fillRect(-0.7, -4, 1.4, 13);
      ctx.fillStyle = '#e9eef5'; ctx.fillRect(-1.1, -6, 2.2, 2.4);
      ctx.fillStyle = cols[0]; ctx.beginPath(); ctx.ellipse(0, 13.5, 4.2, 4.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = cols[1]; ctx.beginPath(); ctx.ellipse(-1.2, 12, 1.8, 2.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(0, 13.5, 1.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e9eef5'; ctx.fillRect(-0.25, -4, 0.5, 19);
    });
    else if (g.kind === 'ball') {
      const a = (s.armF.low * Math.PI) / 180;
      this.drawBall(hx + dir * Math.sin(a) * 4, hy + Math.cos(a) * 4, 4, fr * 300);
    } else if (g.kind === 'beaker') {
      if (act >= 0) {
        // the foam column: bubbles piling up above the beaker
        const top = 38 * Math.min(1, act * 3) * (act > 0.85 ? 1.15 : 1);
        for (let k = 0; k < 16; k++) {
          const u = k / 15, wob = Math.sin(state.tick * 0.9 + k * 1.7) * (2 + u * 3);
          ctx.fillStyle = k % 3 === 0 ? '#ffffff' : k % 3 === 1 ? cols[1] : cols[0];
          ctx.globalAlpha = 0.9 - u * 0.25;
          ctx.beginPath(); ctx.arc(hx + wob, hy - 6 - u * top, 3.2 + (1 - Math.abs(u - 0.6)) * 3.4, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      held(() => {
        poly([[-1.6, 1], [1.6, 1], [1.6, 4], [4, 9.6], [-4, 9.6], [-1.6, 4]], OUT);
        poly([[-0.9, 1.6], [0.9, 1.6], [0.9, 4.2], [3, 9], [-3, 9], [-0.9, 4.2]], '#dff3ff');
        poly([[-1.6, 5.6], [1.6, 5.6], [3, 9], [-3, 9]], cols[0]);
      });
    } else if (g.kind === 'chips') {
      const chip = (x, y, k) => { ctx.fillStyle = OUT; ctx.fillRect(x - 3, y - 1.3, 6, 2.6); ctx.fillStyle = ['#d2343c', '#f6f6f2', '#2f7bff', '#2fa35a'][k & 3]; ctx.fillRect(x - 2.5, y - 0.8, 5, 1.6); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 0.6, y - 0.8, 1.2, 1.6); };
      if (act < 0 && fr < g.active[0]) { for (let k = 0; k < 6; k++) chip(hx + dir * 2, hy - 2 - k * 1.8, k); }
      else if (act >= 0) {
        // burst along the floor on both sides, hopping as they scatter
        const fy = f.y / FX;
        for (let k = 0; k < 14; k++) {
          const side = k & 1 ? 1 : -1, j = ((k * 37 + 11) % 10) / 10;
          const x = f.x / FX + side * (5 + act * (14 + j * 22)), y = fy - 1.5 - Math.abs(Math.sin(act * Math.PI * (1 + j))) * (5 + j * 9) * (1 - act * 0.5);
          ctx.globalAlpha = Math.min(1, (1 - act) * 2.5); chip(x, y, k);
        }
        ctx.globalAlpha = 1;
      }
    } else if (g.kind === 'mic') {
      // out on its cord: shoots up, hangs, drops back to the hand
      const h = act < 0 ? 0 : 42 * (act < 0.3 ? act / 0.3 : act > 0.7 ? (1 - act) / 0.3 : 1);
      const a = (s.armF.low * Math.PI) / 180;
      const mx = act < 0 ? hx + dir * Math.sin(a) * 5 : hx, my = act < 0 ? hy + Math.cos(a) * 5 : hy - 6 - h;
      ctx.strokeStyle = OUT; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(hx, hy);
      ctx.quadraticCurveTo(hx + dir * (act < 0 ? 3 : 2.5 * Math.sin(fr)), (hy + my) / 2, mx, my); ctx.stroke();
      ctx.fillStyle = OUT; ctx.fillRect(mx - 1.4, my - 0.5, 2.8, 5.5); ctx.beginPath(); ctx.arc(mx, my - 2, 3.1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#474b60'; ctx.fillRect(mx - 0.8, my, 1.6, 4.4);
      ctx.fillStyle = '#c9ced8'; ctx.beginPath(); ctx.arc(mx, my - 2, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(mx - 0.8, my - 2.8, 0.8, 0, Math.PI * 2); ctx.fill();
    } else if (g.kind === 'speakers') {
      const pop = Math.min(1, (fr - g.from) / 4, (g.to - fr) / 4), fy = f.y / FX;
      for (const side of [-1, 1]) {
        const x = f.x / FX + side * 19, thump = act >= 0 ? 1.6 * (1 - act) + ((state.tick >> 1) & 1) : 0;
        ctx.fillStyle = OUT; ctx.fillRect(x - 6, fy - 15 * pop, 12, 15 * pop);
        ctx.fillStyle = '#2f3242'; ctx.fillRect(x - 5, fy - 15 * pop + 1, 10, Math.max(0, 15 * pop - 2));
        ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(x, fy - 7.5 * pop, 3.6 + thump, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = act >= 0 ? '#ffffff' : cols[0]; ctx.beginPath(); ctx.arc(x, fy - 7.5 * pop, 1.5 + thump * 0.6, 0, Math.PI * 2); ctx.fill();
        if (act >= 0) for (let k = 0; k < 3; k++) {
          const r = 6 + act * 16 + k * 5;
          ctx.strokeStyle = k & 1 ? cols[2] : cols[1]; ctx.globalAlpha = Math.max(0, (1 - act) * (1 - k * 0.25)); ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.arc(x, fy - 7.5, r, side > 0 ? -1.0 : Math.PI - 1.0, side > 0 ? 1.0 : Math.PI + 1.0); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  // True while a fighter is between the vanish and reappear frames of a teleport.
  vanished(f, ch) {
    const mv = f.state === 'attack' && f.move ? ch.moves[f.move] : null;
    return !!(mv && mv.teleport && f.stateFrame >= mv.teleport.vanish && f.stateFrame < mv.teleport.appear);
  }

  // DJ decks and a speaker stack, for moves that set `deck` (Bass Drop).
  // The speakers thump harder as the move charges; on the blast frame a
  // ring bursts out to the size of the hit.
  drawDeck(state, f, ch) {
    const mv = f.state === 'attack' && f.move ? ch.moves[f.move] : null;
    if (!mv || !mv.deck || f.stateFrame < mv.deck.from) return;
    const ctx = this.ctx, d = mv.deck, x = f.x / FX, y = f.y / FX, dir = f.facing;
    const k = mv.charge ? Math.min(1, f.charge / mv.charge.max) : 0;
    const out = f.stateFrame > d.to ? 0 : Math.min(1, (f.stateFrame - d.from) / 4, (d.to - f.stateFrame) / 4);   // pops in and out
    if (out > 0) {
      const thump = f.stateFrame < d.blast ? ((state.tick >> 2) & 1) * (0.4 + k) : 0;
      ctx.save();
      ctx.translate(x, y); ctx.scale(dir, 1); ctx.globalAlpha = Math.min(1, out * 1.5);
      // speaker stack behind him: two boxes, cones pulsing
      for (const [by, h] of [[-15, 15], [-29, 13]]) {
        ctx.fillStyle = '#100d16'; ctx.fillRect(-27, by * out, 13, h * out);
        ctx.fillStyle = '#2f3242'; ctx.fillRect(-26, by * out + 1, 11, h * out - 2);
        ctx.fillStyle = '#100d16'; ctx.beginPath(); ctx.arc(-20.5, (by + h / 2) * out, 4 + thump, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = k >= 1 && (state.tick & 2) ? '#ffffff' : '#39d98a'; ctx.beginPath(); ctx.arc(-20.5, (by + h / 2) * out, 1.6 + thump * 0.8, 0, Math.PI * 2); ctx.fill();
      }
      // the decks in front: a table, two platters and a mixer
      ctx.fillStyle = '#100d16'; ctx.fillRect(5, -19 * out, 24, 5); ctx.fillRect(7, -15 * out, 2, 15 * out); ctx.fillRect(25, -15 * out, 2, 15 * out);
      ctx.fillStyle = '#474b60'; ctx.fillRect(6, -18 * out, 22, 3);
      ctx.fillStyle = '#c9ced8'; ctx.fillRect(7, -20 * out, 6, 2); ctx.fillRect(21, -20 * out, 6, 2);
      ctx.fillStyle = '#39d98a'; ctx.fillRect(15, -20 * out, 4, 2);
      ctx.fillStyle = ((state.tick >> 1) & 1) ? '#ff4a5a' : '#ffe14a'; ctx.fillRect(16, -20 * out, 1, 1);
      ctx.restore();
    }
    // the drop: a ring out to the edge of the blast, then fading
    const age = f.stateFrame - d.blast;
    if (age >= 0 && age < 14) {
      const hb = mv.hitboxes[0], R = hb.chargeR ? hb.chargeR[0] + (hb.chargeR[1] - hb.chargeR[0]) * k : hb.r;
      const s = solve(ch.skeleton, samplePose(ch.animations[f.anim], f.animFrame));
      const cx = x + dir * ((s.hip[0] + s.neck[0]) / 2 / FX), cy = y + (s.hip[1] + s.neck[1]) / 2 / FX;
      const grow = Math.min(1, (age + 1) / 4), a = 1 - age / 14;
      const colors = ch.trailColors || ['#ff9a3c', '#ffe14a', '#ffffff'];
      ctx.fillStyle = rgba(colors[0], 0.22 * a); ctx.beginPath(); ctx.arc(cx, cy, R * grow, 0, Math.PI * 2); ctx.fill();
      this.drawRing(cx, cy, R * grow, colors[1], a, 4.5);
      this.drawRing(cx, cy, R * grow * 0.72, colors[2], a * 0.8, 1.6);
      this.drawRing(cx, cy, R * grow * 0.42, colors[1], a * 0.6, 1.2);
    }
  }

  // Propeller cap on his head, for moves that set `prop` (Rotor Cap). The
  // blades spin fast while it lifts him and sputter once he is falling
  // helpless.
  drawProp(state, f, ch) {
    const up = ch.specials && ch.moves[ch.specials.up];
    if (!up || !up.prop) return;
    const flying = f.state === 'attack' && f.move === ch.specials.up && f.stateFrame >= up.prop.from && f.stateFrame <= up.prop.to;
    if (!flying && f.state !== 'helpless') return;
    const s = solve(ch.skeleton, samplePose(ch.animations[f.anim] || ch.animations.idle, f.animFrame));
    const ctx = this.ctx, a = (s.head * Math.PI) / 180;
    ctx.save();
    ctx.translate(f.x / FX + f.facing * (s.neck[0] / FX), f.y / FX + s.neck[1] / FX);
    ctx.scale(f.facing, 1);
    ctx.rotate(a);
    ctx.translate(0, -9);                       // top of the head
    const powered = flying && f.stateFrame >= up.fly.frame && f.stateFrame <= up.fly.frame + up.fly.frames;
    const phase = powered ? state.tick * 1.15 : flying ? state.tick * 0.5 : state.tick * 0.16;
    const half = 1.5 + 8.5 * Math.abs(Math.cos(phase));
    // cap
    ctx.fillStyle = '#100d16'; ctx.fillRect(-4, -2.5, 8.5, 3.5);
    ctx.fillStyle = '#d2343c'; ctx.fillRect(-3.5, -2, 7.5, 2);
    ctx.fillStyle = '#ffe14a'; ctx.fillRect(-3.5, -0.5, 7.5, 1);
    ctx.fillStyle = '#f2777c'; ctx.fillRect(-2.5, -2, 2, 0.5);
    // mast
    ctx.fillStyle = '#100d16'; ctx.fillRect(-1, -6, 2, 4);
    ctx.fillStyle = '#c9ced8'; ctx.fillRect(-0.5, -5.5, 1, 3.5);
    // blur disc while spinning fast, then the blades
    if (powered) { ctx.fillStyle = 'rgba(233,238,245,0.3)'; ctx.beginPath(); ctx.ellipse(0, -6, 10, 1.6, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#100d16'; ctx.fillRect(-half - 0.5, -7, half * 2 + 1, 2);
    ctx.fillStyle = '#e9eef5'; ctx.fillRect(-half, -6.5, half * 2, 1);
    ctx.fillStyle = '#868d9a'; ctx.fillRect(-half, -6.5, Math.min(2, half), 1); ctx.fillRect(half - Math.min(2, half), -6.5, Math.min(2, half), 1);
    ctx.fillStyle = '#ffe14a'; ctx.fillRect(-0.5, -7, 1, 2);
    ctx.restore();
  }

  // Soft shadow on the ground under a fighter; fainter and smaller the higher he is.
  drawShadow(f, stage) {
    if (f.state === 'dead' || f.state === 'out' || f.state === 'respawn' || this.vanished(f, getCharacter(f.charId))) return;
    const x = f.x / FX, y = f.y / FX;
    let gy = Infinity;
    for (const s of [...stage.solids, ...(stage.platforms || [])]) if (x >= s.x && x <= s.x + s.w && s.y >= y - 2 && s.y < gy) gy = s.y;
    if (gy === Infinity) return;
    const h = Math.max(0, gy - y), k = Math.max(0, 1 - h / 150);
    if (k <= 0) return;
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,' + (0.34 * k).toFixed(3) + ')';
    ctx.beginPath(); ctx.ellipse(x, gy + 0.8, 5 + 5 * k, 1.2 + 1.2 * k, 0, 0, Math.PI * 2); ctx.fill();
  }

  // Off-screen bubble: when a fighter leaves the screen, a ringed bubble at
  // the nearest edge shows them at half size, with a pointer toward where
  // they really are.
  // Free-for-alls: a small coloured tag over each fighter's head.
  drawTag(state, f) {
    if (f.state === 'dead' || f.state === 'out' || this.vanished(f, getCharacter(f.charId))) return;
    const [sx, sy] = this.toScreen(f.x / FX, f.y / FX - 50);
    if (sx < 0 || sx > W || sy < 4 || sy > H - 40) return;
    const ctx = this.ctx, col = this.pcol(f.slot), y = sy - 6;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.moveTo(sx - 3.6, y + 2.2); ctx.lineTo(sx + 3.6, y + 2.2); ctx.lineTo(sx, y + 6.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(sx - 2.6, y + 2); ctx.lineTo(sx + 2.6, y + 2); ctx.lineTo(sx, y + 5.2); ctx.closePath(); ctx.fill();
    drawText(ctx, this.plabel(f.slot), sx, y - 5, col, 1, 'center', '#000000');
  }

  drawOffscreen(state, f) {
    if (f.state === 'dead' || f.state === 'out' || f.state === 'respawn') return;
    const z = this.view.z;
    const [sx, sy] = this.toScreen(f.x / FX, f.y / FX - 22);
    if (sx > -8 * z && sx < W + 8 * z && sy > -18 * z && sy < H + 18 * z) return;   // still (partly) visible
    const R = 17, cx = clamp(sx, R + 4, W - R - 4), cy = clamp(sy, R + 4, H - R - 34);
    const ctx = this.ctx, col = this.pcol(f.slot);
    const ang = Math.atan2(sy - cy, sx - cx);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * (R + 8), cy + Math.sin(ang) * (R + 8));
    ctx.lineTo(cx + Math.cos(ang + 0.42) * (R + 0.5), cy + Math.sin(ang + 0.42) * (R + 0.5));
    ctx.lineTo(cx + Math.cos(ang - 0.42) * (R + 0.5), cy + Math.sin(ang - 0.42) * (R + 0.5));
    ctx.closePath(); ctx.fill();
    const g = ctx.createRadialGradient(cx - 5, cy - 6, 2, cx, cy, R);
    g.addColorStop(0, '#5a5670'); g.addColorStop(1, '#1d1a2b');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R - 0.5, 0, Math.PI * 2); ctx.clip();
    ctx.translate(cx, cy + 11); ctx.scale(0.5, 0.5);
    this.doll.drawAnim(ctx, getCharacter(f.charId), f.alt, f.anim, f.animFrame, 0, 0, f.facing);
    ctx.restore();
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.arc(cx, cy, R - 1.6, Math.PI * 1.05, Math.PI * 1.6); ctx.stroke();
  }

  // Shield bubble: player-coloured glass ball that shrinks with shield health
  // and flashes when hit.
  drawShield(state, f) {
    const ctx = this.ctx;
    const [cx0, cy0] = shieldCentre(f);
    const cx = cx0 / FX, cy = cy0 / FX, r = shieldRadius(f) / FX;
    const hitFlash = f.shieldHitTick >= 0 && state.tick - f.shieldHitTick < 4;
    const low = f.shieldHp < CONFIG.SHIELD_MAX / 4;
    const col = hitFlash ? '#ffffff' : low && (state.tick & 4) ? '#ff6a4a' : this.pcol(f.slot);
    const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.05, cx, cy, r);
    g.addColorStop(0, 'rgba(255,255,255,0.8)'); g.addColorStop(0.3, rgba(col, 0.38)); g.addColorStop(0.85, rgba(col, 0.5)); g.addColorStop(1, rgba(col, 0.85));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = rgba(col, 0.95); ctx.lineWidth = 0.7; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 0.9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.78, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
  }

  // Dizzy after a shield break: little stars circling his head.
  drawDizzy(f) {
    const x = f.x / FX, y = f.y / FX - 46;
    for (let i = 0; i < 3; i++) {
      const a = (f.stateFrame / 9) + (i * Math.PI * 2) / 3;
      this.star(x + Math.cos(a) * 8, y + Math.sin(a) * 2.2, 2.6 + Math.sin(a) * 0.6, '#ffe14a', '#ffffff', a * 2);
    }
  }

  // A four-point sparkle.
  star(x, y, r, color, core, rot = 0) {
    const ctx = this.ctx;
    for (const [rr, col] of [[r, color], [r * 0.5, core]]) {
      ctx.fillStyle = col; ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = rot + (k * Math.PI) / 4, d = k & 1 ? rr * 0.28 : rr;
        ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
      }
      ctx.closePath(); ctx.fill();
    }
  }

  // The little hover pad a fighter stands on after a KO.
  drawRespawnPlatform(x, y, slot) {
    const ctx = this.ctx, col = this.pcol(slot);
    const pulse = 0.5 + 0.5 * Math.sin(this.time / 6);
    const glow = ctx.createRadialGradient(x, y + 9, 1, x, y + 9, 16);
    glow.addColorStop(0, 'rgba(190,240,255,' + (0.5 + 0.3 * pulse).toFixed(2) + ')'); glow.addColorStop(1, 'rgba(159,233,255,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.ellipse(x, y + 9, 16, 7, 0, 0, Math.PI * 2); ctx.fill();
    const body = (grow, fill) => {
      ctx.fillStyle = fill; ctx.beginPath();
      ctx.moveTo(x - 17 - grow, y - grow * 0.5); ctx.lineTo(x + 17 + grow, y - grow * 0.5);
      ctx.quadraticCurveTo(x + 15, y + 6 + grow, x + 9, y + 8 + grow);
      ctx.lineTo(x - 9, y + 8 + grow);
      ctx.quadraticCurveTo(x - 15, y + 6 + grow, x - 17 - grow, y - grow * 0.5);
      ctx.closePath(); ctx.fill();
    };
    body(0.7, '#100d16');
    const g = ctx.createLinearGradient(0, y, 0, y + 8);
    g.addColorStop(0, '#f4f7fb'); g.addColorStop(0.3, '#b9c2d2'); g.addColorStop(1, '#5d667b');
    body(0, g);
    ctx.fillStyle = col; ctx.fillRect(x - 12, y + 2.6, 24, 1.2);
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(x - 15.5, y + 0.2, 31, 0.8);
  }

  // KO blast (in screen units): a column of light bursting into the screen
  // from the edge the fighter left through, in that player's colour.
  drawKo(e, age) {
    const LIFE = 50;
    if (age < 0 || age >= LIFE) return;
    const ctx = this.ctx, x0 = e.sx, y0 = e.sy, base = e.ang, col = this.pcol(e.slot);
    const reach = Math.min(1, age / 8), fade = age > 26 ? (LIFE - age) / (LIFE - 26) : 1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // wide soft beam
    const beam = (spread, len, color, alpha) => {
      const g = ctx.createLinearGradient(x0, y0, x0 + Math.cos(base) * len, y0 + Math.sin(base) * len);
      g.addColorStop(0, rgba(color, alpha)); g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + Math.cos(base - spread) * len, y0 + Math.sin(base - spread) * len);
      ctx.lineTo(x0 + Math.cos(base + spread) * len, y0 + Math.sin(base + spread) * len);
      ctx.closePath(); ctx.fill();
    };
    beam(0.55, 420 * reach, col, 0.55 * fade);
    beam(0.3, 460 * reach, '#ffe14a', 0.5 * fade);
    beam(0.12, 500 * reach, '#ffffff', 0.8 * fade);
    // rays
    for (let i = -8; i <= 8; i++) {
      const ang = base + i * 0.12 + ((i * 37) % 5) * 0.012;
      const len = (190 + ((i * 53 + 424) % 170)) * reach;
      const start = age > 26 ? len * (1 - fade) : 0;   // rays pull away from the edge as they fade
      const wdt = (7 - Math.abs(i) * 0.5) * fade;
      const cs = Math.cos(ang), sn = Math.sin(ang), nx = -sn, ny = cs;
      ctx.fillStyle = rgba([col, '#ffe14a', '#ffffff'][(i + 24) % 3], 0.85 * fade);
      ctx.beginPath();
      ctx.moveTo(x0 + cs * start + nx * wdt, y0 + sn * start + ny * wdt);
      ctx.lineTo(x0 + cs * len, y0 + sn * len);
      ctx.lineTo(x0 + cs * start - nx * wdt, y0 + sn * start - ny * wdt);
      ctx.closePath(); ctx.fill();
    }
    // fireball at the edge
    const r = (age < 6 ? 20 + age * 12 : 92) * fade;
    if (r > 1) {
      const g = ctx.createRadialGradient(x0, y0, 0, x0, y0, r);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, rgba('#ffe14a', 0.9)); g.addColorStop(0.65, rgba(col, 0.6)); g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x0, y0, r, 0, Math.PI * 2); ctx.fill();
    }
    // shock rings and flying embers
    for (const [delay, speed] of [[0, 9], [5, 7]]) {
      const a = age - delay;
      if (a < 0 || a > 26) continue;
      ctx.strokeStyle = rgba('#ffffff', 0.8 * (1 - a / 26)); ctx.lineWidth = 4 * (1 - a / 26) + 0.5;
      ctx.beginPath(); ctx.arc(x0, y0, 12 + a * speed, 0, Math.PI * 2); ctx.stroke();
    }
    for (let i = 0; i < 16; i++) {
      const ang = base + (((i * 71) % 100) / 100 - 0.5) * 1.5, sp = 5 + ((i * 29) % 7);
      const d = age * sp, a = Math.max(0, 1 - age / 34);
      ctx.fillStyle = rgba(i & 1 ? '#ffffff' : col, a);
      ctx.beginPath(); ctx.arc(x0 + Math.cos(ang) * d, y0 + Math.sin(ang) * d, 2.4 * a + 0.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    if (age < 4) { ctx.fillStyle = 'rgba(255,255,255,' + (0.7 - age * 0.15) + ')'; ctx.fillRect(0, 0, W, H); }
  }

  // Effects are spawned by watching the state change between drawn frames and
  // aged by the simulation tick, so they freeze correctly while paused.
  // Drawn in world pixels.
  drawEffects(state) {
    const ctx = this.ctx, add = (e) => this.effects.push({ tick: state.tick, ...e });
    state.fighters.forEach((f, i) => {
      const was = this.seen[i] || {};
      const x = f.x / FX, y = f.y / FX, known = was.state !== undefined;
      if (f.fastFall && !was.fastFall) add({ type: 'fastfall', x, y: y - 24 });
      if (f.lastHitTick >= 0 && f.lastHitTick !== was.lastHitTick && was.lastHitTick !== undefined) {
        add({ type: 'spark', x: f.hitX, y: f.hitY, size: Math.min(20, 7 + (f.lastHitDmg / 10 | 0)), seed: f.lastHitTick });
      }
      if (f.parryTick >= 0 && f.parryTick !== was.parryTick && was.parryTick !== undefined) add({ type: 'parry', x, y: y - 22 });
      if (f.state === 'shieldBreak' && was.state !== 'shieldBreak' && known) add({ type: 'break', x, y: y - 22, slot: f.slot });
      if (f.counterTick >= 0 && f.counterTick !== was.counterTick && was.counterTick !== undefined) add({ type: 'counter', x, y: y - 24 });
      if (known && f.state !== 'dead' && f.state !== 'out' && f.state !== 'respawn') {
        // dust: landing, taking off, dashing, skidding to a stop or turning
        if (f.grounded && was.grounded === 0) add({ type: 'dust', x, y, dir: 0, n: f.state === 'land' || f.state === 'knockdown' ? 6 : 4 });
        if (!f.grounded && was.grounded === 1 && f.vy < 0) add({ type: 'dust', x: was.x, y: was.y, dir: 0, n: 4 });
        if (f.state === 'dash' && was.state !== 'dash') add({ type: 'dust', x: x - f.facing * 4, y, dir: -f.facing, n: 4 });
        if ((f.state === 'brake' || f.state === 'turn') && was.state !== f.state) add({ type: 'dust', x: x + Math.sign(f.vx) * 5, y, dir: Math.sign(f.vx), n: 3 });
        // launched hard: a trail of smoke puffs
        if (f.state === 'hitstun' && f.hitlag <= 0 && f.kbSpeed > 2.4 * FX && state.tick !== was.tick && (state.tick & 1) === 0) {
          add({ type: 'smoke', x, y: y - 20, slot: f.slot, big: f.kbSpeed > 5 * FX });
        }
      }
      // moves marked `burst` (a misfire) go off with a bang, and rocket moves leave smoke
      const emv = f.state === 'attack' && f.move ? getCharacter(f.charId).moves[f.move] : null;
      if (emv && emv.burst && was.move !== f.move && known) add({ type: 'counter', x, y: y - 18 });
      if (emv && emv.rocket && f.stateFrame >= emv.rocket.frame && f.stateFrame <= emv.rocket.frame + emv.rocket.frames && state.tick !== was.tick && (state.tick & 1) === 0) {
        add({ type: 'smoke', x: x - f.facing * 6, y: y - 16, slot: f.slot, big: !!emv.burst });
      }
      // a tech: a bright flash and a ring
      if (known && (f.state === 'tech' || f.state === 'techWall' || (f.state === 'getupRoll' && was.state !== 'knockdown')) && was.state !== f.state) {
        add({ type: 'parry', x, y: y - 18 }); add({ type: 'fastfall', x, y: y - 18 });
      }
      // teleports flash where he vanishes and where he reappears
      if (emv && emv.teleport && state.tick !== was.tick) {
        const cols = getCharacter(f.charId).trailColors || ['#5fc8ff', '#9fe9ff', '#ffffff'];
        // a whirl of light as he spins away, and a bigger burst where he comes back
        if (f.stateFrame === emv.teleport.vanish - 8 || f.stateFrame === emv.teleport.vanish) add({ type: 'swirl', x, y, col: cols[1], big: 0 });
        if (f.stateFrame === emv.teleport.appear) { add({ type: 'swirl', x, y, col: cols[1], big: 1 }); add({ type: 'parry', x, y: y - 22 }); }
      }
      // KO: remember where on the screen edge he left
      if (f.state === 'dead' && was.state !== 'dead' && known) {
        const [sx0, sy0] = this.toScreen(x, y - 20);
        const sx = clamp(sx0, 0, W), sy = clamp(sy0, 0, H);
        add({ type: 'ko', sx, sy, ang: Math.atan2(H / 2 - sy, W / 2 - sx), slot: f.slot });
      }
      this.seen[i] = { fastFall: f.fastFall, lastHitTick: f.lastHitTick, parryTick: f.parryTick, state: f.state, counterTick: f.counterTick, grounded: f.grounded, x, y, tick: state.tick, move: f.move };
    });
    const LIFE = { break: 30, parry: 22, counter: 22, ko: 50, dust: 20, smoke: 26, spark: 16, fastfall: 14, swirl: 22 };
    this.effects = this.effects.filter((e) => state.tick >= e.tick && state.tick - e.tick < LIFE[e.type]);
    for (const e of this.effects) {
      const age = state.tick - e.tick;
      const x = e.x, y = e.y;
      if (e.type === 'ko') continue;   // drawn later, in screen units
      if (e.type === 'spark') { this.drawSpark(x, y, age, e.size, e.seed); continue; }
      if (e.type === 'dust') {
        const t = age / 20;
        for (let k = 0; k < e.n; k++) {
          const side = e.dir || (k & 1 ? 1 : -1), j = ((k * 37 + 11) % 10) / 10;
          const px = x + side * (2 + (5 + j * 9) * (1 - (1 - t) * (1 - t))), py = y - 1.5 - j * 2 - t * (3 + j * 5);
          ctx.fillStyle = 'rgba(244,240,228,' + (0.6 * (1 - t)).toFixed(3) + ')';
          ctx.beginPath(); ctx.arc(px, py, 1.6 + j * 1.4 + t * 2.6, 0, Math.PI * 2); ctx.fill();
        }
        continue;
      }
      if (e.type === 'swirl') {
        // ribbons of light spiralling up round where he stands
        const t = age / 22, R = (e.big ? 20 : 13) * (e.big ? 0.4 + t : 1 - t * 0.6);
        ctx.lineCap = 'round';
        for (let k = 0; k < 7; k++) {
          const a0 = age * 0.55 + k * 0.9, yy = y - 4 - k * 6 - t * 10;
          ctx.strokeStyle = k & 1 ? '#ffffff' : e.col; ctx.globalAlpha = (1 - t) * 0.9; ctx.lineWidth = e.big ? 2 : 1.5;
          ctx.beginPath();
          for (let q = 0; q <= 6; q++) { const a = a0 + q * 0.28; ctx.lineTo(x + Math.cos(a) * R, yy + Math.sin(a) * R * 0.28 - q * 0.5); }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        continue;
      }
      if (e.type === 'smoke') {
        const t = age / 26, r = (e.big ? 5 : 3.5) + t * (e.big ? 7 : 5);
        const g = ctx.createRadialGradient(x, y - t * 4, r * 0.2, x, y - t * 4, r);
        g.addColorStop(0, 'rgba(255,255,255,' + (0.55 * (1 - t)).toFixed(3) + ')');
        g.addColorStop(0.6, rgba(this.pcol(e.slot), 0.22 * (1 - t)));
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - t * 4, r, 0, Math.PI * 2); ctx.fill();
        continue;
      }
      if (e.type === 'counter') {
        // red-and-white burst and a flash: the bluff worked
        this.drawRing(x, y, 8 + age * 3, age & 2 ? '#ffffff' : '#ff4a5a', 1 - age / 22, 2.2);
        this.drawRing(x, y, 4 + age * 2, '#ffe14a', 1 - age / 16, 1.4);
        if (age < 2) this.flash(0.4);
        continue;
      }
      if (e.type === 'parry') { this.drawRing(x, y, 6 + age * 2, age < 6 ? '#ffffff' : '#9fe9ff', 1 - age / 22, 2); continue; }
      if (e.type === 'break') {
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2, d = 4 + age * 2.2;
          ctx.globalAlpha = Math.max(0, 1 - age / 30);
          this.star(x + Math.cos(a) * d, y + Math.sin(a) * d, 3.2, k & 1 ? '#ffffff' : this.pcol(e.slot), '#ffffff', a);
        }
        ctx.globalAlpha = 1;
        this.drawRing(x, y, 6 + age * 3.4, '#ffffff', 1 - age / 18, 2.5);
        if (age < 3) this.flash(0.35);
        continue;
      }
      // fast fall: a four-point twinkle that grows fast, then shrinks
      const len = age < 3 ? 4 + age * 2.5 : Math.max(1, 10 - (age - 3) * 0.8);
      this.star(x, y, len, '#5fc8ff', '#ffffff', 0);
    }
  }

  // --- Basketball ---
  // An orange ball with dark seams that turn as it travels.
  drawBall(x, y, r, spin, alpha = 1) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#100d16'; ctx.beginPath(); ctx.arc(x, y, r + 0.6, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.1, x, y, r);
    g.addColorStop(0, '#ffc27a'); g.addColorStop(0.45, '#e8842f'); g.addColorStop(1, '#a94f17');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    ctx.translate(x, y); ctx.rotate((spin / 2048) * Math.PI);
    ctx.strokeStyle = '#3a1d0e'; ctx.lineWidth = Math.max(0.35, r * 0.11);
    ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke();
    ctx.beginPath(); ctx.arc(-r * 1.25, 0, r * 0.95, -1, 1); ctx.stroke();
    ctx.beginPath(); ctx.arc(r * 1.25, 0, r * 0.95, Math.PI - 1, Math.PI + 1); ctx.stroke();
    ctx.restore();
  }

  drawProjectile(p) {
    const d = getCharacter(p.charId).projectiles[p.kind];
    const fade = p.spent ? Math.max(0.2, p.life / d.fadeFrames) : 1;
    const x = p.x / FX, y = p.y / FX, ctx = this.ctx;
    if (d.draw === 'vape') {
      // a green and orange vape, spinning end over end, with a puff behind it
      ctx.save();
      ctx.fillStyle = 'rgba(240,244,250,0.35)';
      for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(x - (p.vx / FX) * k * 2.2, y - (p.vy / FX) * k * 2.2 - k * 0.6, 1.6 + k * 0.9, 0, Math.PI * 2); ctx.fill(); }
      ctx.translate(x, y); ctx.rotate((p.spin / 256) * 0.9);
      ctx.fillStyle = '#100d16'; ctx.fillRect(-5.5, -2, 11, 4);
      ctx.fillStyle = '#3fbf5f'; ctx.fillRect(-5, -1.5, 5.5, 3);
      ctx.fillStyle = '#7fe39a'; ctx.fillRect(-5, -1.5, 5.5, 1);
      ctx.fillStyle = '#ff8a2a'; ctx.fillRect(0.5, -1.5, 3.5, 3);
      ctx.fillStyle = '#ffc07a'; ctx.fillRect(0.5, -1.5, 3.5, 1);
      ctx.fillStyle = '#2a2a33'; ctx.fillRect(4, -1, 1.5, 2);
      ctx.restore();
      return;
    }
    if (d.draw === 'arrow') {
      // a chart arrow: a zigzag line ending in an arrowhead, pointing the way it flies
      ctx.save();
      ctx.translate(x, y); ctx.rotate(Math.atan2(p.vy, p.vx));
      ctx.globalAlpha = fade;
      const L = d.r * 3.2;
      for (const [w, col] of [[d.r * 0.9 + 1.4, '#100d16'], [d.r * 0.9, d.color]]) {
        ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = w * 0.55; ctx.lineJoin = 'miter'; ctx.lineCap = 'butt';
        ctx.beginPath(); ctx.moveTo(-L, 2); ctx.lineTo(-L * 0.62, -2.5); ctx.lineTo(-L * 0.32, 2); ctx.lineTo(0, 0); ctx.stroke();
        const hgt = w * 0.95 + 1.6;
        ctx.beginPath(); ctx.moveTo(d.r + 2 + (w - d.r * 0.9) * 0.6, 0); ctx.lineTo(-1.5, -hgt); ctx.lineTo(-1.5, hgt); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      return;
    }
    if (d.draw === 'wave') {
      // a low crescent of energy sliding along the floor
      const dir = p.vx >= 0 ? 1 : -1, a = Math.min(1, p.life / 8) * fade;
      ctx.save();
      ctx.translate(x, y + d.r); ctx.scale(dir, 1);
      const wc = getCharacter(p.charId).trailColors || ['#ff9a3c', '#ffe14a', '#ffffff'];
      for (const [w, h, col, al] of [[9, 11, wc[0], 0.55], [7, 9, wc[1], 0.8], [4, 6, wc[2], 1]]) {
        ctx.globalAlpha = al * a; ctx.fillStyle = col;
        ctx.beginPath(); ctx.moveTo(-w, 0); ctx.quadraticCurveTo(w * 0.2, -h * 0.4, w, -h); ctx.quadraticCurveTo(w * 0.9, -h * 0.3, w * 0.5, 0); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      return;
    }
    this.drawBall(x, y, d.r, p.spin, fade);
  }
  // The ball in his hands before it is released.
  drawHeldBall(f, ch, camX, camY) {
    if (f.state !== 'attack' || !f.move) return;
    const mv = ch.moves[f.move];
    if (!mv.holdBall || f.stateFrame < mv.holdBall[0] || f.stateFrame > mv.holdBall[1]) return;
    const s = solve(ch.skeleton, samplePose(ch.animations[f.anim], f.animFrame));
    const a = jointAt(s, 'fistF'), b = jointAt(s, 'fistB');
    const x = (f.x + f.facing * ((a[0] + b[0]) >> 1)) / FX + f.facing * 2;
    const y = (f.y + ((a[1] + b[1]) >> 1)) / FX - 3;
    this.drawBall(x, y, ch.projectiles.basketball.r, 0);
  }
  // Power meter over his head while charging a shot.
  drawChargeMeter(state, f, ch, camX, camY) {
    if (f.state !== 'attack' || !f.move || !f.charge) return;
    const mv = ch.moves[f.move];
    if (!mv.charge || f.stateFrame > (mv.spawn ? mv.spawn.frame : mv.charge.at + 1)) return;
    const ctx = this.ctx, w = 16, x = toPx(f.x) - camX - (w >> 1), y = toPx(f.y) - camY - 52;
    const full = f.charge >= mv.charge.max;
    ctx.fillStyle = '#100d16'; ctx.fillRect(x - 1, y - 1, w + 2, 5);
    ctx.fillStyle = '#3a3550'; ctx.fillRect(x, y, w, 3);
    ctx.fillStyle = full ? ((state.tick >> 2) & 1 ? '#ffffff' : '#ff8a3c') : '#ffe14a';
    ctx.fillRect(x, y, Math.max(1, Math.round((w * f.charge) / mv.charge.max)), 3);
  }

  // A playing card in his hand, for moves that set `card` (Bluff). Small while
  // bluffing; big and swung round when the counter fires. Plain design: white
  // card, red border, one red diamond.
  drawCard(state, f, ch, camX, camY) {
    if (f.state !== 'attack' || !f.move) return;
    const cd = ch.moves[f.move].card;
    if (!cd || f.stateFrame < cd.from || f.stateFrame > cd.to) return;
    const a = ch.animations[f.anim];
    const hand = jointAt(solve(ch.skeleton, samplePose(a, f.animFrame)), 'fistF');
    const big = cd.size === 'big';
    const w = big ? 11 : 5, h = big ? 15 : 7;
    const x = toPx(f.x + f.facing * hand[0]) - camX + (big ? f.facing * 4 : f.facing) - (w >> 1);
    const y = toPx(f.y + hand[1]) - camY - h + (big ? 4 : 2);
    const ctx = this.ctx;
    // glint every few frames while bluffing, so it reads as "try me"
    const glint = !big && ((f.stateFrame >> 2) % 4 === 0);
    ctx.fillStyle = '#100d16'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = glint ? '#fffbe0' : '#f8f6ee'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#d2343c';
    ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
    const cx = x + (w >> 1), cy = y + (h >> 1), r = big ? 3 : 1;
    for (let dy = -r; dy <= r; dy++) { const hw = r - Math.abs(dy); ctx.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1); }
  }

  // Swipe arc: a bright ribbon following a fist or foot through the last few
  // frames of an attack. Rebuilt from the animation every frame, so it needs
  // no history and freezes correctly in hitlag and pause.
  drawTrail(f, ch, camX, camY) {
    if (f.state !== 'attack' || !f.move) return;
    const tr = ch.moves[f.move].trail;
    if (!tr) return;
    if (Array.isArray(tr)) { for (const t of tr) this.drawOneTrail(f, ch, t, camX, camY); return; }
    this.drawOneTrail(f, ch, tr, camX, camY);
  }

  drawOneTrail(f, ch, tr) {
    const LEN = 6;
    const newest = Math.min(f.stateFrame, tr.to), oldest = Math.max(tr.from, f.stateFrame - LEN);
    if (newest <= oldest) return;
    const a = ch.animations[f.anim];
    const pts = [];
    // sample between frames so a fast swing draws a smooth curve
    for (let fr = newest; fr >= oldest - 1e-6; fr -= 0.25) {
      const j = jointAt(solve(ch.skeleton, samplePose(a, fr)), tr.part);
      pts.push([(f.x + f.facing * j[0]) / FX, (f.y + j[1]) / FX]);
    }
    // straight trails are flattened to one height: a clean horizontal streak
    if (tr.straight) for (const pt of pts) pt[1] = pts[0][1];
    const ctx = this.ctx, width = tr.width || 5, n = pts.length - 1;
    const colors = ch.trailColors || ['#ff9a3c', '#ffe14a', '#ffffff'];
    const fade = f.stateFrame > tr.to ? Math.max(0, 1 - (f.stateFrame - tr.to) / LEN) : 1;
    ctx.save();
    ctx.lineCap = 'round';
    [[1.15, 0.5], [0.72, 0.85], [0.34, 1]].forEach(([wk, alpha], pass) => {
      ctx.strokeStyle = colors[pass];
      for (let i = 0; i < n; i++) {
        const u = i / n;                                // 0 at the limb, 1 at the tail
        const w = (width * (1 - u) * fade + 0.4) * wk;
        ctx.globalAlpha = alpha * (1 - u * 0.75) * (0.4 + 0.6 * fade);
        ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[i + 1][0], pts[i + 1][1]); ctx.stroke();
      }
    });
    ctx.restore();
  }

  drawRing(x, y, r, color, alpha, width = 1.6) {
    const ctx = this.ctx;
    ctx.strokeStyle = color; ctx.globalAlpha = Math.max(0, alpha); ctx.lineWidth = width * Math.max(0.3, alpha);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Hit spark: a spiky flash with a shock ring and flying streaks, bigger for
  // stronger hits.
  drawSpark(x, y, age, size, seed) {
    const ctx = this.ctx;
    const rot = (seed % 7) * 0.3;
    if (age <= 9) {
      const grow = age < 3 ? (age + 1) / 3 : 1, fade = age > 4 ? (10 - age) / 6 : 1;
      const burst = (r, inner, spikes, color) => {
        ctx.fillStyle = color; ctx.beginPath();
        for (let k = 0; k < spikes * 2; k++) {
          const a = rot + (k * Math.PI) / spikes;
          const d = k & 1 ? r * inner : r * (0.75 + ((k * 13 + seed) % 5) / 16);
          ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
        }
        ctx.closePath(); ctx.fill();
      };
      ctx.globalAlpha = fade;
      burst(size * 1.25 * grow, 0.34, 9, '#ff9a3c');
      burst(size * 1.0 * grow, 0.32, 9, '#ffe14a');
      burst(size * 0.62 * grow, 0.4, 7, '#ffffff');
      ctx.globalAlpha = 1;
    }
    // shock ring
    this.drawRing(x, y, size * 0.5 + age * size * 0.16, '#ffffff', 1 - age / 12, size * 0.16);
    // streaks flying outward
    ctx.lineCap = 'round';
    for (let k = 0; k < 7; k++) {
      const a = rot + 0.4 + (k * Math.PI * 2) / 7 + ((k * 29 + seed) % 10) / 20;
      const d0 = size * 0.6 + age * size * 0.22, d1 = d0 + size * 0.5 * Math.max(0, 1 - age / 16);
      ctx.strokeStyle = k & 1 ? '#ffe14a' : '#ffffff';
      ctx.globalAlpha = Math.max(0, 1 - age / 16); ctx.lineWidth = Math.max(0.3, size * 0.09 * (1 - age / 16));
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * d0, y + Math.sin(a) * d0); ctx.lineTo(x + Math.cos(a) * d1, y + Math.sin(a) * d1); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Debug view: stage solids, ledge-grab boxes, collision boxes, hurtboxes.
  // (Hitboxes are added here in milestone 2.)
  drawBoxes(state, stage, camX, camY) {
    const ctx = this.ctx;
    const rect = (x1, y1, x2, y2, color) => {
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.12; ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      ctx.globalAlpha = 1;
      ctx.fillRect(x1, y1, x2 - x1, 1); ctx.fillRect(x1, y2 - 1, x2 - x1, 1);
      ctx.fillRect(x1, y1, 1, y2 - y1); ctx.fillRect(x2 - 1, y1, 1, y2 - y1);
    };
    for (const s of stage.solids) rect(s.x - camX, s.y - camY, s.x + s.w - camX, s.y + s.h - camY, '#ff8a3c');
    for (const l of stage.ledges) {
      const a = l.dir < 0 ? l.x - CONFIG.LEDGE_REACH_X : l.x - CONFIG.LEDGE_INSIDE_X;
      const b = a + CONFIG.LEDGE_REACH_X + CONFIG.LEDGE_INSIDE_X;
      rect(a - camX, l.y - CONFIG.LEDGE_REACH_Y - camY, b - camX, l.y + CONFIG.LEDGE_REACH_Y - camY, '#40e0ff');
    }
    for (const f of state.fighters) {
      const ch = getCharacter(f.charId), st = ch.stats;
      const a = ch.animations[f.anim] || ch.animations.idle;
      const s = solve(ch.skeleton, samplePose(a, f.animFrame));
      if (f.state === 'dead' || f.state === 'out') continue;
      for (const b of hurtboxes(ch.skeleton, s, f.facing)) {
        rect(toPx(f.x + b[0]) - camX, toPx(f.y + b[1]) - camY, toPx(f.x + b[2]) - camX + 1, toPx(f.y + b[3]) - camY + 1,
          f.invuln > 0 || f.intangible > 0 ? '#5a8cff' : '#ffe14a');
      }
      rect(toPx(f.x - st.ecbHalfW) - camX, toPx(f.y - st.ecbHeight) - camY, toPx(f.x + st.ecbHalfW) - camX, toPx(f.y) - camY, '#ffffff');
      for (const b of activeHitboxes(f, ch, true)) {
        const cx = toPx(b.cx) - camX, cy = toPx(b.cy) - camY, r = b.r >> 8;
        for (let dy = -r; dy <= r; dy++) {
          const h = Math.floor(Math.sqrt(r * r - dy * dy));
          ctx.fillStyle = '#ff2a2a';
          ctx.globalAlpha = 0.35; ctx.fillRect(cx - h, cy + dy, h * 2 + 1, 1);
          ctx.globalAlpha = 1; ctx.fillRect(cx - h, cy + dy, 1, 1); ctx.fillRect(cx + h, cy + dy, 1, 1);
        }
      }
    }
  }

  // Melee-style HUD: stock icons over a big damage number that reddens and
  // darkens as it climbs, and shakes when its fighter is hit.
  drawHud(state) {
    const ctx = this.ctx;
    const n = state.fighters.length;
    for (let i = 0; i < n; i++) {
      const f = state.fighters[i];
      const ch = getCharacter(f.charId);
      const cx = Math.round(W / 2 + (i - (n - 1) / 2) * Math.min(150, (W - 30) / n));
      const base = H - 13;
      // stock icons: the character's head, one per stock left
      for (let s = 0; s < f.stocks; s++) {
        const ix = cx - (f.stocks - 1) * 5.5 + s * 11, iy = base - 31;
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(ix + 0.6, iy + 1, 5.2, 5.2, 0, 0, Math.PI * 2); ctx.fill();
        this.doll.drawHead(ctx, ch, f.alt, ix, iy, 9);
      }
      // damage number
      const p = f.percent / 10, out = f.state === 'out';
      const hitAge = f.lastHitTick >= 0 ? state.tick - f.lastHitTick : 99;
      let dx = 0, dy = 0;
      if (hitAge < 16 && !out) {
        const amp = ((16 - hitAge) / 16) * Math.min(5, 1.6 + f.lastHitDmg / 45);
        dx = Math.sin(hitAge * 2.9 + i) * amp; dy = Math.cos(hitAge * 3.7 + i) * amp;
      }
      const whole = String(Math.floor(p));
      const font = (px) => 'italic 900 ' + px + 'px "Arial Black", "Helvetica Neue", "Segoe UI", Arial, sans-serif';
      ctx.font = font(27);
      const w1 = ctx.measureText(whole).width;
      ctx.font = font(13);
      const w2 = ctx.measureText('%').width + 1;
      const left = cx - (w1 + w2) / 2 + dx, y = base + dy;
      const fill = out ? '#6d6d78' : damageColor(p);
      const text = (str, px, x, yy) => {
        ctx.font = font(px); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
        ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillText(str, x + 1.6, yy + 2);
        ctx.strokeStyle = '#17111b'; ctx.lineWidth = px * 0.13 + 0.8; ctx.strokeText(str, x, yy);
        const g = ctx.createLinearGradient(0, yy - px * 0.75, 0, yy);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, fill); g.addColorStop(1, shade(fill, 0.72));
        ctx.fillStyle = out ? fill : g; ctx.fillText(str, x, yy);
      };
      text(whole, 27, left, y);
      text('%', 13, left + w1 + 1, y);
      drawText(ctx, this.plabel(i) + ' ' + ch.name, cx, base + 4, this.pcol(i), 1, 'center', '#000000');
    }
  }

  drawPause(lines) {
    const ctx = this.ctx;
    this.ui();
    ctx.fillStyle = 'rgba(6,6,20,0.72)';
    ctx.fillRect(0, 0, W, H);
    let y = 44;
    lines.forEach((l, i) => {
      drawText(ctx, l, W / 2, y, i === 0 ? '#ffe14a' : '#ffffff', i === 0 ? 3 : 1, 'center', '#000000');
      y += i === 0 ? 28 : 9;
    });
  }

  // A short notice at the top of the screen (fades out as alpha drops).
  drawToast(text, alpha = 1) {
    const ctx = this.ctx;
    this.ui();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(8,8,24,0.85)'; ctx.fillRect(W / 2 - 120, 26, 240, 16);
    ctx.fillStyle = '#ffe14a'; ctx.fillRect(W / 2 - 120, 26, 240, 1);
    drawText(ctx, text, W / 2, 30, '#ffffff', 1, 'center', '#000000');
    ctx.globalAlpha = 1;
  }

  drawBanner(text) {
    const ctx = this.ctx;
    this.ui();
    ctx.fillStyle = 'rgba(6,6,20,0.45)';
    ctx.fillRect(0, 96, W, 60);
    drawText(ctx, text, W / 2 + 3, 109, '#1a1440', 7, 'center');
    drawText(ctx, text, W / 2, 106, '#ffe14a', 7, 'center', '#c2452d');
  }

  // Fighter select, laid out like the one in Smash: the roster as a grid of
  // portrait tiles on top, one panel per player slot along the bottom.
  // slots = [{ type: 'human' | 'cpu' | 'off', char, alt, level }] x 4,
  // active = the slot the keys are moving, levelText(slot) = its CPU label.
  drawCharSelect(chars, slots, active, levelText) {
    const ctx = this.ctx;
    this.ui();
    this.time++;
    const t = this.time;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1b1a3a'); g.addColorStop(1, '#3a2456');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    for (let x = -H + ((t >> 1) % 40); x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + H, 0); ctx.lineTo(x + H + 16, 0); ctx.lineTo(x + 16, H); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = 'rgba(8,8,24,0.82)'; ctx.fillRect(0, 0, W, 22);
    drawText(ctx, 'CHOOSE YOUR FIGHTERS', 8, 6, '#ffe14a', 2, 'left', '#000000');
    drawText(ctx, 'J OR ENTER  CONTINUE     ESC  BACK', W - 8, 9, '#ffffff', 1, 'right');

    // --- the roster ---
    const acol = PLAYER_COLORS[active];
    chars.forEach((ch, k) => {
      const r = this.charTileRect(k, chars.length);
      const here = slots.map((sl, i) => (sl.type !== 'off' && sl.char === k ? i : -1)).filter((i) => i >= 0);
      const sel = slots[active].char === k;
      // frame: the active slot's colour when its cursor is here
      ctx.fillStyle = sel ? acol : here.length ? '#8a86b0' : '#2b2a4a';
      ctx.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
      if (sel) { ctx.fillStyle = rgba('#ffffff', 0.25 + 0.25 * Math.sin(t * 0.14)); ctx.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4); }
      const bg = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
      const tint = (ch.trailColors && ch.trailColors[1]) || '#6a64c8';
      bg.addColorStop(0, shade(tint, 0.5)); bg.addColorStop(1, '#16142e');
      ctx.fillStyle = bg; ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.save();
      ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
      this.doll.drawHead(ctx, ch, 0, r.x + r.w / 2, r.y + r.h * 0.5, r.w * 0.72);
      ctx.restore();
      const band = Math.max(8, Math.round(r.h * 0.2));
      ctx.fillStyle = 'rgba(8,8,24,0.85)'; ctx.fillRect(r.x, r.y + r.h - band, r.w, band);
      drawText(ctx, ch.name, r.x + r.w / 2, r.y + r.h - band + (band - 5) / 2, '#ffffff', 1, 'center');
      // a numbered token for every slot that has picked this fighter
      here.forEach((i, n) => {
        const tx = r.x + 6 + n * 11, ty = r.y + 6 + (i === active ? Math.sin(t * 0.14) * 1.2 : 0);
        ctx.fillStyle = '#0c0b1c'; ctx.beginPath(); ctx.arc(tx, ty, 5.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = PLAYER_COLORS[i]; ctx.beginPath(); ctx.arc(tx, ty, 4.6, 0, Math.PI * 2); ctx.fill();
        drawText(ctx, String(i + 1), tx, ty - 2.5, '#101020', 1, 'center');
      });
    });

    // --- the four player panels ---
    slots.forEach((sl, i) => {
      const r = this.slotPanelRect(i), col = PLAYER_COLORS[i], cx = r.x + r.w / 2, on = sl.type !== 'off', act = i === active;
      if (act) { ctx.fillStyle = col; ctx.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4); }
      ctx.fillStyle = on ? '#14132b' : '#100f22'; ctx.fillRect(r.x, r.y, r.w, r.h);
      if (!on) {
        ctx.fillStyle = shade(col, 0.35); ctx.fillRect(r.x, r.y, r.w, 13);
        drawText(ctx, 'P' + (i + 1), r.x + 5, r.y + 4, shade(col, 0.8), 1, 'left');
        drawText(ctx, 'OFF', cx, r.y + 44, '#5d5a80', 3, 'center');
        drawText(ctx, act ? 'L  ADD A CPU' : 'PRESS ' + (i + 1), cx, r.y + 70, '#8a86b0', 1, 'center');
        return;
      }
      const ch = chars[sl.char];
      // backdrop in the player's colour, with their fighter standing in a spotlight
      const sp = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
      sp.addColorStop(0, rgba(col, 0.38)); sp.addColorStop(1, rgba(col, 0.06));
      ctx.fillStyle = sp; ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(cx, r.y + 87, 24, 3.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
      ctx.translate(cx, r.y + 86); ctx.scale(1.6, 1.6);
      this.doll.drawAnim(ctx, ch, sl.alt, 'idle', t + i * 17, 0, 0, i & 1 ? -1 : 1);
      ctx.restore();
      // header: who plays this slot
      ctx.fillStyle = col; ctx.fillRect(r.x, r.y, r.w, 13);
      drawText(ctx, 'P' + (i + 1), r.x + 5, r.y + 4, '#101020', 1, 'left');
      drawText(ctx, sl.type === 'human' ? 'PLAYER' : 'CPU ' + levelText(i), r.x + r.w - 5, r.y + 4, '#101020', 1, 'right');
      ctx.fillStyle = 'rgba(8,8,24,0.8)'; ctx.fillRect(r.x, r.y + r.h - 24, r.w, 24);
      drawText(ctx, ch.name, cx, r.y + r.h - 22, '#ffffff', 2, 'center', '#000000');
      drawText(ctx, ch.palettes[sl.alt].name, cx, r.y + r.h - 8, col, 1, 'center');
      if (act) { const by = r.y - 9 + Math.sin(t * 0.14) * 1.5; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(cx - 5, by); ctx.lineTo(cx + 5, by); ctx.lineTo(cx, by + 5); ctx.closePath(); ctx.fill(); }
    });
    const a = slots[active];
    const hint = '1-4  SLOT     W A S D  FIGHTER     K  SKIN' + (active > 0 ? '     L  ' + (a.type === 'off' ? 'ADD' : 'REMOVE') : '') + (a.type === 'cpu' ? '     U / I  CPU LEVEL' : '');
    drawText(ctx, hint, W / 2, H - 10, '#ffffff', 1, 'center', '#000000');
  }
  // Where roster tile k of n goes. Tiles shrink as the roster grows.
  charGrid(n) {
    for (const size of [46, 38, 30, 24, 19]) {
      const cols = Math.min(n, Math.floor((W - 20) / (size + 6))), rows = Math.ceil(n / cols);
      if (rows * (size + 6) <= 104 || size === 19) return { size, cols, rows };
    }
  }
  charTileRect(k, n) {
    const { size, cols, rows } = this.charGrid(n), pitch = size + 6;
    const row = Math.floor(k / cols), inRow = row === rows - 1 ? n - row * cols : cols;
    const x0 = Math.round((W - (inRow * pitch - 6)) / 2), y0 = Math.round(28 + (104 - (rows * pitch - 6)) / 2);
    return { x: x0 + (k % cols) * pitch, y: y0 + row * pitch, w: size, h: size };
  }
  slotPanelRect(i) { return { x: 11 + i * 116, y: 144, w: 110, h: 110 }; }

  // Stage select: the highlighted stage fills the screen, with a row of tiles.
  // tiles = [{ stage } | { random: true }], returns nothing; layout is in stageTileRect().
  drawStageSelect(tiles, index) {
    const ctx = this.ctx;
    this.ui();
    this.time++;
    const sel = tiles[index];
    if (sel.stage) { this.setStage(sel.stage); this.bg.draw(ctx, this.time, { x: W / 2, y: H / 2, z: 1, S: this.S }); }
    else {
      ctx.fillStyle = '#141230'; ctx.fillRect(0, 0, W, H);
      const shown = tiles[(this.time >> 3) % (tiles.length - 1)].stage; // flick through the stages
      ctx.globalAlpha = 0.35; ctx.drawImage(this.thumb(shown), 0, 0, W, H); ctx.globalAlpha = 1;
    }
    ctx.fillStyle = 'rgba(8,8,24,0.82)';
    ctx.fillRect(0, 0, W, 22);
    ctx.fillRect(0, H - 86, W, 86);
    drawText(ctx, 'STAGE SELECT', 8, 6, '#ffe14a', 2, 'left', '#000000');
    drawText(ctx, 'A / D  CHOOSE     J OR ENTER  START     ESC  BACK', W - 8, 9, '#ffffff', 1, 'right');
    drawText(ctx, sel.stage ? sel.stage.name : 'RANDOM', W / 2, H - 80, '#ffffff', 2, 'center', '#000000');
    tiles.forEach((t, i) => {
      const r = this.stageTileRect(i, tiles.length);
      ctx.fillStyle = i === index ? '#ffe14a' : '#2b2a4a';
      ctx.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
      if (t.stage) ctx.drawImage(this.thumb(t.stage), r.x, r.y, r.w, r.h);
      else {
        ctx.fillStyle = '#1b1a36'; ctx.fillRect(r.x, r.y, r.w, r.h);
        drawText(ctx, '?', r.x + r.w / 2, r.y + 12, '#ffe14a', 6, 'center', '#000000');
      }
      if (i !== index) { ctx.fillStyle = 'rgba(8,8,24,0.35)'; ctx.fillRect(r.x, r.y, r.w, r.h); }
    });
  }
  stageTileRect(i, n) {
    const w = 96, h = 54, gap = 14;
    const x0 = Math.round((W - (n * w + (n - 1) * gap)) / 2);
    return { x: x0 + i * (w + gap), y: H - 64, w, h };
  }

  drawTitle(stage, info) {
    const ctx = this.ctx;
    this.ui();
    this.setStage(stage);
    this.time++;
    this.bg.draw(ctx, this.time, { x: W / 2, y: H / 2, z: 1, S: this.S });
    const ch = getCharacter(info.charId);
    this.doll.drawAnim(ctx, ch, 0, 'idle', this.time, 240, stage.solids[0].y, 1);

    const title = CONFIG.GAME_TITLE;
    drawText(ctx, title, W / 2 + 2, 52, '#1a1440', 4, 'center');
    drawText(ctx, title, W / 2, 50, '#ffe14a', 4, 'center', '#c2452d');
    if ((this.time >> 5) & 1) drawText(ctx, 'PRESS ANY KEY', W / 2, 96, '#ffffff', 2, 'center', '#1a1440');
    drawText(ctx, 'V' + GAME_VERSION, W - 4, H - 9, '#ffffff', 1, 'right', '#1a1440');
    drawText(ctx, 'MOVEMENT TEST', 4, H - 9, '#ffffff', 1, 'left', '#1a1440');
    if (info.updateMessage) {
      ctx.fillStyle = 'rgba(10,10,24,0.8)';
      ctx.fillRect(0, 116, W, 15);
      drawText(ctx, info.updateMessage, W / 2, 121, '#7ff0e0', 1, 'center');
    }
  }
}
