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

// ---------------------------------------------------------------------------
// Platform art styles. Each draws the stage's solids (and anything attached
// to them) into a canvas that moves with the camera.
// ---------------------------------------------------------------------------
const PLATFORM_STYLES = {
  // A balcony on a glass-and-timber building.
  balcony(ctx, stage) {
    const a = stage.art, rnd = rng32(a.seed);
    const [main, tier2, tier3] = stage.solids;
    const fx = a.facade.x, fw = a.facade.w, ftop = a.facade.top;
    const deckY = main.y;

    // --- Lower floor, behind and below the balcony ---
    ctx.fillStyle = a.lowerWall;
    ctx.fillRect(fx, deckY + 10, fw, LAYER_H);
    ctx.fillStyle = a.concreteDark;
    for (let y = deckY + 60; y < LAYER_H; y += 9) ctx.fillRect(fx, y, fw, 1);
    ctx.fillStyle = a.lowerWindow;
    ctx.fillRect(fx + 8, deckY + 76, fw - 16, 20);
    ctx.fillStyle = a.concreteDark;
    for (let x = fx + 8; x < fx + fw - 8; x += 19) ctx.fillRect(x, deckY + 76, 1, 20);
    ctx.fillStyle = a.concreteShade; ctx.fillRect(fx, deckY + 10, 2, LAYER_H);
    ctx.fillStyle = a.concreteDark; ctx.fillRect(fx + fw - 2, deckY + 10, 2, LAYER_H);

    // --- Upper floor: glass curtain wall ---
    const gh = deckY - ftop;
    for (let y = 0; y < gh; y++) {
      ctx.fillStyle = a.glass[Math.min(2, Math.floor((y / gh) * 3))];
      ctx.fillRect(fx, ftop + y, fw, 1);
    }
    // soft diagonal reflections
    ctx.fillStyle = a.glassLine;
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 9; i++) {
      const sx = fx + 10 + Math.floor(rnd() * (fw - 40)), len = 18 + Math.floor(rnd() * 40), wdt = 2 + Math.floor(rnd() * 4);
      for (let k = 0; k < len; k++) {
        const x = sx + (k >> 1), y = deckY - 6 - k;
        if (y > ftop + 12 && x + wdt < fx + fw) ctx.fillRect(x, y, wdt, 1);
      }
    }
    ctx.globalAlpha = 1;
    // warm ceiling lights seen through the glass
    ctx.fillStyle = '#ffe9b0';
    ctx.globalAlpha = 0.55;
    for (let x = fx + 14; x < fx + fw - 10; x += 20) ctx.fillRect(x, ftop + 15, 6, 1);
    ctx.globalAlpha = 1;
    // mullions
    ctx.fillStyle = a.mullion;
    for (let x = fx; x <= fx + fw; x += 20) ctx.fillRect(Math.min(x, fx + fw - 1), ftop, 1, gh);
    ctx.fillRect(fx, ftop + 46, fw, 1);
    ctx.fillRect(fx, deckY - 30, fw, 1);
    // timber columns in front of the glass
    for (let x = fx + 2; x <= fx + fw - 6; x += 60) {
      ctx.fillStyle = a.wood; ctx.fillRect(x, ftop, 5, gh);
      ctx.fillStyle = a.woodLight; ctx.fillRect(x, ftop, 1, gh);
      ctx.fillStyle = a.woodShade; ctx.fillRect(x + 4, ftop, 1, gh);
    }
    // header band with the sign
    ctx.fillStyle = a.metal; ctx.fillRect(fx, ftop, fw, 11);
    ctx.fillStyle = a.metalLight; ctx.fillRect(fx, ftop + 10, fw, 1);
    drawText(ctx, a.sign, fx + (fw >> 1), ftop + 3, a.signColor, 1, 'center');

    // --- Roof canopy with a timber underside ---
    const cx0 = fx - 16, cw = fw + 32;
    ctx.fillStyle = a.metal; ctx.fillRect(cx0, ftop - 10, cw, 4);
    ctx.fillStyle = a.metalLight; ctx.fillRect(cx0, ftop - 10, cw, 1);
    ctx.fillStyle = a.wood; ctx.fillRect(cx0 + 2, ftop - 6, cw - 4, 6);
    ctx.fillStyle = a.woodShade; ctx.fillRect(cx0 + 2, ftop - 2, cw - 4, 2);
    for (let x = cx0 + 8; x < cx0 + cw - 4; x += 9) ctx.fillRect(x, ftop - 6, 1, 4);
    // rooftop garden peeking over the canopy
    for (let x = fx + 10; x < fx + fw - 10; x += 4 + Math.floor(rnd() * 5)) {
      const h = 2 + Math.floor(rnd() * 5);
      ctx.fillStyle = rnd() < 0.5 ? a.plant : a.plantDark;
      ctx.fillRect(x, ftop - 10 - h, 3, h);
    }

    // --- Glass railings on the parts of the balcony beyond the wall ---
    for (const [x0, x1] of [[main.x, fx], [fx + fw, main.x + main.w]]) {
      ctx.fillStyle = a.railGlass; ctx.fillRect(x0, deckY - 14, x1 - x0, 14);
      ctx.fillStyle = a.rail; ctx.fillRect(x0, deckY - 15, x1 - x0, 1);
      ctx.fillStyle = a.mullion;
      ctx.fillRect(x0, deckY - 15, 1, 15); ctx.fillRect(x1 - 1, deckY - 15, 1, 15);
    }

    // --- Planter boxes against the wall ---
    for (const px0 of [fx + 12, fx + fw - 46]) {
      for (let x = px0 + 1; x < px0 + 33; x += 3) {
        const h = 5 + Math.floor(rnd() * 8);
        ctx.fillStyle = a.plantDark; disc(ctx, x + 1, deckY - 9 - h + 3, 3);
        ctx.fillStyle = a.plant; disc(ctx, x, deckY - 10 - h + 3, 2);
        ctx.fillStyle = a.plantLight; ctx.fillRect(x - 1, deckY - 12 - h + 3, 2, 1);
      }
      ctx.fillStyle = a.wood; ctx.fillRect(px0, deckY - 9, 34, 9);
      ctx.fillStyle = a.woodLight; ctx.fillRect(px0, deckY - 9, 34, 1);
      ctx.fillStyle = a.woodShade; ctx.fillRect(px0, deckY - 5, 34, 1); ctx.fillRect(px0, deckY - 1, 34, 1);
    }

    // --- Stepped timber underside (solids 2 and 3) ---
    for (const s of [tier3, tier2]) {
      ctx.fillStyle = a.wood; ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.fillStyle = a.woodShade;
      ctx.fillRect(s.x, s.y, s.w, 2);
      ctx.fillRect(s.x, s.y + s.h - 2, s.w, 2);
      for (let x = s.x + 7; x < s.x + s.w; x += 8) ctx.fillRect(x, s.y + 2, 1, s.h - 4);
      ctx.fillStyle = a.woodLight; ctx.fillRect(s.x, s.y + 2, 1, s.h - 4);
    }

    // --- Balcony slab (solid 1): concrete edge with a timber deck on top ---
    ctx.fillStyle = a.concrete; ctx.fillRect(main.x, main.y, main.w, main.h);
    ctx.fillStyle = a.concreteShade;
    for (let y = main.y + 14; y < main.y + main.h; y += 10) ctx.fillRect(main.x, y, main.w, 1);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = rnd() < 0.5 ? a.concreteLight : a.concreteShade;
      ctx.fillRect(main.x + 3 + Math.floor(rnd() * (main.w - 10)), main.y + 7 + Math.floor(rnd() * (main.h - 10)), 2 + Math.floor(rnd() * 4), 1);
    }
    ctx.fillStyle = a.concreteLight; ctx.fillRect(main.x, main.y, 2, main.h);
    ctx.fillStyle = a.concreteDark; ctx.fillRect(main.x + main.w - 2, main.y, 2, main.h);
    ctx.fillRect(main.x, main.y + main.h - 2, main.w, 2);
    // deck boards
    ctx.fillStyle = a.deck; ctx.fillRect(main.x, main.y, main.w, 5);
    ctx.fillStyle = a.deckLight; ctx.fillRect(main.x, main.y, main.w, 1);
    ctx.fillStyle = a.deckSeam; ctx.fillRect(main.x, main.y + 4, main.w, 1);
    for (let x = main.x + 13; x < main.x + main.w; x += 14) ctx.fillRect(x, main.y + 1, 1, 3);
    // steel edge caps
    for (const ex of [main.x, main.x + main.w - 3]) {
      ctx.fillStyle = a.metal; ctx.fillRect(ex, main.y, 3, 6);
      ctx.fillStyle = a.metalLight; ctx.fillRect(ex, main.y, 3, 1);
    }
  },
};

export class Background {
  constructor(stage) {
    this.stage = stage;
    this.sky = this.buildSky(stage.background);
    this.layers = stage.background.layers.map((l) => ({ def: l, canvas: (LAYER_BUILDERS[l.type] || LAYER_BUILDERS.clouds)(l) }));
    this.platform = makeCanvas(W, LAYER_H + 60);
    this.platformOffY = 60; // room above the screen for tall art
    const pctx = this.platform.getContext('2d');
    pctx.translate(0, this.platformOffY);
    PLATFORM_STYLES[stage.art.style](pctx, stage);
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
