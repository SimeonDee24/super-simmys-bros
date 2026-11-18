// Stage: Walter Gage Ballroom. A long flat floor of glossy bamboo in a
// residence ballroom, with folding wood partitions, ceiling tiles and lights.
// The floor runs right through both side blast zones: nobody falls off, so
// fighters are only KO'd off the sides or the top.
// All numbers are whole pixels on the 480x270 screen.

const C = {
  ceiling: '#e9eaec', ceilingLine: '#d2d4d8', light: '#ffffff', lightRim: '#c9ccd2', lightGlow: 'rgba(255,255,255,0.35)', vent: '#c3c6cc',
  wall: '#b9bcc2', wallShade: '#a4a7ad', baseboard: '#f2f2f0',
  panel: '#d8b585', panelLight: '#e6c79b', panelShade: '#b8946a', panelGap: '#8f6f4c', strip: '#9ea2a8',
  door: '#eceeef', doorFrame: '#d6d8db', exit: '#1f8a5a',
  screen: '#f4f4f2', screenCase: '#c8cacd', projector: '#25272c',
  glass: '#cfdcd8', glassLine: '#9fb0ab',
  floor: ['#8a5a2c', '#9a6633', '#a8723b', '#7d5026', '#b07a42'], floorDark: '#5e3c1c', floorShine: 'rgba(255,240,215,0.22)',
  table: '#e2c48e', tableEdge: '#b9bcbf', tableLeg: '#8d9196',
  chairBack: '#e0b97f', chairBackShade: '#c59d63', chairSeat: '#3d3a36', chairLeg: '#9a9ea3',
  laptop: '#3a3f47', laptopLid: '#c9ced8', book: ['#c2322e', '#2f5fa8', '#2f9e5b', '#e0b84a'], paper: '#f6f4ee', bottle: '#7fd08a',
};

// --- far layer: the room itself -----------------------------------------
function drawRoom(ctx, t) {
  const rnd = t.rng32(41);
  ctx.save(); ctx.translate(0, -24);   // the wall meets the floor just behind where the fighters stand
  // ceiling tiles with recessed lights
  ctx.fillStyle = C.ceiling; ctx.fillRect(-200, -70, 880, 150);
  ctx.fillStyle = C.ceilingLine;
  for (let y = -60; y < 80; y += 14) ctx.fillRect(-200, y, 880, 1);
  for (let x = -200; x < 680; x += 28) ctx.fillRect(x, -70, 1, 150);
  for (let row = 0; row < 3; row++) for (let x = -180 + row * 30; x < 680; x += 92) {
    const y = 4 + row * 24, w = 22 - row * 3;
    ctx.fillStyle = C.lightGlow; ctx.fillRect(x - 4, y - 3, w + 8, 12);
    ctx.fillStyle = C.lightRim; ctx.fillRect(x - 1, y - 1, w + 2, 8);
    ctx.fillStyle = C.light; ctx.fillRect(x, y, w, 6);
  }
  for (const x of [20, 310, 560]) { ctx.fillStyle = C.vent; ctx.fillRect(x, 30, 18, 8); ctx.fillStyle = C.ceilingLine; for (let k = 1; k < 4; k++) ctx.fillRect(x + 2, 30 + k * 2, 14, 1); }
  // projector hanging from the ceiling
  ctx.fillStyle = C.projector; ctx.fillRect(268, 72, 2, 8); ctx.fillRect(262, 80, 16, 6);
  ctx.fillStyle = '#5a5f68'; ctx.fillRect(264, 82, 4, 2);
  // the wall
  ctx.fillStyle = C.wall; ctx.fillRect(-200, 80, 880, 120);
  ctx.fillStyle = C.wallShade; ctx.fillRect(-200, 80, 880, 3);
  // folding wood partition along the back, with metal strips
  const px0 = 30, px1 = 470;
  for (let x = px0; x < px1; x += 34) {
    ctx.fillStyle = C.panelGap; ctx.fillRect(x, 86, 1, 104);
    for (let y = 86; y < 190; y++) { ctx.fillStyle = (y + Math.floor(x / 34)) % 7 === 0 ? C.panelShade : C.panel; ctx.fillRect(x + 1, y, 33, 1); }
    ctx.fillStyle = C.panelLight; ctx.fillRect(x + 1, 86, 2, 104);
    for (const sy of [112, 138, 164]) { ctx.fillStyle = C.strip; ctx.fillRect(x + 1, sy + ((x / 34) & 1), 33, 1); }
  }
  ctx.fillStyle = C.panelShade; ctx.fillRect(px0, 86, px1 - px0, 2);
  // projector screen rolled down over the partition
  ctx.fillStyle = C.screenCase; ctx.fillRect(196, 88, 148, 4);
  ctx.fillStyle = C.screen; ctx.fillRect(200, 92, 140, 8);
  // doors and an exit sign on the plain wall to the right
  for (const [x, w] of [[512, 34], [580, 30]]) {
    ctx.fillStyle = C.doorFrame; ctx.fillRect(x - 2, 128, w + 4, 62);
    ctx.fillStyle = C.door; ctx.fillRect(x, 130, w, 60);
    ctx.fillStyle = C.tableLeg; ctx.fillRect(x + 4, 162, w - 8, 2);
  }
  ctx.fillStyle = C.exit; ctx.fillRect(518, 118, 14, 6); ctx.fillStyle = '#ffffff'; ctx.fillRect(520, 120, 4, 2); ctx.fillRect(526, 120, 4, 1);
  // frosted glass doors to the hallway on the left
  ctx.fillStyle = C.glass; ctx.fillRect(-120, 96, 120, 94);
  ctx.fillStyle = C.glassLine;
  for (let x = -120; x <= 0; x += 30) ctx.fillRect(x, 96, 1, 94);
  ctx.fillRect(-64, 130, 2, 26); ctx.fillRect(-56, 130, 2, 26);
  ctx.fillStyle = C.panel; ctx.fillRect(0, 86, 30, 104); ctx.fillStyle = C.strip; ctx.fillRect(0, 120, 30, 1); ctx.fillRect(0, 150, 30, 1);
  // baseboard and the far edge of the floor
  ctx.fillStyle = C.baseboard; ctx.fillRect(-200, 188, 880, 3);
  for (let y = 191; y < 440; y++) { ctx.fillStyle = C.floor[Math.floor(rnd() * 5)]; ctx.fillRect(-200, y, 880, 1); }
  ctx.restore();
}

// --- middle layer: tables, chairs and the gang studying --------------------
const SIT = { hip: [0, 7], torso: 6, head: 16, armF: [74, 54], armB: [62, 64], legF: [86, -86], legB: [80, -80], footF: 0, footB: 0, handF: 'open', handB: 'open' };
function chair(ctx, x, floorY, facing) {
  const back = x - facing * 7;
  ctx.fillStyle = C.chairLeg;
  for (const lx of [x - 6, x + 6]) ctx.fillRect(lx, floorY - 12, 1, 12);
  ctx.fillStyle = C.chairSeat; ctx.fillRect(x - 8, floorY - 13, 16, 3);
  ctx.fillStyle = C.chairLeg; ctx.fillRect(back, floorY - 30, 1, 18);
  ctx.fillStyle = C.chairBackShade; ctx.fillRect(back - 2, floorY - 33, 4, 14);
  ctx.fillStyle = C.chairBack; ctx.fillRect(back - 1, floorY - 32, 2, 12);
}
function table(ctx, x0, x1, floorY) {
  const top = floorY - 25;
  ctx.fillStyle = C.tableLeg;
  for (const lx of [x0 + 4, x1 - 5]) { ctx.fillRect(lx, top + 3, 2, 22); ctx.fillRect(lx - 4, floorY - 2, 10, 2); }
  ctx.fillStyle = C.tableEdge; ctx.fillRect(x0, top, x1 - x0, 3);
  ctx.fillStyle = C.table; ctx.fillRect(x0, top - 1, x1 - x0, 2);
  return top - 1;
}
function laptop(ctx, x, y, facing) {
  ctx.fillStyle = C.laptop; ctx.fillRect(x - 5, y - 1, 10, 1);
  ctx.fillStyle = C.laptopLid; ctx.save(); ctx.translate(x - facing * 5, y - 1); ctx.rotate(facing * -0.35); ctx.fillRect(-0.5, -8, 1, 8); ctx.restore();
}
function books(ctx, x, y, k) {
  for (let i = 0; i < 3; i++) { ctx.fillStyle = C.book[(k + i) % 4]; ctx.fillRect(x - 4 + i, y - 2 - i * 2, 9 - i * 2, 2); }
  ctx.fillStyle = C.paper; ctx.fillRect(x + 7, y - 1, 7, 1);
}
function drawStudents(ctx, t) {
  const floorY = 168, s = 0.95;
  // [left end of table, right end, who sits at the left (facing right), who sits at the right (facing left)]
  const groups = [
    [92, 162, ['simeon', 0], ['max', 0]],
    [236, 300, ['osama', 0], ['kaelyn', 0]],
    [372, 430, ['luca', 0], null],
  ];
  groups.forEach(([x0, x1, a, b], gi) => {
    const top = table(ctx, x0, x1, floorY);
    const seats = [[a, x0 - 8, 1], [b, x1 + 8, -1]];
    for (const [who, sx, dir] of seats) if (who) chair(ctx, sx, floorY, dir);
    for (const [who, sx, dir] of seats) if (who) t.fighter(ctx, who[0], who[1], SIT, sx - dir * 2, floorY, dir, s);
    laptop(ctx, x0 + 14, top, 1);
    books(ctx, (x0 + x1) / 2, top, gi);
    if (b) laptop(ctx, x1 - 14, top, -1);
    else { ctx.fillStyle = C.bottle; ctx.fillRect(x1 - 10, top - 7, 3, 7); ctx.fillStyle = '#ffffff'; ctx.fillRect(x1 - 10, top - 8, 3, 1); }
  });
  // empty tables further along
  for (const [x0, x1] of [[-150, -80], [500, 570], [612, 670]]) {
    const top = table(ctx, x0, x1, floorY);
    chair(ctx, x0 - 8, floorY, 1); chair(ctx, x1 + 8, floorY, -1);
    if (x0 > 0) books(ctx, (x0 + x1) / 2, top, 2);
  }
}

// --- the floor fighters stand on: glossy bamboo, edge to edge ---------------
function drawFloor(ctx, stage, t) {
  const rnd = t.rng32(77), f = stage.solids[0], y0 = f.y;
  for (let y = y0; y < y0 + 250; y++) {
    for (let x = -200; x < 680;) {
      const len = 6 + Math.floor(rnd() * 26);
      ctx.fillStyle = C.floor[Math.floor(rnd() * 5)];
      ctx.fillRect(x, y, len, 1);
      x += len;
    }
  }
  // board ends, every few rows
  ctx.fillStyle = C.floorDark;
  ctx.globalAlpha = 0.45;
  for (let y = y0 + 4; y < y0 + 250; y += 5) for (let k = 0; k < 7; k++) ctx.fillRect(-200 + Math.floor(rnd() * 880), y, 1, 3);
  ctx.globalAlpha = 1;
  // shine from the ceiling lights, and a crisp top edge
  for (const x of [20, 150, 300, 430, 560]) { ctx.fillStyle = C.floorShine; ctx.fillRect(x, y0 + 2, 46, 4); ctx.fillRect(x + 8, y0 + 7, 30, 3); }
  ctx.fillStyle = '#c99256'; ctx.fillRect(-200, y0, 880, 1);
}

export const BALLROOM = {
  id: 'ballroom',
  name: 'WALTER GAGE BALLROOM',

  // One long floor that runs past both side blast zones (-170 and 650): there
  // is nothing to fall off.
  solids: [
    { x: -400, y: 170, w: 1280, h: 60 },
  ],
  ledges: [],

  spawns: [
    { x: 175, y: 170, facing: 1, ground: 0 },
    { x: 305, y: 170, facing: -1, ground: 0 },
    { x: 115, y: 170, facing: 1, ground: 0 },
    { x: 365, y: 170, facing: -1, ground: 0 },
  ],
  respawn: { x: 240, y: 90 },

  blast: { left: -170, right: 650, top: -165, bottom: 430 },

  background: {
    bands: 8,
    sky: [[0, '#e9eaec'], [1, '#b9bcc2']],
    sun: null,
    layers: [
      { type: 'custom', parallax: 0.08, draw: drawRoom },
      { type: 'custom', parallax: 0.3, draw: drawStudents },
    ],
  },
  art: { draw: drawFloor },
};
