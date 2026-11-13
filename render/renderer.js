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
    if (!this.bg || this.bg.stage !== stage) this.bg = new Background(stage);
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
    const camX = Math.round(this.cam.x), camY = Math.round(this.cam.y);
    this.bg.draw(ctx, this.time, camX, camY);

    for (const f of state.fighters) {
      const ch = getCharacter(f.charId);
      const blink = f.invuln > 0 && (state.tick >> 2) & 1;
      this.doll.drawAnim(ctx, ch, f.alt, f.anim, f.animFrame, toPx(f.x) - camX, toPx(f.y) - camY, f.facing,
        blink ? { flash: '#ffffff' } : undefined);
    }

    this.drawEffects(state, camX, camY);
    if (opts.showBoxes) this.drawBoxes(state, stage, camX, camY);
    this.drawHud(state);
    if (opts.debugLines) {
      let y = 4;
      for (const line of opts.debugLines) { drawText(ctx, line, 4, y, '#ffffff', 1, 'left', '#000000'); y += 7; }
    }
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
