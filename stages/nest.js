// Stage: The Nest. An indoor walkway high in a timber-and-concrete student
// union atrium, with the Egg in the background.
// All numbers are whole pixels on the 480x270 screen.
//
// A stage is data plus its own art: the draw functions below paint the
// backdrop layers and the platform once into off-screen canvases. They are
// only ever called by the renderer and never touch the simulation.

const C = {
  // far atrium wall (hazy, low contrast so fighters stand out)
  farSlatA: '#bfa283', farSlatB: '#b29576', farGap: '#967a5e',
  farSlab: '#d9d6cd', farSlabShade: '#8d775f', farRoom: '#7d6853', farRoomDeep: '#6a5746',
  farColumn: '#cbc8bf', farColumnShade: '#aeaba2',
  glow: '#fff3c9', skylight: '#eef6fa', skyPane: '#d5e8f2',
  railGlass: 'rgba(205,230,240,0.35)', rail: '#e6ecef',
  // the Egg
  egg: '#d28c47', eggLight: '#e8ad66', eggShade: '#a9672f', eggSeam: '#8f5526',
  eggWindow: '#3f4d58', eggWindowLight: '#7fa3b8',
  // walkway
  wood: '#c98b4c', woodAlt: '#bd7f42', woodLight: '#e0a868', woodGap: '#7a4f28', woodShade: '#9c6532',
  concrete: '#c9c6bd', concreteLight: '#e3e1da', concreteShade: '#a3a097', concreteDark: '#7f7c74',
  floor: '#dcd9cf', floorLight: '#f3f0e8', floorSeam: '#b3afa4',
  steel: '#b9c0c6', steelDark: '#6c757d',
  counter: '#f0eadd', chair: '#c79a63', chairDark: '#8a6238', screen: '#9fd8f5', laptop: '#3a4048',
  signBlue: '#2f5fa8', bannerBlue: '#0c2a66', bannerGold: '#f0bf4c', panel: '#e2a83a', panelLight: '#f5cd6b', panelShade: '#b9831f',
};

// --- Background people -----------------------------------------------------
// Tiny generic students, muted so they never compete with the fighters.
const CROWD = {
  skin: ['#e8c3a0', '#d6a77f', '#b98559', '#8d5e3c', '#f1d2b6'],
  hair: ['#2a1d17', '#3b2a20', '#5a3d27', '#141018', '#7a5233', '#c9a066'],
  top: ['#5a6f8f', '#8a4b4b', '#4f7a5c', '#c9b48c', '#6b5a7f', '#3f4a59', '#a8735a', '#d9d4c7', '#2f2f36'],
  legs: ['#3d4a66', '#2b2b33', '#5c5248', '#4a5a73'],
  bag: ['#6b4d3a', '#2f3a4f', '#7a2f2f'],
};
const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];

// A standing figure about 13 px tall, feet at (x, y). Some face away, some carry bags.
function drawStander(ctx, rnd, x, y) {
  const skin = pick(rnd, CROWD.skin), hair = pick(rnd, CROWD.hair), top = pick(rnd, CROWD.top), legs = pick(rnd, CROWD.legs);
  const h = 12 + Math.floor(rnd() * 3);
  const legH = Math.round(h * 0.42), bodyH = h - legH - 3;
  ctx.fillStyle = legs; ctx.fillRect(x, y - legH, 1, legH); ctx.fillRect(x + 2, y - legH, 1, legH);
  ctx.fillStyle = top; ctx.fillRect(x - 1, y - legH - bodyH, 5, bodyH);
  ctx.fillStyle = skin; ctx.fillRect(x, y - h, 3, 3);
  ctx.fillStyle = hair; ctx.fillRect(x, y - h, 3, 1);
  if (rnd() < 0.5) ctx.fillRect(x, y - h + 1, 1, 1);        // side of the hair
  if (rnd() < 0.35) { ctx.fillStyle = pick(rnd, CROWD.bag); ctx.fillRect(rnd() < 0.5 ? x - 2 : x + 4, y - legH - bodyH + 1, 1, bodyH); }
}

// Someone sitting at a table in a far study room: head and shoulders only.
function drawSitter(ctx, rnd, x, y) {
  ctx.fillStyle = pick(rnd, CROWD.top); ctx.fillRect(x - 1, y - 4, 5, 4);
  ctx.fillStyle = pick(rnd, CROWD.skin); ctx.fillRect(x, y - 7, 3, 3);
  ctx.fillStyle = pick(rnd, CROWD.hair); ctx.fillRect(x, y - 7, 3, 1);
}

// Far side of the atrium: stacked floors with slatted timber walls.
function drawAtrium(ctx, t) {
  const rnd = t.rng32(31);
  const X0 = -120, X1 = 600, Y0 = -10, Y1 = 330;
  // slatted wall
  for (let x = X0; x < X1; x++) {
    const m = ((x % 3) + 3) % 3;
    ctx.fillStyle = m === 2 ? C.farGap : (Math.floor(x / 3) & 1 ? C.farSlatA : C.farSlatB);
    ctx.fillRect(x, Y0, 1, Y1 - Y0);
  }
  // floors: recessed rooms, slab edge, glass railing
  for (let fy = 40; fy < Y1; fy += 62) {
    for (let x = X0 + Math.floor(rnd() * 40); x < X1; ) {
      const w = 36 + Math.floor(rnd() * 60);
      ctx.fillStyle = C.farRoom; ctx.fillRect(x, fy - 36, w, 36);
      ctx.fillStyle = C.farRoomDeep; ctx.fillRect(x, fy - 12, w, 12);
      ctx.fillStyle = C.glow; ctx.fillRect(x + 4, fy - 34, w - 8, 1);
      // a study table with a few people sitting at it
      const tx = x + 6 + Math.floor(rnd() * Math.max(1, w - 30));
      ctx.fillStyle = C.farRoomDeep; ctx.fillRect(tx - 2, fy - 13, 22, 2);
      for (let k = 0, n = 1 + Math.floor(rnd() * 3); k < n; k++) drawSitter(ctx, rnd, tx + k * 7, fy - 13);
      x += w + 30 + Math.floor(rnd() * 70);
    }
    // people walking or chatting along the walkway in front of the rooms
    for (let x = X0 + Math.floor(rnd() * 30); x < X1; x += 14 + Math.floor(rnd() * 46)) {
      drawStander(ctx, rnd, x, fy);
      if (rnd() < 0.35) drawStander(ctx, rnd, x + 5, fy);   // a pair talking
    }
    ctx.fillStyle = C.railGlass; ctx.fillRect(X0, fy - 9, X1 - X0, 9);
    ctx.fillStyle = C.rail; ctx.fillRect(X0, fy - 10, X1 - X0, 1);
    ctx.fillStyle = C.farSlab; ctx.fillRect(X0, fy, X1 - X0, 5);
    ctx.fillStyle = C.glow; ctx.fillRect(X0, fy + 5, X1 - X0, 1);
    ctx.fillStyle = C.farSlabShade; ctx.fillRect(X0, fy + 6, X1 - X0, 2);
  }
  // concrete columns
  for (let x = X0 + 50; x < X1; x += 150) {
    ctx.fillStyle = C.farColumn; ctx.fillRect(x, Y0, 8, Y1 - Y0);
    ctx.fillStyle = C.farColumnShade; ctx.fillRect(x + 6, Y0, 2, Y1 - Y0);
  }
  // skylight with timber beams
  ctx.fillStyle = C.skylight; ctx.fillRect(X0, Y0, X1 - X0, 24);
  ctx.fillStyle = C.skyPane;
  for (let x = X0; x < X1; x += 10) ctx.fillRect(x, Y0, 1, 24);
  for (let x = X0 + 14; x < X1; x += 44) {
    ctx.fillStyle = C.wood; ctx.fillRect(x, Y0, 5, 26);
    ctx.fillStyle = C.woodShade; ctx.fillRect(x + 4, Y0, 1, 26);
  }
  ctx.fillStyle = C.woodShade; ctx.fillRect(X0, 14, X1 - X0, 2);
}

// The Egg: a big timber-clad ovoid on a concrete stem, with a bridge to it.
function drawEgg(ctx, t) {
  const cx = 338, cy = 104, rx = 60, ry = 46;
  // stem
  for (let y = cy + ry - 6; y < 340; y++) {
    const half = 15 - Math.min(5, (y - cy - ry) >> 4);
    ctx.fillStyle = C.concrete; ctx.fillRect(cx - half, y, half * 2, 1);
    ctx.fillStyle = C.concreteLight; ctx.fillRect(cx - half, y, 3, 1);
    ctx.fillStyle = C.concreteShade; ctx.fillRect(cx + half - 5, y, 5, 1);
  }
  // bridge
  const rnd = t.rng32(77);
  for (let x = cx + 70; x < cx + 300; x += 22 + Math.floor(rnd() * 40)) drawStander(ctx, rnd, x, cy + 18);
  ctx.fillStyle = C.railGlass; ctx.fillRect(cx, cy + 9, 300, 9);
  ctx.fillStyle = C.rail; ctx.fillRect(cx, cy + 8, 300, 1);
  ctx.fillStyle = C.concrete; ctx.fillRect(cx, cy + 18, 300, 5);
  ctx.fillStyle = C.concreteShade; ctx.fillRect(cx, cy + 23, 300, 2);
  // shell, slightly fuller at the bottom, clad in horizontal strips
  for (let dy = -ry; dy <= ry; dy++) {
    const k = dy / ry;
    const half = Math.round(rx * Math.sqrt(1 - k * k) * (1 + 0.1 * k));
    const y = cy + dy;
    const seam = ((dy + ry) % 4) === 3;
    for (let dx = -half; dx <= half; dx++) {
      const u = dx / (half || 1) + k * 0.35; // light from the upper left
      ctx.fillStyle = seam ? C.eggSeam : u < -0.45 ? C.eggLight : u > 0.4 ? C.eggShade : C.egg;
      ctx.fillRect(cx + dx, y, 1, 1);
    }
  }
  // window band
  for (let dy = -9; dy <= 3; dy++) {
    const k = dy / ry;
    const half = Math.round(rx * Math.sqrt(1 - k * k) * (1 + 0.1 * k));
    ctx.fillStyle = C.eggWindow; ctx.fillRect(cx - (half >> 2), cy + dy, half + (half >> 2) - 6, 1);
  }
  ctx.fillStyle = C.eggWindowLight;
  for (let x = cx - 8; x < cx + 46; x += 12) ctx.fillRect(x, cy - 9, 1, 13);
  ctx.fillRect(cx - 10, cy - 9, 58, 1);
}

// The walkway itself, its ceiling, columns and study counter.
function drawWalkway(ctx, stage, t) {
  const [main, tier2, tier3] = stage.solids;
  const deck = main.y, L = main.x, R = main.x + main.w;

  // --- ceiling over the walkway ---
  ctx.fillStyle = C.railGlass; ctx.fillRect(L - 14, -8, main.w + 28, 12);
  ctx.fillStyle = C.rail; ctx.fillRect(L - 14, -9, main.w + 28, 1);
  ctx.fillStyle = C.concrete; ctx.fillRect(L - 16, 4, main.w + 32, 8);
  ctx.fillStyle = C.concreteLight; ctx.fillRect(L - 16, 4, main.w + 32, 1);
  for (let x = L - 14; x < R + 14; x++) {
    const m = (x - L + 16) % 4;
    ctx.fillStyle = m === 3 ? C.woodGap : (Math.floor((x - L + 16) / 4) & 1 ? C.wood : C.woodAlt);
    ctx.fillRect(x, 12, 1, 10);
  }
  ctx.fillStyle = C.woodShade; ctx.fillRect(L - 14, 21, main.w + 28, 1);
  ctx.fillStyle = C.glow; ctx.fillRect(L + 40, 22, 120, 1); ctx.fillRect(L + 190, 22, 60, 1);

  // hanging blue sign
  ctx.fillStyle = C.steelDark; ctx.fillRect(L + 58, 22, 1, 4); ctx.fillRect(L + 75, 22, 1, 4);
  ctx.fillStyle = C.signBlue; ctx.fillRect(L + 54, 26, 26, 13);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(L + 57, 29, 14, 1); ctx.fillRect(L + 57, 32, 18, 1); ctx.fillRect(L + 57, 35, 9, 1);

  // hanging school banner: plain lettering in blue and gold
  ctx.fillStyle = C.steelDark; ctx.fillRect(L + 118, 22, 1, 3); ctx.fillRect(L + 138, 22, 1, 3);
  ctx.fillStyle = C.bannerGold; ctx.fillRect(L + 115, 25, 27, 2);
  ctx.fillStyle = C.bannerBlue; ctx.fillRect(L + 116, 27, 25, 24);
  ctx.fillStyle = C.bannerBlue; ctx.fillRect(L + 120, 51, 17, 2); ctx.fillRect(L + 124, 53, 9, 2);
  ctx.fillStyle = C.bannerGold; ctx.fillRect(L + 118, 44, 21, 1);
  t.drawText(ctx, 'UBC', L + 129, 33, '#ffffff', 2, 'center');

  // angled yellow panels under the ceiling
  for (const px0 of [R - 96, R - 58]) {
    for (let y = 0; y < 26; y++) {
      const x = px0 + y;
      ctx.fillStyle = C.panel; ctx.fillRect(x, 23 + y, 30, 1);
      ctx.fillStyle = C.panelLight; ctx.fillRect(x, 23 + y, 2, 1);
      ctx.fillStyle = C.panelShade; ctx.fillRect(x + 28, 23 + y, 2, 1);
    }
  }

  // --- concrete columns from floor to ceiling ---
  for (const cx of [L + 22, R - 31]) {
    ctx.fillStyle = C.concrete; ctx.fillRect(cx, 22, 9, deck - 22);
    ctx.fillStyle = C.concreteLight; ctx.fillRect(cx, 22, 2, deck - 22);
    ctx.fillStyle = C.concreteShade; ctx.fillRect(cx + 7, 22, 2, deck - 22);
  }

  // --- glass railing and study counter along the back edge ---
  const c0 = L + 36, c1 = R - 36;
  ctx.fillStyle = C.railGlass; ctx.fillRect(L, deck - 21, main.w, 21);
  ctx.fillStyle = C.rail; ctx.fillRect(L, deck - 22, main.w, 1);
  ctx.fillStyle = C.steelDark;
  for (let x = L; x <= R; x += 40) ctx.fillRect(Math.min(x, R - 1), deck - 22, 1, 22);
  ctx.fillStyle = C.counter; ctx.fillRect(c0, deck - 17, c1 - c0, 2);
  ctx.fillStyle = C.glow; ctx.fillRect(c0, deck - 15, c1 - c0, 1);
  const rnd = t.rng32(8);
  for (let x = c0 + 8; x < c1 - 10; x += 26) {
    if (rnd() < 0.7) { // laptop
      ctx.fillStyle = C.laptop; ctx.fillRect(x, deck - 23, 7, 6);
      ctx.fillStyle = C.screen; ctx.fillRect(x + 1, deck - 22, 5, 4);
    }
    // some chairs have a student in them, seen from behind, working at the counter
    if (rnd() < 0.55) {
      ctx.fillStyle = pick(rnd, CROWD.top); ctx.fillRect(x - 1, deck - 19, 9, 8);
      ctx.fillStyle = pick(rnd, CROWD.skin); ctx.fillRect(x + 1, deck - 24, 5, 5);
      ctx.fillStyle = pick(rnd, CROWD.hair); ctx.fillRect(x + 1, deck - 24, 5, 3);
      ctx.fillRect(x + 1, deck - 21, 1, 1); ctx.fillRect(x + 5, deck - 21, 1, 1);
      if (rnd() < 0.4) { ctx.fillStyle = '#e8e8e8'; ctx.fillRect(x + 1, deck - 22, 1, 2); ctx.fillRect(x + 5, deck - 22, 1, 2); } // headphones
    }
    // chair seen from behind
    ctx.fillStyle = C.chair; ctx.fillRect(x, deck - 13, 7, 6);
    ctx.fillStyle = C.woodLight; ctx.fillRect(x, deck - 13, 7, 1);
    ctx.fillStyle = C.chairDark;
    ctx.fillRect(x, deck - 7, 7, 1);
    ctx.fillRect(x, deck - 6, 1, 6); ctx.fillRect(x + 6, deck - 6, 1, 6);
  }

  // --- underside (solids 2 and 3): concrete ---
  for (const s of [tier3, tier2]) {
    ctx.fillStyle = C.concreteShade; ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.fillStyle = C.concreteDark; ctx.fillRect(s.x, s.y, s.w, 2); ctx.fillRect(s.x, s.y + s.h - 2, s.w, 2);
    ctx.fillRect(s.x + s.w - 2, s.y, 2, s.h);
    ctx.fillStyle = C.concrete; ctx.fillRect(s.x, s.y + 2, 2, s.h - 4);
  }
  ctx.fillStyle = C.glow; ctx.fillRect(tier2.x + 10, tier2.y + tier2.h - 3, tier2.w - 20, 1);

  // --- main slab (solid 1): slatted timber face with a steel handrail ---
  for (let x = L; x < R; x++) {
    const m = (x - L) % 4;
    ctx.fillStyle = m === 3 ? C.woodGap : (Math.floor((x - L) / 4) & 1 ? C.wood : C.woodAlt);
    ctx.fillRect(x, deck, 1, main.h);
  }
  ctx.fillStyle = C.woodShade; ctx.fillRect(L, deck + 6, main.w, 2); ctx.fillRect(L, deck + main.h - 2, main.w, 2);
  ctx.fillStyle = C.steel; ctx.fillRect(L + 3, deck + 20, main.w - 6, 2);
  ctx.fillStyle = C.steelDark; ctx.fillRect(L + 3, deck + 22, main.w - 6, 1);
  // polished concrete floor
  ctx.fillStyle = C.floor; ctx.fillRect(L, deck, main.w, 6);
  ctx.fillStyle = C.floorLight; ctx.fillRect(L, deck, main.w, 1);
  ctx.fillStyle = C.floorSeam; ctx.fillRect(L, deck + 5, main.w, 1);
  // concrete end caps
  ctx.fillStyle = C.concreteLight; ctx.fillRect(L, deck, 3, main.h);
  ctx.fillStyle = C.concreteShade; ctx.fillRect(R - 3, deck, 3, main.h);
}

export const NEST = {
  id: 'nest',
  name: 'THE NEST',

  // Solid rectangles. solids[0] is the walkway (340px wide); its sides are
  // the walls used for wall jumps. The others are the stepped underside.
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

  // --- Art (composited by render/background.js) ---
  background: {
    bands: 8,
    sky: [[0, '#d9d6cd'], [1, '#967a5e']], // only visible if a layer leaves a gap
    sun: null,
    // Back to front. parallax = how much the layer follows the camera.
    // Other layer types available: 'clouds', 'mountains', 'trees'.
    layers: [
      { type: 'custom', parallax: 0.08, draw: drawAtrium },
      { type: 'custom', parallax: 0.2, draw: drawEgg },
    ],
  },
  art: { draw: drawWalkway },
};
