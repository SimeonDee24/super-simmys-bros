// Draws everything onto the 480x270 canvas, which the browser scales up by a
// whole number so pixels stay crisp. Reads the game state but never changes it.
import { CONFIG } from '../config/config.js';
import { GAME_VERSION } from '../config/version.js';
import { FX, toPx } from '../engine/fixed.js';
import { samplePose, solve, hurtboxes } from '../engine/skeleton.js';
import { activeHitboxes, jointAt, shieldRadius, shieldCentre } from '../engine/combat.js';
import { getCharacter } from '../characters/index.js';
import { getStage } from '../stages/index.js';
import { DollRenderer } from './doll.js';
import { Background } from './background.js';
import { drawText } from './font.js';

const W = CONFIG.SCREEN_W, H = CONFIG.SCREEN_H;
const PLAYER_COLORS = ['#ff5a5a', '#5aa2ff'];

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.doll = new DollRenderer();
    this.bgs = new Map();   // one pre-rendered background per stage
    this.thumbs = new Map();
    this.bg = null;
    this.cam = { x: 0, y: 0 };
    this.time = 0;
    this.effects = [];      // short-lived visual effects (render only)
    this.seen = [];         // last drawn flags per fighter, to spot changes
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  // Largest whole-number scale that fits the window (in real device pixels).
  resize() {
    const dpr = window.devicePixelRatio || 1;
    const k = Math.max(1, Math.floor(Math.min((window.innerWidth * dpr) / W, (window.innerHeight * dpr) / H)));
    this.canvas.style.width = (W * k) / dpr + 'px';
    this.canvas.style.height = (H * k) / dpr + 'px';
  }

  setStage(stage) {
    if (!this.bgs.has(stage.id)) this.bgs.set(stage.id, new Background(stage));
    this.bg = this.bgs.get(stage.id);
  }

  resetEffects() { this.effects = []; this.seen = []; }

  // A small still picture of a stage for menus.
  thumb(stage) {
    if (!this.thumbs.has(stage.id)) {
      this.setStage(stage);
      const full = document.createElement('canvas');
      full.width = W; full.height = H;
      this.bg.draw(full.getContext('2d'), 0, 0, 0);
      const c = document.createElement('canvas');
      c.width = 96; c.height = 54;
      const cx = c.getContext('2d');
      cx.imageSmoothingEnabled = true;
      cx.drawImage(full, 0, 0, 96, 54);
      this.thumbs.set(stage.id, c);
    }
    return this.thumbs.get(stage.id);
  }

  // Fixed camera with a slight pan toward the action. No zoom.
  updateCamera(state) {
    const c = CONFIG.CAMERA;
    let ax = 0, ay = 0;
    for (const f of state.fighters) { ax += toPx(f.x); ay += toPx(f.y); }
    ax /= state.fighters.length; ay /= state.fighters.length;
    const tx = Math.max(-c.maxPanX, Math.min(c.maxPanX, (ax - W / 2) / c.followDiv));
    const ty = Math.max(-c.maxPanY, Math.min(c.maxPanY, (ay - 150) / c.followDiv));
    this.cam.x += (tx - this.cam.x) * c.ease;
    this.cam.y += (ty - this.cam.y) * c.ease;
  }

  drawMatch(state, opts = {}) {
    const ctx = this.ctx;
    const stage = getStage(state.stageId);
    this.setStage(stage);
    this.time++;
    this.updateCamera(state);
    let camX = Math.round(this.cam.x), camY = Math.round(this.cam.y);
    // screen shake while a KO blast is fresh
    for (const f of state.fighters) {
      if (f.state === 'dead' && f.stateFrame < 14) {
        const amp = (14 - f.stateFrame) >> 2;
        camX += ((f.stateFrame * 7) % 3 - 1) * amp;
        camY += ((f.stateFrame * 5) % 3 - 1) * amp;
      }
    }
    this.bg.draw(ctx, this.time, camX, camY);

    for (const f of state.fighters) {
      if (f.state === 'dead' || f.state === 'out') continue;
      const ch = getCharacter(f.charId);
      if (f.state === 'respawn') this.drawRespawnPlatform(toPx(f.x) - camX, toPx(f.y) - camY, f.slot);
      const blink = f.invuln > 0 && (state.tick >> 2) & 1;
      // the fighter who got hit shakes during hitlag
      const shake = f.hitlag > 0 && f.state === 'hitstun' ? ((f.hitlag & 1) ? 1 : -1) : 0;
      // dodging: a pale shimmer while he cannot be hit
      const dodging = f.intangible > 0 && (f.state === 'roll' || f.state === 'spotdodge' || f.state === 'airdodge' || f.state === 'ledgeRoll');
      const tint = blink ? '#ffffff' : dodging && (state.tick & 2) ? '#d8f4ff' : null;
      // directional air dodge: fading afterimages trailing behind him
      if (f.state === 'airdodge' && f.dodgeDir && (f.vx || f.vy)) {
        for (const [k, alpha] of [[6, 0.18], [3, 0.32]]) {
          this.doll.drawAnim(ctx, ch, f.alt, f.anim, f.animFrame, toPx(f.x - f.vx * k) - camX, toPx(f.y - f.vy * k) - camY, f.facing,
            { flash: '#bfeaff', alpha });
        }
      }
      this.doll.drawAnim(ctx, ch, f.alt, f.anim, f.animFrame, toPx(f.x) - camX + shake, toPx(f.y) - camY, f.facing,
        tint ? { flash: tint } : undefined);
      if (f.state === 'shield' || f.state === 'shieldStun') this.drawShield(state, f, camX, camY);
      if (f.state === 'dizzy') this.drawDizzy(f, camX, camY);
    }

    for (const f of state.fighters) this.drawTrail(f, getCharacter(f.charId), camX, camY);
    this.drawEffects(state, camX, camY);
    for (const f of state.fighters) if (f.state === 'dead') this.drawKoBlast(f);
    if (opts.showBoxes) this.drawBoxes(state, stage, camX, camY);
    this.drawHud(state);
    if (opts.debugLines) {
      let y = 4;
      for (const line of opts.debugLines) { drawText(ctx, line, 4, y, '#ffffff', 1, 'left', '#000000'); y += 7; }
    }
  }

  // Shield bubble: player-coloured, shrinks with shield health, flashes when hit.
  drawShield(state, f, camX, camY) {
    const ctx = this.ctx;
    const [cx0, cy0] = shieldCentre(f);
    const cx = toPx(cx0) - camX, cy = toPx(cy0) - camY, r = shieldRadius(f) >> 8;
    const hitFlash = f.shieldHitTick >= 0 && state.tick - f.shieldHitTick < 4;
    const low = f.shieldHp < CONFIG.SHIELD_MAX / 4;
    const col = hitFlash ? '#ffffff' : low && (state.tick & 4) ? '#ff6a4a' : PLAYER_COLORS[f.slot];
    for (let dy = -r; dy <= r; dy++) {
      const h = Math.floor(Math.sqrt(r * r - dy * dy));
      ctx.fillStyle = col; ctx.globalAlpha = 0.38;
      ctx.fillRect(cx - h, cy + dy, h * 2 + 1, 1);
      ctx.globalAlpha = 0.9;
      ctx.fillRect(cx - h, cy + dy, 1, 1); ctx.fillRect(cx + h, cy + dy, 1, 1);
    }
    // highlight
    ctx.globalAlpha = 0.7; ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - (r >> 1), cy - (r >> 1) - 1, Math.max(1, r >> 2), 1);
    ctx.fillRect(cx - (r >> 1) - 1, cy - (r >> 1), 1, Math.max(1, r >> 2));
    ctx.globalAlpha = 1;
  }

  // Dizzy after a shield break: little stars circling his head.
  drawDizzy(f, camX, camY) {
    const ctx = this.ctx, x = toPx(f.x) - camX, y = toPx(f.y) - camY - 46;
    for (let i = 0; i < 3; i++) {
      const a = (f.stateFrame / 9) + (i * Math.PI * 2) / 3;
      const sx = Math.round(x + Math.cos(a) * 8), sy = Math.round(y + Math.sin(a) * 2);
      ctx.fillStyle = '#ffe14a';
      ctx.fillRect(sx - 1, sy, 3, 1); ctx.fillRect(sx, sy - 1, 1, 3);
    }
  }

  // The little hover pad a fighter stands on after a KO.
  drawRespawnPlatform(x, y, slot) {
    const ctx = this.ctx, col = PLAYER_COLORS[slot];
    ctx.fillStyle = '#100d16'; ctx.fillRect(x - 17, y, 34, 6); ctx.fillRect(x - 12, y + 6, 24, 3);
    ctx.fillStyle = '#e9eef5'; ctx.fillRect(x - 16, y, 32, 2);
    ctx.fillStyle = '#aab3c4'; ctx.fillRect(x - 16, y + 2, 32, 3);
    ctx.fillStyle = col; ctx.fillRect(x - 13, y + 3, 26, 1);
    ctx.fillStyle = '#6a7388'; ctx.fillRect(x - 11, y + 5, 22, 3);
    // glow underneath, pulsing
    const pulse = (this.time >> 2) & 1;
    ctx.fillStyle = '#9fe9ff'; ctx.fillRect(x - 7 + pulse, y + 8, 14 - pulse * 2, 1);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 3, y + 9, 6, 1 + pulse);
  }

  // KO blast: a burst of rays shooting into the screen from where the fighter
  // crossed the blast zone, in that player's colour.
  drawKoBlast(f) {
    const ctx = this.ctx, age = f.stateFrame, LIFE = 42;
    if (age >= LIFE) return;
    const x0 = f.koX, y0 = f.koY;
    const base = Math.atan2(H / 2 - y0, W / 2 - x0); // points into the screen
    const colors = ['#ffffff', PLAYER_COLORS[f.slot], '#ffe14a'];
    const reach = Math.min(1, age / 10), fade = age > 26 ? (LIFE - age) / (LIFE - 26) : 1;
    for (let i = -7; i <= 7; i++) {
      const ang = base + i * 0.13 + ((i * 37) % 5) * 0.012;
      const len = (150 + ((i * 53 + 400) % 140)) * reach;
      const thick = Math.max(1, Math.round((5 - Math.abs(i) * 0.4) * fade));
      const start = age > 26 ? len * (1 - fade) : 0; // rays pull away from the edge as they fade
      ctx.fillStyle = colors[(i + 21) % 3];
      const cs = Math.cos(ang), sn = Math.sin(ang);
      for (let d = start; d < len; d += 2) {
        const t = Math.max(1, Math.round(thick * (1 - d / (len + 1) * 0.7)));
        ctx.fillRect(Math.round(x0 + cs * d - t / 2), Math.round(y0 + sn * d - t / 2), t, t);
      }
    }
    // flash at the source
    const r = Math.round((age < 6 ? 10 + age * 6 : 46) * fade);
    for (const [rr, col] of [[r, PLAYER_COLORS[f.slot]], [Math.round(r * 0.7), '#ffe14a'], [Math.round(r * 0.4), '#ffffff']]) {
      ctx.fillStyle = col;
      for (let dy = -rr; dy <= rr; dy++) {
        const half = Math.floor(Math.sqrt(rr * rr - dy * dy));
        ctx.fillRect(x0 - half, y0 + dy, half * 2 + 1, 1);
      }
    }
    if (age < 3) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(0, 0, W, H); }
  }

  // Effects are spawned by watching the state change between drawn frames and
  // aged by the simulation tick, so they freeze correctly while paused.
  drawEffects(state, camX, camY) {
    const ctx = this.ctx;
    state.fighters.forEach((f, i) => {
      const was = this.seen[i] || {};
      if (f.fastFall && !was.fastFall) {
        this.effects.push({ type: 'fastfall', x: toPx(f.x), y: toPx(f.y) - 24, tick: state.tick });
      }
      if (f.lastHitTick >= 0 && f.lastHitTick !== was.lastHitTick && was.lastHitTick !== undefined) {
        this.effects.push({ type: 'spark', x: f.hitX, y: f.hitY, tick: state.tick, size: Math.min(14, 5 + (f.lastHitDmg / 14 | 0)), seed: f.lastHitTick });
      }
      if (f.parryTick >= 0 && f.parryTick !== was.parryTick && was.parryTick !== undefined) {
        this.effects.push({ type: 'parry', x: toPx(f.x), y: toPx(f.y) - 22, tick: state.tick });
      }
      if (f.state === 'shieldBreak' && was.state !== 'shieldBreak' && was.state !== undefined) {
        this.effects.push({ type: 'break', x: toPx(f.x), y: toPx(f.y) - 22, tick: state.tick, slot: f.slot });
      }
      this.seen[i] = { fastFall: f.fastFall, lastHitTick: f.lastHitTick, parryTick: f.parryTick, state: f.state };
    });
    this.effects = this.effects.filter((e) => state.tick >= e.tick && state.tick - e.tick < (e.type === 'break' ? 30 : e.type === 'parry' ? 22 : 14));
    for (const e of this.effects) {
      const age = state.tick - e.tick;
      const x = e.x - camX, y = e.y - camY;
      if (e.type === 'spark') { this.drawSpark(x, y, age, e.size, e.seed); continue; }
      if (e.type === 'parry') { this.drawRing(x, y, 6 + age * 2, age < 6 ? '#ffffff' : '#9fe9ff', 1 - age / 22); continue; }
      if (e.type === 'break') {
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2, d = 4 + age * 2.2;
          ctx.fillStyle = k & 1 ? '#ffffff' : PLAYER_COLORS[e.slot];
          ctx.globalAlpha = Math.max(0, 1 - age / 30);
          ctx.fillRect(Math.round(x + Math.cos(a) * d) - 1, Math.round(y + Math.sin(a) * d) - 1, 3, 3);
        }
        ctx.globalAlpha = 1;
        if (age < 3) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(0, 0, W, H); }
        continue;
      }
      // four-point twinkle: grows fast, then shrinks
      const len = age < 3 ? 3 + age * 2 : Math.max(1, 8 - ((age - 3) * 2) / 3 | 0);
      ctx.fillStyle = '#5fc8ff';
      ctx.fillRect(x - len, y, len * 2 + 1, 1);
      ctx.fillRect(x, y - len, 1, len * 2 + 1);
      const d = Math.max(1, len >> 1);
      ctx.fillStyle = '#bff0ff';
      ctx.fillRect(x - d, y - 1, d * 2 + 1, 3);
      ctx.fillRect(x - 1, y - d, 3, d * 2 + 1);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - (d >> 1), y, (d >> 1) * 2 + 1, 1);
      ctx.fillRect(x, y - (d >> 1), 1, (d >> 1) * 2 + 1);
    }
  }

  // Swipe arc: a bright ribbon following a fist or foot through the last few
  // frames of an attack. Rebuilt from the animation every frame, so it needs
  // no history and freezes correctly in hitlag and pause.
  drawTrail(f, ch, camX, camY) {
    if (f.state !== 'attack' || !f.move) return;
    const tr = ch.moves[f.move].trail;
    if (!tr) return;
    const LEN = 6;
    const newest = Math.min(f.stateFrame, tr.to), oldest = Math.max(tr.from, f.stateFrame - LEN);
    if (newest <= oldest) return;
    const a = ch.animations[f.anim];
    const pts = [];
    for (let fr = newest; fr >= oldest; fr--) {
      const j = jointAt(solve(ch.skeleton, samplePose(a, fr)), tr.part);
      pts.push([toPx(f.x + f.facing * j[0]) - camX, toPx(f.y + j[1]) - camY]);
    }
    const ctx = this.ctx, width = tr.width || 5, n = pts.length - 1;
    const colors = ch.trailColors || ['#ff9a3c', '#ffe14a', '#ffffff'];
    const fade = f.stateFrame > tr.to ? Math.max(0, 1 - (f.stateFrame - tr.to) / LEN) : 1;
    colors.forEach((col, pass) => {
      ctx.fillStyle = col;
      for (let i = 0; i < n; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
        const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
        for (let s = 0; s <= steps; s++) {
          const u = (i + s / steps) / n;              // 0 at the limb, 1 at the tail
          const w = Math.round((width * (1 - u) * fade + 1) * (1 - pass * 0.36));
          if (w < 1) continue;
          ctx.fillRect(Math.round(x0 + ((x1 - x0) * s) / steps - w / 2), Math.round(y0 + ((y1 - y0) * s) / steps - w / 2), w, w);
        }
      }
    });
  }

  drawRing(x, y, r, color, alpha) {
    const ctx = this.ctx;
    ctx.fillStyle = color; ctx.globalAlpha = Math.max(0, alpha);
    for (let a = 0; a < 64; a++) {
      const t = (a / 64) * Math.PI * 2;
      ctx.fillRect(Math.round(x + Math.cos(t) * r), Math.round(y + Math.sin(t) * r), 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  // Hit spark: a jagged burst that is bigger for stronger hits.
  drawSpark(x, y, age, size, seed) {
    const ctx = this.ctx;
    if (age > 9) return;
    const grow = age < 3 ? (age + 1) / 3 : 1, fade = age > 5 ? (10 - age) / 5 : 1;
    const spikes = 8;
    for (let i = 0; i < spikes; i++) {
      const ang = (i / spikes) * Math.PI * 2 + (seed % 7) * 0.3;
      const len = size * grow * (i & 1 ? 1 : 0.55);
      const inner = age > 3 ? len * (1 - fade) : 0;
      const cs = Math.cos(ang), sn = Math.sin(ang);
      for (let d = inner; d <= len; d++) {
        const t = Math.max(1, Math.round((1 - d / (len + 1)) * 3 * fade));
        ctx.fillStyle = d < len * 0.5 ? '#ffffff' : (i & 1 ? '#ffe14a' : '#ff9a3c');
        ctx.fillRect(Math.round(x + cs * d - t / 2), Math.round(y + sn * d - t / 2), t, t);
      }
    }
    if (age < 4) {
      const r = Math.round(size * 0.45 * grow);
      ctx.fillStyle = '#ffffff';
      for (let dy = -r; dy <= r; dy++) { const h = Math.floor(Math.sqrt(r * r - dy * dy)); ctx.fillRect(x - h, y + dy, h * 2 + 1, 1); }
    }
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

  drawHud(state) {
    const ctx = this.ctx;
    const n = state.fighters.length;
    for (let i = 0; i < n; i++) {
      const f = state.fighters[i];
      const ch = getCharacter(f.charId);
      const cx = Math.round(W / 2 + (i - (n - 1) / 2) * 150);
      const y = H - 30;
      ctx.fillStyle = 'rgba(10,10,24,0.78)';
      ctx.fillRect(cx - 38, y - 3, 76, 28);
      ctx.fillStyle = PLAYER_COLORS[i];
      ctx.fillRect(cx - 38, y - 3, 76, 2);
      drawText(ctx, 'P' + (i + 1) + ' ' + ch.name, cx, y + 2, PLAYER_COLORS[i], 1, 'center', '#000000');
      // percent shifts from white through yellow and orange to red as it climbs
      const p = f.percent / 10;
      const pc = p < 30 ? '#ffffff' : p < 60 ? '#ffe9a0' : p < 90 ? '#ffc04a' : p < 120 ? '#ff8a3c' : '#ff4a3a';
      drawText(ctx, p.toFixed(1) + '%', cx, y + 10, pc, 2, 'center', '#000000');
      for (let s = 0; s < f.stocks; s++) {
        ctx.fillStyle = '#000000'; ctx.fillRect(cx - 35 + s * 6, y + 19, 5, 5);
        ctx.fillStyle = PLAYER_COLORS[i]; ctx.fillRect(cx - 34 + s * 6, y + 20, 3, 3);
      }
    }
  }

  drawPause(lines) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(6,6,20,0.72)';
    ctx.fillRect(0, 0, W, H);
    let y = 44;
    lines.forEach((l, i) => {
      drawText(ctx, l, W / 2, y, i === 0 ? '#ffe14a' : '#ffffff', i === 0 ? 3 : 1, 'center', '#000000');
      y += i === 0 ? 28 : 9;
    });
  }

  drawBanner(text) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(6,6,20,0.45)';
    ctx.fillRect(0, 96, W, 60);
    drawText(ctx, text, W / 2 + 3, 109, '#1a1440', 7, 'center');
    drawText(ctx, text, W / 2, 106, '#ffe14a', 7, 'center', '#c2452d');
  }

  // Stage select: the highlighted stage fills the screen, with a row of tiles.
  // tiles = [{ stage } | { random: true }], returns nothing; layout is in stageTileRect().
  drawStageSelect(tiles, index) {
    const ctx = this.ctx;
    this.time++;
    const sel = tiles[index];
    if (sel.stage) { this.setStage(sel.stage); this.bg.draw(ctx, this.time, 0, 0); }
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
    this.setStage(stage);
    this.time++;
    this.bg.draw(ctx, this.time, 0, 0);
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
