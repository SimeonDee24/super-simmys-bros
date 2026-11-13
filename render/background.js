// Draws a stage from its data: banded sky gradient, sun, parallax layers
// (clouds, mountains, trees) and the platform with its surroundings.
// Everything is pre-rendered once into small canvases, then composited every
// frame. Render only: floats and its own RNG are fine here because nothing
// feeds back into the simulation.
import { drawText } from './font.js';

const W = 480, H = 270, LAYER_W = 720, LAYER_H = H + 60;

function rng32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mix(a, b, t) {
  const A = hex(a), B = hex(b);
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`;
}
// Hard-edged filled circle, optionally cut flat at maxY.
function disc(ctx, cx, cy, r, maxY = Infinity) {
  for (let dy = -r; dy <= r; dy++) {
    const y = cy + dy;
    if (y > maxY) break;
    const half = Math.floor(Math.sqrt(r * r - dy * dy));
    ctx.fillRect(cx - half, y, half * 2 + 1, 1);
  }
}

// ---------------------------------------------------------------------------
// Parallax layer builders. Each returns a LAYER_W-wide canvas that tiles.
// ---------------------------------------------------------------------------
const LAYER_BUILDERS = {
  clouds(l) {
    const c = makeCanvas(LAYER_W, LAYER_H), ctx = c.getContext('2d');
    const rnd = rng32(l.seed);
    const clouds = [];
    for (let i = 0; i < l.count; i++) {
      const size = l.size[0] + rnd() * (l.size[1] - l.size[0]);
      const cx = Math.round((i + rnd() * 0.8) * (LAYER_W / l.count));
      const cy = Math.round(l.y[0] + rnd() * (l.y[1] - l.y[0]));
      const puffs = [];
      const n = 4 + Math.floor(rnd() * 3);
      for (let p = 0; p < n; p++) {
        const t = p / (n - 1);
        const edge = 1 - Math.abs(t - 0.5) * 1.3;
        puffs.push({ dx: Math.round((t - 0.5) * size * 2.2), r: Math.max(3, Math.round(size * (0.25 + 0.3 * edge + rnd() * 0.12))) });
      }
      clouds.push({ cx, cy, puffs });
    }
    const pass = (color, dy, shrink) => {
      ctx.fillStyle = color;
      for (const cl of clouds) for (const off of [-LAYER_W, 0, LAYER_W]) {
        for (const p of cl.puffs) {
          const r = Math.max(1, p.r - shrink);
          disc(ctx, cl.cx + off + p.dx, cl.cy - r + dy - shrink, r, cl.cy + dy);
        }
      }
    };
    pass(l.shade, 0, 0);
    pass(l.color, -2, 0);
    pass(l.light, -3, 3);
    return c;
  },

  // A jagged ridge line, optionally snow-capped. Built from whole-number
  // wave counts so the left and right edges join up.
  mountains(l) {
    const c = makeCanvas(LAYER_W, LAYER_H), ctx = c.getContext('2d');
    const rnd = rng32(l.seed);
    const waves = [1, 2, 3, 5, 8, 13, 21, 34].map((k) => ({ k, a: (0.5 + rnd()) / Math.pow(k, 0.85), p: rnd() * Math.PI * 2 }));
    const raw = [];
    let lo = Infinity, hi = -Infinity;
    for (let x = 0; x < LAYER_W; x++) {
      let v = 0;
      for (const w of waves) v += w.a * Math.sin((x / LAYER_W) * Math.PI * 2 * w.k + w.p);
      v = -Math.abs(v); // sharp peaks instead of round hills
      raw.push(v); lo = Math.min(lo, v); hi = Math.max(hi, v);
    }
    const hAt = (x) => l.height[0] + ((raw[(x + LAYER_W) % LAYER_W] - lo) / (hi - lo)) * (l.height[1] - l.height[0]);
    const snowH = l.snow ? l.height[0] + (l.height[1] - l.height[0]) * l.snowLine : Infinity;
    for (let x = 0; x < LAYER_W; x++) {
      const h = Math.round(hAt(x));
      const top = l.baseY - h;
      const shaded = hAt(x + 2) < hAt(x - 2); // slope facing away from the sun
      ctx.fillStyle = shaded ? l.shade : l.color;
      ctx.fillRect(x, top, 1, LAYER_H - top);
      if (h > snowH) {
        const jag = ((x * 7) % 5) + ((x * 3) % 4);
        const len = Math.max(1, Math.round((h - snowH) * 0.8) - jag);
        ctx.fillStyle = shaded ? l.snowShade : l.snow;
        ctx.fillRect(x, top, 1, len);
      }
    }
    return c;
  },

  // A row of evergreens.
  trees(l) {
    const c = makeCanvas(LAYER_W, LAYER_H), ctx = c.getContext('2d');
    const rnd = rng32(l.seed);
    const trees = [];
    for (let x = 0; x < LAYER_W; x += 7 + Math.floor(rnd() * 9)) {
      trees.push({ x, h: Math.round(l.height[0] + rnd() * (l.height[1] - l.height[0])) });
    }
    ctx.fillStyle = l.color;
    ctx.fillRect(0, l.baseY - l.height[0] + 6, LAYER_W, LAYER_H);
    for (const t of trees) for (const off of [-LAYER_W, 0, LAYER_W]) {
      const w = t.h * 0.42, tier = 7;
      for (let r = 0; r < t.h; r++) {
        const half = Math.round((w / 2) * (0.2 + 0.8 * (r / t.h)) * (0.5 + 0.5 * ((r % tier) / tier)));
        const y = l.baseY - t.h + r;
        ctx.fillStyle = l.color;
        ctx.fillRect(t.x + off - half, y, half * 2 + 1, 1);
        if (half > 1) { ctx.fillStyle = l.light; ctx.fillRect(t.x + off - half, y, Math.max(1, half >> 1), 1); }
      }
    }
    return c;
  },
};

const TOOLS = { rng32, disc, drawText };
const MARGIN_X = (LAYER_W - W) / 2, MARGIN_Y = 10;

// A stage-specific painting: the stage file supplies draw(ctx, tools, stage),
// working in screen coordinates. It does not tile, so it is drawn once with a
// margin on every side for the camera pan.
LAYER_BUILDERS.custom = (l, stage) => {
  const c = makeCanvas(LAYER_W, LAYER_H + MARGIN_Y * 2), ctx = c.getContext('2d');
  ctx.translate(MARGIN_X, MARGIN_Y);
  l.draw(ctx, TOOLS, stage);
  return c;
};

export class Background {
  constructor(stage) {
    this.stage = stage;
    this.sky = this.buildSky(stage.background);
    this.layers = stage.background.layers.map((l) => ({ def: l, canvas: (LAYER_BUILDERS[l.type] || LAYER_BUILDERS.clouds)(l, stage) }));
    this.platform = makeCanvas(W, LAYER_H + 60);
    this.platformOffY = 60; // room above the screen for tall art
    const pctx = this.platform.getContext('2d');
    pctx.translate(0, this.platformOffY);
    stage.art.draw(pctx, stage, TOOLS); // the stage paints its own platform
  }

  buildSky(bg) {
    const c = makeCanvas(W, H), ctx = c.getContext('2d');
    const bandH = H / bg.bands;
    const colorAt = (t) => {
      for (let i = 1; i < bg.sky.length; i++) {
        if (t <= bg.sky[i][0]) {
          const [t0, c0] = bg.sky[i - 1], [t1, c1] = bg.sky[i];
          return mix(c0, c1, (t - t0) / (t1 - t0));
        }
      }
      return bg.sky[bg.sky.length - 1][1];
    };
    for (let b = 0; b < bg.bands; b++) {
      const y0 = Math.round(b * bandH), y1 = Math.round((b + 1) * bandH);
      ctx.fillStyle = colorAt(b / (bg.bands - 1));
      ctx.fillRect(0, y0, W, y1 - y0);
      // one dithered row so the bands blend like pixel art
      if (b > 0) for (let x = (b & 1); x < W; x += 2) ctx.fillRect(x, y0 - 1, 1, 1);
    }
    const s = bg.sun;
    if (s) {
      ctx.fillStyle = s.glow; disc(ctx, s.x, s.y, s.r + 7);
      ctx.fillStyle = s.mid; disc(ctx, s.x, s.y, s.r + 3);
      ctx.fillStyle = s.core; disc(ctx, s.x, s.y, s.r);
    }
    return c;
  }

  drawLayer(ctx, l, time, camX, camY) {
    const d = l.def;
    if (d.type === 'custom') {
      ctx.drawImage(l.canvas, -MARGIN_X - Math.round(camX * d.parallax), -MARGIN_Y - Math.round(camY * d.parallax));
      return;
    }
    const off = Math.floor((time * (d.speed || 0)) / 60 + camX * d.parallax);
    const x = -(((off % LAYER_W) + LAYER_W) % LAYER_W);
    const y = -Math.round(camY * d.parallax);
    ctx.drawImage(l.canvas, x, y);
    ctx.drawImage(l.canvas, x + LAYER_W, y);
  }

  // time = rendered frames since start, cam = camera pan in pixels.
  // Layers marked front: true are drawn over the platform art (still behind fighters).
  draw(ctx, time, camX, camY) {
    ctx.drawImage(this.sky, 0, 0);
    for (const l of this.layers) if (!l.def.front) this.drawLayer(ctx, l, time, camX, camY);
    ctx.drawImage(this.platform, -camX, -camY - this.platformOffY);
    for (const l of this.layers) if (l.def.front) this.drawLayer(ctx, l, time, camX, camY);
  }
}
