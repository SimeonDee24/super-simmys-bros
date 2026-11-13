// Draws a stage from its data: banded sky gradient, sun, slow parallax cloud
// layers, and the floating platform. Everything is pre-rendered once into
// small canvases, then composited every frame. Render only (its own RNG is
// separate from the simulation's).
const W = 480, H = 270, LAYER_W = 720;

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

export class Background {
  constructor(stage) {
    this.stage = stage;
    this.sky = this.buildSky(stage.background);
    this.layers = stage.background.layers.map((l) => ({ def: l, canvas: this.buildClouds(l) }));
    this.platform = this.buildPlatform(stage);
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
      ctx.fillStyle = s.glow; disc(ctx, s.x, s.y, s.r + 9);
      ctx.fillStyle = s.mid; disc(ctx, s.x, s.y, s.r + 3);
      ctx.fillStyle = s.core; disc(ctx, s.x, s.y, s.r);
    }
    return c;
  }

  buildClouds(l) {
    const c = makeCanvas(LAYER_W, H + 40), ctx = c.getContext('2d');
    const rnd = rng32(l.seed);
    const clouds = [];
    for (let i = 0; i < l.count; i++) {
      const size = l.size[0] + rnd() * (l.size[1] - l.size[0]);
      const cx = Math.round((i + rnd() * 0.8) * (LAYER_W / l.count));
      const cy = Math.round(l.y[0] + rnd() * (l.y[1] - l.y[0]));
      const puffs = [];
      const n = 4 + Math.floor(rnd() * 3);
      for (let p = 0; p < n; p++) {
        const t = n === 1 ? 0.5 : p / (n - 1);
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
  }

  buildPlatform(stage) {
    const c = makeCanvas(W, H + 40), ctx = c.getContext('2d');
    const a = stage.art, rnd = rng32(a.seed);
    const tiers = stage.solids;
    const main = tiers[0];

    // Rock tiers, bottom-up so upper tiers overlap lower ones.
    for (let ti = tiers.length - 1; ti >= 0; ti--) {
      const s = tiers[ti];
      const top = ti === 0 ? s.y + 7 : s.y;
      for (let y = top; y < s.y + s.h; y++) {
        const depth = (y - main.y) / 70;
        const shade = Math.min(a.rock.length - 1, Math.floor(depth * a.rock.length));
        const jitter = ti === 0 ? 0 : Math.round(rnd() * 2);
        ctx.fillStyle = a.rock[shade];
        ctx.fillRect(s.x + jitter, y, s.w - jitter * 2, 1);
        ctx.fillStyle = a.rockLight; ctx.fillRect(s.x + jitter, y, 2, 1);
        ctx.fillStyle = a.rockDark; ctx.fillRect(s.x + s.w - jitter - 2, y, 2, 1);
      }
      // shadow under the tier above
      if (ti > 0) { ctx.fillStyle = a.rockDark; ctx.fillRect(s.x + 2, s.y, s.w - 4, 2); }
      // blocky stone texture
      for (let i = 0; i < s.w * s.h / 60; i++) {
        const bx = s.x + 4 + Math.floor(rnd() * (s.w - 14));
        const by = top + 2 + Math.floor(rnd() * Math.max(1, s.y + s.h - top - 5));
        ctx.fillStyle = rnd() < 0.5 ? a.rockDark : a.rockLight;
        ctx.globalAlpha = 0.35;
        ctx.fillRect(bx, by, 3 + Math.floor(rnd() * 5), 1);
        ctx.globalAlpha = 1;
      }
    }
    // Pointed tip under the last tier, with a crystal.
    const last = tiers[tiers.length - 1];
    const tipTop = last.y + last.h, tipH = 22, mid = last.x + (last.w >> 1);
    for (let y = 0; y < tipH; y++) {
      const half = Math.round((last.w / 2 - 14) * (1 - y / tipH) ** 1.6);
      ctx.fillStyle = a.rock[a.rock.length - 1];
      ctx.fillRect(mid - half, tipTop + y, half * 2, 1);
      ctx.fillStyle = a.rockDark;
      ctx.fillRect(mid + half - 2, tipTop + y, 2, 1);
    }
    const cy = tipTop + tipH - 4;
    for (let y = -6; y <= 9; y++) {
      const half = y < 0 ? Math.round((6 + y) * 0.7) : Math.round((9 - y) * 0.5);
      ctx.fillStyle = a.crystal[1]; ctx.fillRect(mid - half, cy + y, half * 2 + 1, 1);
      ctx.fillStyle = a.crystal[2]; ctx.fillRect(mid + 1, cy + y, half, 1);
    }
    ctx.fillStyle = a.crystal[0]; ctx.fillRect(mid - 1, cy - 3, 1, 5);

    // Vines hanging under the first tier's overhang.
    for (const side of [0, 1]) {
      const second = tiers[1];
      const from = side === 0 ? main.x + 3 : second.x + second.w + 3;
      const to = side === 0 ? second.x - 3 : main.x + main.w - 3;
      for (let vx = from; vx < to; vx += 3 + Math.floor(rnd() * 4)) {
        const len = 3 + Math.floor(rnd() * 9);
        ctx.fillStyle = a.vineDark; ctx.fillRect(vx, main.y + main.h, 1, len);
        ctx.fillStyle = a.vine; ctx.fillRect(vx, main.y + main.h + len - 2, 1, 2);
      }
    }

    // Top slab: the surface fighters stand on.
    ctx.fillStyle = a.top; ctx.fillRect(main.x - 2, main.y, main.w + 4, 7);
    ctx.fillStyle = a.topLight; ctx.fillRect(main.x - 2, main.y, main.w + 4, 1);
    ctx.fillStyle = a.topShade; ctx.fillRect(main.x - 2, main.y + 5, main.w + 4, 2);
    ctx.fillStyle = a.seam;
    for (let x = main.x + 19; x < main.x + main.w; x += 20) ctx.fillRect(x, main.y + 1, 1, 4);
    // Teal inlay line and edge caps
    ctx.fillStyle = a.trim; ctx.fillRect(main.x + 6, main.y + 3, main.w - 12, 1);
    for (const ex of [main.x - 2, main.x + main.w - 4]) {
      ctx.fillStyle = a.trim; ctx.fillRect(ex, main.y, 6, 7);
      ctx.fillStyle = a.topLight; ctx.fillRect(ex, main.y, 6, 1);
      ctx.fillStyle = a.trimShade; ctx.fillRect(ex, main.y + 5, 6, 2);
    }
    return c;
  }

  // time = rendered frames since start, cam = camera pan in pixels
  draw(ctx, time, camX, camY) {
    ctx.drawImage(this.sky, 0, 0);
    for (const l of this.layers) {
      const off = Math.floor((time * l.def.speed) / 60 + camX * l.def.parallax);
      const x = -(((off % LAYER_W) + LAYER_W) % LAYER_W);
      const y = -Math.round(camY * l.def.parallax);
      ctx.drawImage(l.canvas, x, y);
      ctx.drawImage(l.canvas, x + LAYER_W, y);
    }
    ctx.drawImage(this.platform, -camX, -camY);
  }
}
