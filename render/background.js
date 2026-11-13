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
// Custom paintings and the platform art are drawn with room on every side,
// because the camera zooms out and pans.
const MARGIN_X = 200, MARGIN_TOP = 70, CUSTOM_W = W + MARGIN_X * 2, CUSTOM_H = 480;
const PLAT_TOP = 60, PLAT_H = 440;

// Pixel-art smoothing (the EPX / Scale2x rule): doubles a picture, rounding
// off staircase edges instead of just making the squares bigger.
function smooth2x(src) {
  const w = src.width, h = src.height;
  const sd = new Uint32Array(src.getContext('2d').getImageData(0, 0, w, h).data.buffer);
  const out = makeCanvas(w * 2, h * 2), octx = out.getContext('2d');
  const img = octx.createImageData(w * 2, h * 2);
  const od = new Uint32Array(img.data.buffer);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x, P = sd[i];
      const A = y > 0 ? sd[i - w] : P, D = y < h - 1 ? sd[i + w] : P;
      const C = x > 0 ? sd[i - 1] : P, B = x < w - 1 ? sd[i + 1] : P;
      const o = y * 2 * w * 2 + x * 2;
      od[o] = C === A && C !== D && A !== B ? A : P;
      od[o + 1] = A === B && A !== C && B !== D ? B : P;
      od[o + w * 2] = D === C && D !== B && C !== A ? C : P;
      od[o + w * 2 + 1] = B === D && B !== A && D !== C ? D : P;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}

// A stage-specific painting: the stage file supplies draw(ctx, tools, stage),
// working in screen coordinates. It does not tile, so it is drawn once with a
// margin on every side for the camera pan.
LAYER_BUILDERS.custom = (l, stage) => {
  const c = makeCanvas(CUSTOM_W, CUSTOM_H), ctx = c.getContext('2d');
  ctx.translate(MARGIN_X, MARGIN_TOP);
  l.draw(ctx, TOOLS, stage);
  return c;
};

export class Background {
  constructor(stage) {
    this.stage = stage;
    this.sky = this.buildSky(stage.background);
    // layers are smoothed to double size; the platform, which the fighters
    // stand right next to, is smoothed twice (4x)
    this.layers = stage.background.layers.map((l) => ({ def: l, canvas: smooth2x((LAYER_BUILDERS[l.type] || LAYER_BUILDERS.clouds)(l, stage)) }));
    const plat = makeCanvas(W + MARGIN_X * 2, PLAT_H);
    const pctx = plat.getContext('2d');
    pctx.translate(MARGIN_X, PLAT_TOP);
    stage.art.draw(pctx, stage, TOOLS); // the stage paints its own platform
    this.platform = smooth2x(smooth2x(plat));
  }

  // A smooth sky gradient with a glowing sun.
  buildSky(bg) {
    const K = 2, c = makeCanvas(W * K, H * K), ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, H * K);
    for (const [t, col] of bg.sky) g.addColorStop(t, col);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W * K, H * K);
    const s = bg.sun;
    if (s) {
      const x = s.x * K, y = s.y * K, r = s.r * K;
      const halo = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 4.5);
      halo.addColorStop(0, 'rgba(255,250,225,0.55)'); halo.addColorStop(0.35, 'rgba(255,245,210,0.18)'); halo.addColorStop(1, 'rgba(255,245,210,0)');
      ctx.fillStyle = halo; ctx.fillRect(0, 0, W * K, H * K);
      const core = ctx.createRadialGradient(x, y, 0, x, y, r * 1.25);
      core.addColorStop(0, '#ffffff'); core.addColorStop(0.7, s.core); core.addColorStop(0.9, s.mid); core.addColorStop(1, 'rgba(255,238,176,0)');
      ctx.fillStyle = core; ctx.beginPath(); ctx.arc(x, y, r * 1.25, 0, Math.PI * 2); ctx.fill();
    }
    return c;
  }

  // How much a layer grows and shrinks with the camera zoom. Far layers
  // (small parallax) barely change, like distant scenery.
  layerScale(d, z) { return 1 + (z - 1) * (0.15 + 0.2 * Math.min(1, d.parallax)); }

  drawLayer(ctx, l, time, view) {
    const d = l.def, S = view.S, s = this.layerScale(d, view.z);
    const ox = (view.x - W / 2) * d.parallax, oy = (view.y - H / 2) * d.parallax;
    // layer pixel p lands on screen at ((p - centre) - offset) * s + centre
    ctx.setTransform(S * s, 0, 0, S * s, S * (W / 2 - (W / 2 + ox) * s), S * (H / 2 - (H / 2 + oy) * s));
    if (d.type === 'custom') { ctx.drawImage(l.canvas, -MARGIN_X, -MARGIN_TOP, CUSTOM_W, CUSTOM_H); return; }
    const drift = (time * (d.speed || 0)) / 60;
    // tile across everything the screen can see
    const left = W / 2 + ox - W / 2 / s, right = W / 2 + ox + W / 2 / s;
    for (let k = Math.floor((left + drift) / LAYER_W); k * LAYER_W - drift < right; k++) {
      ctx.drawImage(l.canvas, k * LAYER_W - drift, 0, LAYER_W + 0.5, LAYER_H);
    }
    // keep filling downward with the layer's bottom edge colour
    const bottom = H / 2 + oy + H / 2 / s;
    if (bottom > LAYER_H && d.type && d.type !== 'clouds') { ctx.fillStyle = d.color; ctx.fillRect(left - 2, LAYER_H - 0.5, right - left + 4, bottom - LAYER_H + 2); }
  }

  // time = rendered frames since start.
  // view = { x, y: world point at the centre of the screen, z: zoom, S: real
  // pixels per screen unit }. Leaves the context in plain screen units.
  // Layers marked front: true are drawn over the platform art (still behind fighters).
  draw(ctx, time, view = { x: W / 2, y: H / 2, z: 1, S: 1 }) {
    const S = view.S, z = view.z;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'low';   // plain bilinear: much cheaper for full-screen pictures
    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.drawImage(this.sky, 0, 0, W, H);
    for (const l of this.layers) if (!l.def.front) this.drawLayer(ctx, l, time, view);
    ctx.setTransform(S * z, 0, 0, S * z, S * (W / 2 - view.x * z), S * (H / 2 - view.y * z));
    ctx.drawImage(this.platform, -MARGIN_X, -PLAT_TOP, W + MARGIN_X * 2, PLAT_H);
    for (const l of this.layers) if (l.def.front) this.drawLayer(ctx, l, time, view);
    ctx.setTransform(S, 0, 0, S, 0, 0);
  }
}
