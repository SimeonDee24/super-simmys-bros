// Draws everything onto the 480x270 canvas, which the browser scales up by a
// whole number so pixels stay crisp. Reads the game state but never changes it.
import { CONFIG } from '../config/config.js';
import { GAME_VERSION } from '../config/version.js';
import { FX, toPx } from '../engine/fixed.js';
import { samplePose, solve, hurtboxes } from '../engine/skeleton.js';
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
      this.doll.drawAnim(ctx, ch, f.alt, f.anim, f.animFrame, toPx(f.x) - camX, toPx(f.y) - camY, f.facing,
        blink ? { flash: '#ffffff' } : undefined);
    }

    this.drawEffects(state, camX, camY);
    for (const f of state.fighters) if (f.state === 'dead') this.drawKoBlast(f);
    if (opts.showBoxes) this.drawBoxes(state, stage, camX, camY);
    this.drawHud(state);
    if (opts.debugLines) {
      let y = 4;
      for (const line of opts.debugLines) { drawText(ctx, line, 4, y, '#ffffff', 1, 'left', '#000000'); y += 7; }
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
      this.seen[i] = { fastFall: f.fastFall };
    });
    this.effects = this.effects.filter((e) => state.tick >= e.tick && state.tick - e.tick < 14);
    for (const e of this.effects) {
      const age = state.tick - e.tick;
      const x = e.x - camX, y = e.y - camY;
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
          f.invuln > 0 ? '#5a8cff' : '#ffe14a');
      }
      rect(toPx(f.x - st.ecbHalfW) - camX, toPx(f.y - st.ecbHeight) - camY, toPx(f.x + st.ecbHalfW) - camX, toPx(f.y) - camY, '#ffffff');
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
      drawText(ctx, f.percent + '%', cx, y + 10, '#ffffff', 2, 'center', '#000000');
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
