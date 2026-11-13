// Stage 1: Cloudrest Terrace. One flat floating terrace above a sea of clouds.
// All numbers are whole pixels on the 480x270 screen.
export const CLOUDREST = {
  id: 'cloudrest',
  name: 'CLOUDREST TERRACE',

  // Solid rectangles. solids[0] is the main platform (280px wide); its sides
  // are the walls used for wall jumps. The others are the stepped underside.
  solids: [
    { x: 100, y: 170, w: 280, h: 44 },
    { x: 128, y: 214, w: 224, h: 14 },
    { x: 160, y: 228, w: 160, h: 12 },
  ],

  // Grabbable ledges. dir = which way is off-stage, solid = platform it belongs to.
  ledges: [
    { x: 100, y: 170, dir: -1, solid: 0 },
    { x: 380, y: 170, dir: 1, solid: 0 },
  ],

  spawns: [
    { x: 190, y: 170, facing: 1, ground: 0 },
    { x: 290, y: 170, facing: -1, ground: 0 },
  ],
  respawn: { x: 240, y: 90 },

  // Just beyond the screen edges; the top one is higher.
  blast: { left: -60, right: 540, top: -110, bottom: 325 },

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
    seed: 99,
    topLight: '#f2f6ff', top: '#b9c4e4', topShade: '#8892bd', seam: '#9aa5cc',
    trim: '#3fc7b8', trimShade: '#2a8f8f',
    rock: ['#6a6f9e', '#555a88', '#434670', '#33355a'],
    rockLight: '#8087b5', rockDark: '#25264a',
    vine: '#4fae6a', vineDark: '#34804f',
    crystal: ['#e6fffb', '#7ff0e0', '#33b8b0'],
  },
};
