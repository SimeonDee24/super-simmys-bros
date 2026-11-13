// Headless checks:  node tools/sim-test.mjs
// Runs the simulation without a browser to confirm it is deterministic and
// that basic movement behaves as tuned.
import { createMatch, step, hashState, serialize, deserialize } from '../engine/sim.js';
import { BTN } from '../engine/input.js';
import { FX } from '../engine/fixed.js';

const setup = { stageId: 'nest', players: [{ charId: 'simeon', alt: 0 }, { charId: 'simeon', alt: 1 }], stocks: 3, seed: 1234 };
let fails = 0;
const check = (name, ok, extra = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!ok) fails++; };

// A scripted input sequence: [frames, mask]
const script = [
  [20, 0], [1, BTN.RIGHT], [3, 0], [40, BTN.RIGHT], [30, BTN.RIGHT | BTN.JUMP], [30, BTN.RIGHT],
  [10, BTN.LEFT], [1, BTN.JUMP], [20, BTN.LEFT], [1, BTN.JUMP | BTN.LEFT], [30, BTN.LEFT], [1, BTN.DOWN], [60, 0],
  [200, BTN.LEFT], [300, 0],
];
function run(seedState) {
  const s = seedState || createMatch(setup);
  const hashes = [];
  for (const [n, m] of script) for (let i = 0; i < n; i++) { step(s, [m, 0]); hashes.push(hashState(s)); }
  return { s, hashes };
}
const a = run(), b = run();
check('same inputs give the same hash every frame', a.hashes.join() === b.hashes.join(), 'final ' + a.hashes.at(-1));

// Save/load mid-match and continue: must match an uninterrupted run.
const c = createMatch(setup);
for (let i = 0; i < 50; i++) step(c, [BTN.RIGHT, 0]);
const copy = deserialize(serialize(c));
for (let i = 0; i < 50; i++) { step(c, [BTN.JUMP, 0]); step(copy, [BTN.JUMP, 0]); }
check('serialize -> deserialize continues identically', hashState(c) === hashState(copy));

// Jump heights
function jumpHeight(holdFrames) {
  const s = createMatch(setup); const f = s.fighters[0]; const y0 = f.y; let top = y0, air = 0, left = -1;
  for (let i = 0; i < 120; i++) {
    step(s, [i < holdFrames ? BTN.JUMP : 0, 0]);
    if (!f.grounded && left < 0) left = i;
    if (!f.grounded) air++;
    top = Math.min(top, f.y);
  }
  return { h: (y0 - top) / FX, air, left };
}
const full = jumpHeight(30), short = jumpHeight(2);
check('full hop about 55px', Math.abs(full.h - 55) < 4, `${full.h.toFixed(1)}px, ${full.air} frames airborne`);
check('short hop about 31px', Math.abs(short.h - 31) < 3, `${short.h.toFixed(1)}px, ${short.air} frames airborne`);
check('jumpsquat is 3 frames', full.left === 3, 'left ground on tick index ' + full.left);

// Double-tap dash reaches run speed; single hold only walks.
{
  const s = createMatch(setup); const f = s.fighters[0];
  for (let i = 0; i < 30; i++) step(s, [BTN.RIGHT, 0]);
  check('holding a direction walks', f.state === 'walk', 'vx ' + (f.vx / FX).toFixed(2));
  const s2 = createMatch(setup); const g = s2.fighters[0];
  const seq = [[1, BTN.RIGHT], [3, 0], [30, BTN.RIGHT]];
  for (const [n, m] of seq) for (let i = 0; i < n; i++) step(s2, [m, 0]);
  check('double-tap dashes then runs', g.state === 'run', 'vx ' + (g.vx / FX).toFixed(2));
}
// Running off the edge, falling to the blast zone, respawning.
{
  const s = createMatch(setup); const f = s.fighters[0];
  step(s, [BTN.LEFT, 0]); step(s, [0, 0]);
  let fell = false;
  for (let i = 0; i < 400; i++) { step(s, [BTN.LEFT, 0]); if (f.falls > 0) { fell = true; break; } }
  check('running off the stage is a KO and costs a stock', fell && f.stocks === 2 && f.state === 'dead');
  for (let i = 0; i < 100; i++) step(s, [0, 0]);
  check('reappears on the respawn platform, invincible', f.state === 'respawn' && f.invuln > 0 && f.y === 90 * FX, f.state);
  for (let i = 0; i < 300; i++) step(s, [0, 0]);
  check('leaves the platform by itself and lands on the stage', f.grounded === 1 && f.y === 170 * FX, f.state);
}
// Wall contact under the ledge is detected (needed for wall jumps later).
{
  const s = createMatch(setup); const f = s.fighters[0];
  f.x = 93 * FX; f.vx = 2 * FX; f.y = 236 * FX; f.grounded = 0; f.ground = -1; f.state = 'air';
  let touched = false;
  for (let i = 0; i < 5; i++) { step(s, [BTN.RIGHT, 0]); if (f.wallSide === 1) touched = true; }
  check('stage wall blocks and reports contact', touched && f.x <= (100 - 5) * FX);
}
// Ledge: run off the left edge, drift back, grab, then get up onto the stage.
{
  const s = createMatch(setup); const f = s.fighters[0];
  let grabbed = false;
  for (let i = 0; i < 200 && !grabbed; i++) { step(s, [f.grounded ? BTN.LEFT : BTN.RIGHT, 0]); grabbed = f.state === 'ledge'; }
  check('falling next to a ledge grabs it', grabbed, grabbed ? 'facing ' + f.facing : f.state);
  for (let i = 0; i < 12; i++) step(s, [0, 0]);
  check('keeps hanging with no input', f.state === 'ledge');
  for (let i = 0; i < 40; i++) step(s, [BTN.RIGHT, 0]);
  check('toward stage gets up onto the stage', f.grounded === 1 && f.y === 170 * FX && f.x > 100 * FX, 'x ' + (f.x / FX));
  // ledge jump and drop
  const s2 = createMatch(setup); const g = s2.fighters[0];
  for (let i = 0; i < 200 && g.state !== 'ledge'; i++) step(s2, [g.grounded ? BTN.LEFT : BTN.RIGHT, 0]);
  for (let i = 0; i < 10; i++) step(s2, [0, 0]);
  step(s2, [BTN.DOWN, 0]);
  check('down lets go of the ledge', g.state === 'air' && g.ledgeCd > 0);
}
// Crawl, and running out of stocks.
{
  const s = createMatch(setup); const f = s.fighters[0];
  for (let i = 0; i < 20; i++) step(s, [BTN.DOWN | BTN.RIGHT, 0]);
  check('down + direction crawls slowly', f.state === 'crawl' && f.vx > 0 && f.vx < 1.2 * FX, 'vx ' + (f.vx / FX).toFixed(2));
  const s2 = createMatch({ ...setup, stocks: 1 }); const g = s2.fighters[0];
  step(s2, [BTN.LEFT, 0]);
  for (let i = 0; i < 600; i++) step(s2, [BTN.LEFT, 0]);
  check('last stock lost = out of the match', g.state === 'out' && g.stocks === 0, g.state);
}
// Attacks
{
  const { knockback } = await import('../engine/combat.js');
  const kb = knockback(1105, 105, 98, 12, 106) / 1000;
  check('knockback formula matches a hand calculation', Math.abs(kb - 134.6) < 0.5, kb.toFixed(1));
  const near = () => { const s = createMatch(setup); s.fighters[1].x = s.fighters[0].x + 16 * FX; return s; };
  // forward tilt
  let s = near(); let [a, v] = s.fighters;
  step(s, [BTN.ATTACK, 0]);
  let firstHit = -1;
  for (let i = 0; i < 60; i++) { step(s, [0, 0]); if (firstHit < 0 && v.percent > 0) firstHit = a.stateFrame; }
  check('forward tilt hits for 7% on frame 5', v.percent === 70 && firstHit === 5, `${v.percent / 10}% on frame ${firstHit}`);
  check('both fighters recover afterwards', a.state === 'idle' && v.state === 'idle' && v.x > a.x + 16 * FX);
  // up tilt launches upward
  s = near(); [a, v] = s.fighters;
  step(s, [BTN.ATTACK | BTN.UP, 0]);
  let lifted = false;
  for (let i = 0; i < 40; i++) { step(s, [BTN.UP, 0]); if (!v.grounded) lifted = true; }
  check('up tilt pops the opponent into the air', a.move === '' && v.percent === 55 && lifted);
  // an aerial with landing lag, and an auto-cancelled one
  s = createMatch(setup); a = s.fighters[0];
  step(s, [BTN.JUMP, 0]);
  for (let i = 0; i < 3; i++) step(s, [0, 0]); // short hop
  step(s, [BTN.ATTACK | BTN.RIGHT, 0]);
  let lag = -1;
  for (let i = 0; i < 80 && lag < 0; i++) { step(s, [0, 0]); if (a.state === 'land') lag = a.landLag; }
  check('landing during forward air gives its landing lag', lag === 12, 'lag ' + lag);
  s = createMatch(setup); a = s.fighters[0];
  for (let i = 0; i < 4; i++) step(s, [BTN.JUMP, 0]);
  step(s, [BTN.JUMP | BTN.ATTACK | BTN.UP, 0]);
  lag = -1;
  for (let i = 0; i < 80 && lag < 0; i++) { step(s, [BTN.JUMP, 0]); if (a.state === 'land') lag = a.landLag; }
  check('up air finished before landing auto-cancels', lag === 2, 'lag ' + lag);
  // buffering: double-tap and a jump pressed during a tilt's last frames come out at once
  s = createMatch(setup); a = s.fighters[0]; s.fighters[1].x = 900 * FX;
  step(s, [BTN.ATTACK, 0]);
  for (let i = 0; i < 13; i++) step(s, [0, 0]);
  for (const m of [BTN.RIGHT, 0, 0, BTN.RIGHT, BTN.RIGHT, BTN.RIGHT, BTN.RIGHT, BTN.RIGHT, BTN.RIGHT]) step(s, [m, 0]);
  check('double-tap during a tilt dashes on the first free frame', a.state === 'dash' && a.stateFrame <= 2, a.state + ' ' + a.stateFrame);
  s = createMatch(setup); a = s.fighters[0]; s.fighters[1].x = 900 * FX;
  step(s, [BTN.ATTACK, 0]);
  for (let i = 0; i < 15; i++) step(s, [0, 0]);
  step(s, [BTN.JUMP, 0]);
  for (let i = 0; i < 6; i++) step(s, [0, 0]);
  check('jump pressed late in a tilt is buffered', a.state === 'jumpsquat' || a.state === 'air', a.state);
  for (let i = 0; i < 12; i++) step(s, [0, 0]);
  check('a buffered jump does not also spend the double jump', a.jumpsLeft === 1);
  // dash attack out of a run
  s = createMatch(setup); [a, v] = s.fighters; v.x = a.x + 70 * FX;
  for (const [n, m] of [[1, BTN.RIGHT], [2, 0], [6, BTN.RIGHT]]) for (let i = 0; i < n; i++) step(s, [m, 0]);
  step(s, [BTN.RIGHT | BTN.ATTACK, 0]);
  const wasDash = a.move === 'dashAttack';
  for (let i = 0; i < 60; i++) step(s, [0, 0]);
  check('attack while dashing slides in and hits', wasDash && v.percent > 0 && a.state === 'idle', `${v.percent / 10}%`);
  // high percent back air sends far enough to KO
  s = near(); [a, v] = s.fighters;
  v.percent = 1500; a.facing = -1; a.x = 360 * FX; v.x = 376 * FX;
  a.y -= 10 * FX; a.grounded = 0; a.ground = -1; a.state = 'air'; // just off the ground
  step(s, [BTN.ATTACK | BTN.RIGHT, 0]);
  let ko = false;
  for (let i = 0; i < 200; i++) { step(s, [0, 0]); if (v.state === 'dead') ko = true; }
  check('back air at 150% near the edge KOs', ko, 'victim stocks ' + v.stocks);
}
// Every stage loads and has the pieces the engine needs.
{
  const { STAGES } = await import('../stages/index.js');
  check('3 stages registered with collision, ledges and art', STAGES.length === 3 && STAGES.every((st) => st.solids.length && st.ledges.length === 2 && typeof st.art.draw === 'function'));
}
process.exit(fails ? 1 : 0);
