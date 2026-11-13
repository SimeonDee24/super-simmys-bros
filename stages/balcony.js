// Stage: Nest Balcony. A flat balcony on a glass-and-timber student union
// building, with mountains and evergreens behind it.
// All numbers are whole pixels on the 480x270 screen.
//
// The draw function paints the platform and building once into an off-screen
// canvas. It is only called by the renderer and never touches the simulation.

function drawBalcony(ctx, stage, t) {
  const { rng32, disc, drawText } = t;
  const LAYER_H = 340; // how far down the art must reach
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
}

export const BALCONY = {
  id: 'balcony',
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
    draw: drawBalcony,
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
