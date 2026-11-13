// Stage 1: Nest Balcony. A flat balcony on a glass-and-timber student union
// building, with mountains and evergreens behind it.
// All numbers are whole pixels on the 480x270 screen.
export const NEST = {
  id: 'nest',
  name: 'NEST BALCONY',

  // Solid rectangles. solids[0] is the balcony slab (280px wide); its sides
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
      [0.0, '#2f4fa8'],
      [0.4, '#5a8fdc'],
      [0.7, '#9cc9f2'],
      [0.88, '#d6ebf8'],
      [1.0, '#f4efe2'],
    ],
    sun: { x: 62, y: 44, r: 11, core: '#fffbe6', mid: '#ffeeb0', glow: '#8fbdf0' },
    // Layers are drawn back to front. speed = pixels per second of drift,
    // parallax = how much the layer follows the camera.
    layers: [
      { type: 'mountains', seed: 12, baseY: 204, height: [46, 92], color: '#7d9cc6', shade: '#6c8ab6',
        snow: '#f2f7fd', snowShade: '#cfdff0', snowLine: 0.55, parallax: 0.04 },
      { type: 'clouds', seed: 7, count: 8, y: [36, 110], size: [10, 20], color: '#d6e8fa', light: '#f2f8ff', shade: '#b2cdea', speed: 1.4, parallax: 0.08 },
      { type: 'mountains', seed: 40, baseY: 214, height: [18, 44], color: '#4f7691', shade: '#44677f', parallax: 0.1 },
      { type: 'clouds', seed: 21, count: 5, y: [120, 170], size: [16, 30], color: '#eaf3fd', light: '#ffffff', shade: '#c2d6ee', speed: 2.8, parallax: 0.16 },
      { type: 'trees', seed: 5, baseY: 252, height: [26, 50], color: '#24523f', light: '#31694d', parallax: 0.3 },
      { type: 'trees', seed: 9, baseY: 304, height: [34, 56], color: '#173a2c', light: '#22503a', parallax: 0.75, front: true },
    ],
  },
  art: {
    style: 'balcony',
    seed: 99,
    // Building behind the balcony
    facade: { x: 118, w: 244, top: 62 },
    glass: ['#a9cbd8', '#94bccb', '#82adc0'], glassLine: '#c9e2ea',
    mullion: '#55626d',
    wood: '#c98b4c', woodLight: '#e0a868', woodShade: '#9c6532',
    metal: '#3d444d', metalLight: '#5a646f',
    concrete: '#b9bdc3', concreteLight: '#d8dbdf', concreteShade: '#8f949b', concreteDark: '#6c7178',
    deck: '#c79a63', deckLight: '#e4c08a', deckSeam: '#a37947',
    lowerWall: '#7d838b', lowerWindow: '#4a6677',
    plant: '#3f8f55', plantLight: '#62b572', plantDark: '#2b6a41',
    rail: '#e3e9ee', railGlass: 'rgba(210,235,245,0.4)',
    sign: 'THE NEST', signColor: '#e9eef2',
  },
};
