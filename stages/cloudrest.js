// Stage: Cloudrest Terrace. One flat floating terrace above a sea of clouds.
// All numbers are whole pixels on the 480x270 screen.
//
// The draw function paints the platform once into an off-screen canvas. It is
// only called by the renderer and never touches the simulation.

// A floating stone terrace with a stepped, pointed underside and a crystal.
function drawIsland(ctx, stage, t) {
  const rng32 = t.rng32;
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
}

export const CLOUDREST = {
  id: 'cloudrest',
  name: 'CLOUDREST TERRACE',

  // Solid rectangles. solids[0] is the main platform (340px wide); its sides
  // are the walls used for wall jumps. The others are the stepped underside.
  solids: [
    { x: 70, y: 170, w: 340, h: 44 },
    { x: 100, y: 214, w: 280, h: 14 },
    { x: 136, y: 228, w: 208, h: 12 },
  ],

  // Grabbable ledges. dir = which way is off-stage, solid = platform it belongs to.
  ledges: [
    { x: 70, y: 170, dir: -1, solid: 0 },
    { x: 410, y: 170, dir: 1, solid: 0 },
  ],

  spawns: [
    { x: 175, y: 170, facing: 1, ground: 0 },
    { x: 305, y: 170, facing: -1, ground: 0 },
  ],
  respawn: { x: 240, y: 90 },

  // Just beyond the screen edges; the top one is higher.
  blast: { left: -170, right: 650, top: -230, bottom: 345 },

  // --- Art (drawn by render/background.js) ---
  background: {
    bands: 22,
    sky: [
      [0.0, '#27318f'],
      [0.35, '#3f6fd0'],
      [0.65, '#7fbdf0'],
      [0.85, '#c9e6f7'],
      [1.0, '#ffe2c2'],
    ],
    sun: { x: 372, y: 62, r: 17, core: '#fffbe6', mid: '#ffeeb0', glow: '#9fd0f5' },
    // speed = pixels per second, parallax = how much the layer follows the camera
    layers: [
      { seed: 7,  count: 9,  y: [40, 120],  size: [10, 20], color: '#a9cdf2', light: '#c4dff8', shade: '#8fb9e6', speed: 1.2, parallax: 0.1 },
      { seed: 21, count: 7,  y: [110, 190], size: [18, 34], color: '#d6e9fb', light: '#eef6ff', shade: '#aecbec', speed: 2.6, parallax: 0.25 },
      { seed: 33, count: 9,  y: [236, 262], size: [30, 52], color: '#f3f8ff', light: '#ffffff', shade: '#c3d7f0', speed: 4.5, parallax: 0.45 },
      { seed: 54, count: 10, y: [262, 290], size: [36, 60], color: '#ffffff', light: '#ffffff', shade: '#d9e6f7', speed: 7, parallax: 0.6 },
    ],
  },
  art: {
    draw: drawIsland,
    seed: 99,
    topLight: '#f2f6ff', top: '#b9c4e4', topShade: '#8892bd', seam: '#9aa5cc',
    trim: '#3fc7b8', trimShade: '#2a8f8f',
    rock: ['#6a6f9e', '#555a88', '#434670', '#33355a'],
    rockLight: '#8087b5', rockDark: '#25264a',
    vine: '#4fae6a', vineDark: '#34804f',
    crystal: ['#e6fffb', '#7ff0e0', '#33b8b0'],
  },
};
