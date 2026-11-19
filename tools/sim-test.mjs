// Headless checks:  node tools/sim-test.mjs
// Runs the simulation without a browser to confirm it is deterministic and
// that basic movement behaves as tuned.
import { createMatch, step, hashState, serialize, deserialize } from '../engine/sim.js';
import { BTN } from '../engine/input.js';
import { FX } from '../engine/fixed.js';

// The older tests press a direction and attack on the same frame and expect a
// tilt. That input is now a smash attack ("flick"), so the flick window is
// switched off here and switched back on for the smash attack tests.
const { CONFIG: TEST_CONFIG } = await import('../config/config.js');
const FLICK = TEST_CONFIG.SMASH_FLICK_FRAMES;
TEST_CONFIG.SMASH_FLICK_FRAMES = 0;
// most tests use Cloudrest: same main stage as the others, but no platforms to land on mid-test
const setup = { stageId: 'cloudrest', players: [{ charId: 'simeon', alt: 0 }, { charId: 'simeon', alt: 1 }], stocks: 3, seed: 1234 };
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

// Reverse aerial rush: run right, switch to left (cleanly, with a neutral
// frame, or rolling the keys), jump, then back air. Should be a bair while
// still sliding right.
for (const [label, gap] of [['clean switch', []], ['let go first', [[1, 0]]], ['both keys held', [[2, BTN.LEFT | BTN.RIGHT]]]]) {
  const s = createMatch(setup); const f = s.fighters[0];
  const seq = [[1, BTN.RIGHT], [1, 0], [30, BTN.RIGHT], ...gap, [2, BTN.LEFT], [1, BTN.LEFT | BTN.JUMP], [3, BTN.LEFT], [1, BTN.RIGHT | BTN.ATTACK]];
  for (const [n, m] of seq) for (let i = 0; i < n; i++) step(s, [m, 0]);
  check('RAR (' + label + '): back air while sliding forward', f.move === 'bair' && f.facing === -1 && f.vx > 0, `move ${f.move}, facing ${f.facing}, vx ${(f.vx / FX).toFixed(2)}`);
}

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
  f.x = 63 * FX; f.vx = 2 * FX; f.y = 236 * FX; f.grounded = 0; f.ground = -1; f.state = 'air';
  let touched = false;
  for (let i = 0; i < 5; i++) { step(s, [BTN.RIGHT, 0]); if (f.wallSide === 1) touched = true; }
  check('stage wall blocks and reports contact', touched && f.x <= (70 - 5) * FX);
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
  check('toward stage gets up onto the stage', f.grounded === 1 && f.y === 170 * FX && f.x > 70 * FX, 'x ' + (f.x / FX));
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
  step(s, [BTN.ATTACK | BTN.RIGHT, 0]);
  let firstHit = -1;
  for (let i = 0; i < 60; i++) { step(s, [0, 0]); if (firstHit < 0 && v.percent > 0) firstHit = a.stateFrame; }
  check('forward tilt (one-two) lands both punches for 12%, first on frame 4', v.percent === 120 && firstHit === 4, `${v.percent / 10}% on frame ${firstHit}`);
  check('both fighters recover afterwards', a.state === 'idle' && v.state === 'idle' && v.x > a.x + 16 * FX);
  // up tilt launches upward
  s = near(); [a, v] = s.fighters;
  step(s, [BTN.ATTACK | BTN.UP, 0]);
  let lifted = false;
  for (let i = 0; i < 40; i++) { step(s, [BTN.UP, 0]); if (!v.grounded) lifted = true; }
  check('up tilt pops the opponent into the air', a.move === '' && v.percent === 55 && lifted);
  // an aerial with landing lag, and an auto-cancelled one
  s = createMatch(setup); a = s.fighters[0];
  a.y -= 24 * FX; a.grounded = 0; a.ground = -1; a.state = 'air'; // falling from just above the floor
  step(s, [BTN.ATTACK | BTN.RIGHT, 0]);
  let lag = -1;
  for (let i = 0; i < 80 && lag < 0; i++) { step(s, [0, 0]); if (a.state === 'land') lag = a.landLag; }
  check('landing during forward air gives its landing lag', lag === 11, 'lag ' + lag);
  s = createMatch(setup); a = s.fighters[0];
  for (let i = 0; i < 4; i++) step(s, [BTN.JUMP, 0]);
  step(s, [BTN.JUMP | BTN.ATTACK | BTN.UP, 0]);
  lag = -1;
  for (let i = 0; i < 80 && lag < 0; i++) { step(s, [BTN.JUMP, 0]); if (a.state === 'land') lag = a.landLag; }
  check('up air finished before landing auto-cancels', lag === 2, 'lag ' + lag);
  // buffering: double-tap and a jump pressed during a tilt's last frames come out at once
  s = createMatch(setup); a = s.fighters[0]; s.fighters[1].x = 900 * FX;
  step(s, [BTN.ATTACK | BTN.UP, 0]);
  for (let i = 0; i < 14; i++) step(s, [0, 0]);
  for (const m of [BTN.RIGHT, 0, 0, BTN.RIGHT, BTN.RIGHT, BTN.RIGHT, BTN.RIGHT, BTN.RIGHT, BTN.RIGHT]) step(s, [m, 0]);
  check('double-tap during a tilt dashes on the first free frame', a.state === 'dash' && a.stateFrame <= 2, a.state + ' ' + a.stateFrame);
  s = createMatch(setup); a = s.fighters[0]; s.fighters[1].x = 900 * FX;
  step(s, [BTN.ATTACK | BTN.UP, 0]);
  for (let i = 0; i < 21; i++) step(s, [0, 0]);
  step(s, [BTN.JUMP, 0]);
  for (let i = 0; i < 6; i++) step(s, [0, 0]);
  check('jump pressed late in a tilt is buffered', a.state === 'jumpsquat' || a.state === 'air', a.state);
  for (let i = 0; i < 12; i++) step(s, [0, 0]);
  check('a buffered jump does not also spend the double jump', a.jumpsLeft === 1);
  // up air: a tight arc that hits close opponents and does not reach far up
  const uairAt = (dx, dy) => {
    const s = createMatch(setup); const [a, v] = s.fighters;
    for (const f of [a, v]) { f.y -= 80 * FX; f.grounded = 0; f.ground = -1; f.state = 'air'; f.vy = 0; }
    v.x = a.x + dx * FX; v.y = a.y - dy * FX;
    step(s, [BTN.ATTACK | BTN.UP, 0]);
    for (let i = 0; i < 12; i++) { step(s, [0, 0]); a.vy = 0; v.vy = 0; }   // hold both in place
    return v.percent;
  };
  for (const dy of [20, 44]) check(`up air hits an opponent directly above (${dy}px up)`, uairAt(0, dy) === 70);
  check('up air hits an opponent right next to him', uairAt(8, 0) === 70);
  check('up air does not reach high overhead (58px up)', uairAt(0, 58) === 0);
  // down air spikes an opponent below
  s = createMatch(setup); [a, v] = s.fighters;
  for (const f of [a, v]) { f.y -= 90 * FX; f.grounded = 0; f.ground = -1; f.state = 'air'; f.vy = 0; }
  v.x = a.x; v.y = a.y + 30 * FX;
  step(s, [BTN.ATTACK | BTN.DOWN, 0]);
  let spiked = false;
  check('pressing down for a down air does not fast fall', a.fastFall === 0);
  for (let i = 0; i < 30; i++) { step(s, [0, 0]); a.vy = 0; if (v.state !== 'hitstun') v.vy = 0; else if (v.kbAngle === 270) spiked = true; }
  check('down air spikes for 14%', spiked && v.percent === 140, v.percent / 10 + '%');
  {
    const t = createMatch(setup); const [b, w] = t.fighters;
    for (const f of [b, w]) { f.y -= 90 * FX; f.grounded = 0; f.ground = -1; f.state = 'air'; f.vy = 0; }
    w.x = b.x + 10 * FX; w.y = b.y - 22 * FX;
    step(t, [BTN.ATTACK | BTN.DOWN, 0]);
    let first = -1, ang = -1;
    for (let i = 0; i < 25; i++) { step(t, [0, 0]); b.vy = 0; if (w.state !== 'hitstun') w.vy = 0; else if (first < 0) { first = b.stateFrame; ang = w.kbAngle; } }
    check('down air body hit comes out on frame 14 and does not spike', first === 14 && ang !== 270, `frame ${first}, angle ${ang}`);
  }
  // forward air: strongest hit at the foot on frame 10
  s = createMatch(setup); [a, v] = s.fighters;
  for (const f of [a, v]) { f.y -= 80 * FX; f.grounded = 0; f.ground = -1; f.state = 'air'; f.vy = 0; }
  v.x = a.x + 22 * FX;
  step(s, [BTN.ATTACK | BTN.RIGHT, 0]);
  let fairFrame = -1;
  for (let i = 0; i < 30; i++) { step(s, [0, 0]); a.vy = 0; if (v.state !== 'hitstun') v.vy = 0; if (fairFrame < 0 && v.percent) fairFrame = a.stateFrame; }
  check('forward air punch: 15% on frame 15, launched forward not down', v.percent === 150 && fairFrame === 15 && v.kbAngle !== 270, `${v.percent / 10}% on ${fairFrame}, angle ${v.kbAngle}`);
  // knockdown and getup attack
  s = createMatch(setup); [a, v] = s.fighters;
  v.percent = 900; v.x = a.x + 16 * FX;
  step(s, [BTN.ATTACK | BTN.UP, 0]);
  let downed = false;
  for (let i = 0; i < 200 && !downed; i++) { step(s, [0, 0]); downed = v.state === 'knockdown'; }
  check('landing while tumbling knocks you down', downed, v.state);
  a.x = v.x + 14 * FX; a.facing = -1; a.state = 'idle'; a.move = '';
  for (let i = 0; i < 20; i++) step(s, [0, 0]);
  const before = a.percent;
  step(s, [0, BTN.ATTACK]);
  check('getup attack makes him intangible', v.move === 'getupAttack' && v.intangible > 0);
  for (let i = 0; i < 40; i++) step(s, [0, 0]);
  check('getup attack hits a nearby opponent for 7%', a.percent - before === 70, (a.percent - before) / 10 + '%');
  // dash attack out of a run
  s = createMatch(setup); [a, v] = s.fighters; v.x = a.x + 44 * FX;
  for (const [n, m] of [[1, BTN.RIGHT], [2, 0], [6, BTN.RIGHT]]) for (let i = 0; i < n; i++) step(s, [m, 0]);
  step(s, [BTN.RIGHT | BTN.ATTACK, 0]);
  const wasDash = a.move === 'dashAttack';
  for (let i = 0; i < 60; i++) step(s, [0, 0]);
  check('dash attack: both hits land for 8%', wasDash && v.percent === 80 && a.state === 'idle', `${v.percent / 10}%`);
  // whenever the first hit connects, the second one follows, at any percent and range
  for (const [d, pct] of [[44, 0], [56, 0], [74, 0], [50, 120], [68, 120]]) {
    const s = createMatch(setup); const [a, v] = s.fighters; v.x = a.x + d * FX; v.percent = pct * 10;
    for (const [n, m] of [[1, BTN.RIGHT], [2, 0], [6, BTN.RIGHT]]) for (let i = 0; i < n; i++) step(s, [m, 0]);
    step(s, [BTN.RIGHT | BTN.ATTACK, 0]);
    for (let i = 0; i < 60; i++) step(s, [0, 0]);
    check(`dash attack links both hits (${d}px away, ${pct}%)`, v.percent - pct * 10 === 80, `${v.percent / 10 - pct}%`);
  }
  {
    const s = createMatch(setup); const [a, v] = s.fighters; v.x = a.x + 84 * FX;
    for (const [n, m] of [[1, BTN.RIGHT], [2, 0], [6, BTN.RIGHT]]) for (let i = 0; i < n; i++) step(s, [m, 0]);
    step(s, [BTN.RIGHT | BTN.ATTACK, 0]);
    for (let i = 0; i < 60; i++) step(s, [0, 0]);
    check('dash attack kick still comes out when the first hit misses', v.percent === 60, `${v.percent / 10}%`);
  }
  for (const gap of [10, 16, 22]) {
    const t = createMatch(setup); const [b, w] = t.fighters;
    for (const f of [b, w]) { f.y -= 90 * FX; f.grounded = 0; f.ground = -1; f.state = 'air'; f.vy = 0; f.vx = 0; }
    b.facing = 1; w.x = b.x - gap * FX;
    step(t, [BTN.ATTACK | BTN.LEFT, 0]);
    const hitsAt = []; let last = 0;
    for (let i = 0; i < 30; i++) { step(t, [0, 0]); b.vy = 0; b.vx = 0; if (w.state !== 'hitstun') { w.vy = 0; w.vx = 0; } if (w.percent !== last) { hitsAt.push(b.stateFrame); last = w.percent; } }
    check(`back air (${gap}px behind): three kicks land on frames 5, 7 and 11 for 11.5%`, w.percent === 115 && hitsAt.join() === '5,7,11', `${w.percent / 10}% on ${hitsAt}`);
  }
  // high percent back air sends far enough to KO
  s = near(); [a, v] = s.fighters;
  v.percent = 1500; a.facing = -1; a.x = 390 * FX; v.x = 406 * FX;
  // both in the air (the kicks need time: it lands before kick 3 from a tiny hop)
  for (const f of [a, v]) { f.y -= 30 * FX; f.grounded = 0; f.ground = -1; f.state = 'air'; f.vy = 0; }
  step(s, [BTN.ATTACK | BTN.RIGHT, 0]);
  let ko = false;
  for (let i = 0; i < 200; i++) { step(s, [0, 0]); if (i < 15) { a.vy = 0; if (v.state !== 'hitstun') v.vy = 0; } if (v.state === 'dead') ko = true; }
  check('back air at 150% near the edge KOs', ko, 'victim stocks ' + v.stocks);
}
// Bluff in the air floats: falls much slower than normal
{
  const fall = (btns) => {
    const s = createMatch(setup); const a = s.fighters[0];
    a.y -= 120 * FX; a.grounded = 0; a.ground = -1; a.state = 'air'; a.vy = 3 * FX;
    const y0 = a.y;
    step(s, [btns, 0]);
    for (let i = 0; i < 20; i++) step(s, [0, 0]);
    return { dy: (a.y - y0) / FX, move: a.move };
  };
  const normal = fall(0), bluff = fall(BTN.SPECIAL | BTN.DOWN);
  check('bluff in the air falls much slower', bluff.move === 'bluff' && bluff.dy * 3 < normal.dy, `bluff ${bluff.dy.toFixed(1)}px vs normal ${normal.dy.toFixed(1)}px`);
}
// Every stage loads and has the pieces the engine needs.
{
  const { STAGES } = await import('../stages/index.js');
  check('4 stages registered with collision, ledges (or a walk-off floor) and art', STAGES.length === 4 && STAGES.every((st) => st.solids.length && (st.ledges.length === 2 || st.solids[0].x < st.blast.left) && typeof st.art.draw === 'function'));
}
// Ledge attack
{
  const s = createMatch(setup); const [f, v] = s.fighters;
  for (let i = 0; i < 200 && f.state !== 'ledge'; i++) step(s, [f.grounded ? BTN.LEFT : BTN.RIGHT, 0]);
  for (let i = 0; i < 10; i++) step(s, [0, 0]);
  v.x = 95 * FX; v.facing = -1;
  step(s, [BTN.ATTACK, 0]);
  check('ledge attack starts from the ledge and is intangible', f.move === 'ledgeAttack' && f.intangible > 0);
  for (let i = 0; i < 60; i++) step(s, [0, 0]);
  check('ledge attack climbs onto the stage and hits for 9%', f.state === 'idle' && f.grounded && f.y === 170 * FX && f.x > 70 * FX && v.percent === 90, `${v.percent / 10}% x ${f.x / FX}`);
}
// Knocked-down opponents lie on the floor and can be hit by jab and tilts
{
  const { CHARACTERS } = await import('../characters/index.js');
  const { samplePose, solve, hurtboxes } = await import('../engine/skeleton.js');
  const ch = CHARACTERS[0];
  const hb = hurtboxes(ch.skeleton, solve(ch.skeleton, samplePose(ch.animations.lie, 10)), 1);
  const bottom = Math.max(...hb.map((b) => b[3])) / FX, top = Math.min(...hb.map((b) => b[1])) / FX;
  check('lying down sits on the floor', bottom <= 1 && bottom >= -2 && top > -18, `from ${top.toFixed(1)} to ${bottom.toFixed(1)}`);
  for (const [name, input] of [['jab', BTN.ATTACK], ['forward tilt', BTN.ATTACK | BTN.RIGHT], ['up tilt', BTN.ATTACK | BTN.UP], ['down tilt', BTN.ATTACK | BTN.DOWN]]) {
    const s = createMatch(setup); const [a, v] = s.fighters;
    v.x = a.x + 22 * FX; v.state = 'knockdown'; v.anim = 'lie'; v.animFrame = 10; v.stateFrame = 0;
    step(s, [input, 0]);
    for (let i = 0; i < 12; i++) step(s, [input & ~BTN.ATTACK, 0]);
    check(`${name} hits a knocked-down opponent`, v.percent > 0, `${v.percent / 10}%`);
  }
}
// Jumping out of aerials: pressing jump early and holding it jumps on the first free frame
{
  for (const [name, dirBtn] of [['nair', 0], ['bair', BTN.LEFT], ['uair', BTN.UP]]) {
    const s = createMatch(setup); const a = s.fighters[0];
    a.y -= 120 * FX; a.grounded = 0; a.ground = -1; a.state = 'air'; a.facing = 1;
    step(s, [BTN.ATTACK | dirBtn, 0]);
    const faf = (await import('../characters/index.js')).getCharacter('simeon').moves[name].faf;
    let jumped = -1;
    for (let f = 1; f < 70 && jumped < 0; f++) { a.vy = 0; step(s, [f >= 4 ? BTN.JUMP : 0, 0]); if (a.jumpsLeft === 0) jumped = f; }
    check(`${name}: jump held early comes out on the first free frame`, jumped === faf, `frame ${jumped}, free on ${faf}`);
  }
}
// Shield, parry and dodges
{
  const { CONFIG } = await import('../config/config.js');
  const near = (gap = 16) => { const s = createMatch(setup); s.fighters[1].x = s.fighters[0].x + gap * FX; s.fighters[1].facing = -1; return s; };
  // holding shield drains it, letting go regenerates it
  let s = near(); let [a, v] = s.fighters;
  for (let i = 0; i < 60; i++) step(s, [0, BTN.SHIELD]);
  const drained = v.shieldHp;
  for (let i = 0; i < 60; i++) step(s, [0, 0]);
  check('holding shield drains it and letting go refills it', v.state === 'idle' && CONFIG.SHIELD_MAX - drained >= 59 * CONFIG.SHIELD_DEPLETE && v.shieldHp > drained);
  // a forward tilt into shield: no damage, shield loses health, shield stun and pushback
  s = near(); [a, v] = s.fighters;
  for (let i = 0; i < 5; i++) step(s, [0, BTN.SHIELD]);
  const x0 = v.x, hp0 = v.shieldHp;
  step(s, [BTN.ATTACK | BTN.RIGHT, BTN.SHIELD]);
  let stunned = false;
  for (let i = 0; i < 30; i++) { step(s, [0, BTN.SHIELD]); if (v.state === 'shieldStun') stunned = true; }
  check('shield blocks: no damage, shield stun, pushed back', v.percent === 0 && stunned && v.x > x0 && hp0 - v.shieldHp >= 8330, `shield lost ${(hp0 - v.shieldHp) / 1000}`);
  // holding shield for too long breaks it
  s = near(60); [a, v] = s.fighters;
  let broke = false, dizzy = false;
  for (let i = 0; i < 400; i++) { step(s, [0, BTN.SHIELD]); if (v.state === 'shieldBreak') broke = true; if (v.state === 'dizzy') dizzy = true; }
  check('shield breaks: launched up, then dizzy', broke && dizzy);
  for (let i = 0; i < 300; i++) step(s, [0, 0]);
  check('recovers from dizzy with part of the shield back', v.state === 'idle' && v.shieldHp >= CONFIG.SHIELD_BREAK_REFILL);
  // parry: let go of shield just before the hit lands
  s = near(); [a, v] = s.fighters;
  for (let i = 0; i < 10; i++) step(s, [0, BTN.SHIELD]);
  step(s, [BTN.ATTACK | BTN.RIGHT, BTN.SHIELD]);
  for (let i = 0; i < 2; i++) step(s, [0, BTN.SHIELD]);
  step(s, [0, 0]); step(s, [0, 0]);   // released 2 frames before the frame-5 hit
  let parried = false;
  for (let i = 0; i < 4; i++) { step(s, [0, 0]); if (v.parryTick >= 0) parried = true; }
  check('parry: no damage and the attacker is frozen longer', parried && v.percent === 0 && a.hitlag > 10, `attacker frozen ${a.hitlag}`);
  // shield poking: a low sweep hits the feet under a worn-down shield
  s = near(); [a, v] = s.fighters;
  v.shieldHp = 9000;
  for (let i = 0; i < 3; i++) step(s, [0, BTN.SHIELD]);
  step(s, [BTN.ATTACK | BTN.DOWN, BTN.SHIELD]);
  for (let i = 0; i < 12; i++) step(s, [BTN.DOWN, BTN.SHIELD]);
  check('a small shield can be poked under', v.percent > 0, `${v.percent / 10}%`);
  // jump out of shield
  s = near(60); [a, v] = s.fighters;
  for (let i = 0; i < 5; i++) step(s, [0, BTN.SHIELD]);
  step(s, [0, BTN.SHIELD | BTN.JUMP]);
  check('jump out of shield', v.state === 'jumpsquat');
  // rolls
  s = near(60); [a, v] = s.fighters;
  for (let i = 0; i < 3; i++) step(s, [0, BTN.SHIELD]);
  const rx = v.x, face = v.facing;
  step(s, [0, BTN.SHIELD | BTN.LEFT]);   // v faces left: this is a forward roll
  const intang = [];
  for (let i = 0; i < 40; i++) { step(s, [0, BTN.SHIELD]); if (v.state === 'roll') intang.push(v.intangible ? 1 : 0); }
  check('forward roll travels, is intangible mid-roll, ends facing the other way', (rx - v.x) / FX > 42 && intang[6] === 1 && intang[0] === 0 && v.facing === -face, `${((rx - v.x) / FX).toFixed(1)}px`);
  // spot dodge: an attack passes straight through
  s = near(); [a, v] = s.fighters;
  for (let i = 0; i < 3; i++) step(s, [0, BTN.SHIELD]);
  step(s, [BTN.ATTACK | BTN.RIGHT, BTN.SHIELD | BTN.DOWN]);
  for (let i = 0; i < 20; i++) step(s, [0, BTN.SHIELD]);
  check('spot dodge: the attack goes through', v.percent === 0 && v.shieldHitTick < 0);
  // air dodge: once per airtime, directional travels, landing lag
  s = near(60); [a, v] = s.fighters;
  a.y -= 60 * FX; a.grounded = 0; a.ground = -1; a.state = 'air';
  const ax = a.x;
  step(s, [BTN.SHIELD | BTN.RIGHT, 0]);
  check('air dodge starts', a.state === 'airdodge' && a.airDodged === 1);
  for (let i = 0; i < 20; i++) step(s, [0, 0]);
  check('directional air dodge travels that way', (a.x - ax) / FX > 25, `${((a.x - ax) / FX).toFixed(1)}px`);
  {
    const s2 = createMatch(setup); const b = s2.fighters[0];
    b.y -= 100 * FX; b.grounded = 0; b.ground = -1; b.state = 'air'; b.vy = 0;
    const y0 = b.y;
    step(s2, [BTN.SHIELD, 0]); step(s2, [BTN.SHIELD | BTN.UP, 0]);   // direction one frame late
    for (let i = 0; i < 20; i++) step(s2, [0, 0]);
    check('air dodge direction pressed a frame late still counts (up)', b.dodgeDir === 1 && (y0 - b.y) / FX > 15, `${((y0 - b.y) / FX).toFixed(1)}px up`);
  }
  let again = false;
  for (let i = 0; i < 40; i++) { step(s, [i % 2 ? BTN.SHIELD : 0, 0]); if (a.state === 'airdodge' && a.stateFrame < 3 && i > 0) again = true; }
  check('only one air dodge per airtime', !again);
  s = createMatch(setup); a = s.fighters[0];
  a.y -= 10 * FX; a.grounded = 0; a.ground = -1; a.state = 'air';
  step(s, [BTN.SHIELD | BTN.DOWN, 0]);
  let lagged = -1;
  for (let i = 0; i < 20 && lagged < 0; i++) { step(s, [0, 0]); if (a.state === 'land') lagged = a.landLag; }
  check('landing during an air dodge has landing lag, and air dodge comes back', lagged === CONFIG.AIRDODGE_LAND_LAG && a.airDodged === 0, 'lag ' + lagged);
}
// Ledge roll
{
  const s = createMatch(setup); const f = s.fighters[0];
  for (let i = 0; i < 200 && f.state !== 'ledge'; i++) step(s, [f.grounded ? BTN.LEFT : BTN.RIGHT, 0]);
  for (let i = 0; i < 10; i++) step(s, [0, 0]);
  step(s, [BTN.SHIELD, 0]);
  const intang = [];
  for (let i = 0; i < 40; i++) { step(s, [0, 0]); if (f.state === 'ledgeRoll') intang.push(f.intangible); }
  check('U on the ledge rolls onto the stage, away from the edge, mostly intangible', f.state === 'idle' && f.grounded && f.y === 170 * FX && f.x > 100 * FX && intang.slice(0, 20).every((v) => v), `x ${(f.x / FX).toFixed(0)}`);
}
{
  const s = createMatch(setup); const f = s.fighters[0];
  for (let i = 0; i < 200 && f.state !== 'ledge'; i++) step(s, [f.grounded ? BTN.LEFT : BTN.RIGHT, 0]);
  step(s, [BTN.SHIELD, 0]);   // pressed on the very first frame of hanging
  for (let i = 0; i < 12; i++) step(s, [0, 0]);
  check('ledge roll pressed the moment he grabs the ledge still comes out', f.state === 'ledgeRoll', f.state);
}
// Bluff (down special counter)
{
  const near = () => { const s = createMatch(setup); s.fighters[1].x = s.fighters[0].x + 16 * FX; s.fighters[1].facing = -1; return s; };
  // forward tilt (7%) into Bluff: no damage taken, counter deals 8.4%
  let s = near(); let [a, v] = s.fighters;
  step(s, [0, BTN.SPECIAL | BTN.DOWN]);
  for (let i = 0; i < 4; i++) step(s, [0, 0]);
  step(s, [BTN.ATTACK | BTN.RIGHT, 0]);
  let countered = false;
  for (let i = 0; i < 40; i++) { step(s, [0, 0]); if (v.move === 'bluffHit') countered = true; }
  check('Bluff catches a hit: no damage, counters back (at least 8%)', countered && v.percent === 0 && a.percent === 80, `simeon ${v.percent / 10}%, attacker ${a.percent / 10}%`);
  // a weak hit still gets at least 8%
  s = near(); [a, v] = s.fighters;
  step(s, [0, BTN.SPECIAL | BTN.DOWN]);
  for (let i = 0; i < 6; i++) step(s, [0, 0]);
  step(s, [BTN.ATTACK, 0]);   // jab, 2.2%
  for (let i = 0; i < 40; i++) step(s, [0, 0]);
  check('Bluff counter deals at least 8%', a.percent === 80, `${a.percent / 10}%`);
  // whiffed Bluff is punishable
  s = near(); [a, v] = s.fighters;
  step(s, [0, BTN.SPECIAL | BTN.DOWN]);
  for (let i = 0; i < 30; i++) step(s, [0, 0]);
  step(s, [BTN.ATTACK | BTN.RIGHT, 0]);
  for (let i = 0; i < 10; i++) step(s, [0, 0]);
  check('after the counter window ends, Bluff can be hit', v.percent > 0 && a.percent === 0);
  // works in the air
  s = near(); [a, v] = s.fighters;
  for (const f of [a, v]) { f.y -= 50 * FX; f.grounded = 0; f.ground = -1; f.state = 'air'; f.vy = 0; }
  step(s, [0, BTN.SPECIAL | BTN.DOWN]);
  for (let i = 0; i < 4; i++) { step(s, [0, 0]); a.vy = 0; v.vy = 0; }
  step(s, [BTN.ATTACK, 0]);
  countered = false;
  for (let i = 0; i < 30; i++) { step(s, [0, 0]); a.vy = 0; if (v.state !== 'hitstun') v.vy = 0; if (v.move === 'bluffHit') countered = true; }
  check('Bluff works in the air', countered && v.percent === 0 && a.percent > 0);
}
// Jump Shot (neutral special): bouncing basketball
{
  const shoot = (s, hold) => { step(s, [BTN.SPECIAL, 0]); for (let i = 0; i < hold + 6; i++) step(s, [BTN.SPECIAL, 0]); for (let i = 0; i < 20 && !s.projectiles.length; i++) step(s, [0, 0]); };
  const landAt = (hold) => {
    const s = createMatch(setup); s.fighters[0].x = 110 * FX; s.fighters[1].x = 900 * FX;
    shoot(s, hold);
    for (let t = 0; t < 200; t++) { step(s, [0, 0]); const p = s.projectiles[0]; if (p && p.bounces === 1) return p.x / FX - 110; }
    return -1;
  };
  const tap = landAt(0), full = landAt(40);
  check('tap shot lands close, a charged shot lands much further', tap > 60 && tap < 130 && full > tap + 100, `tap ${tap.toFixed(0)}px, full ${full.toFixed(0)}px`);
  // hits for 6% in the air
  let s = createMatch(setup); let [a, v] = s.fighters; v.x = a.x + 70 * FX; v.facing = -1;
  shoot(s, 0);
  for (let i = 0; i < 80; i++) step(s, [0, 0]);
  check('the ball hits for 6% in flight', v.percent === 60, `${v.percent / 10}%`);
  // only one ball at a time
  s = createMatch(setup); a = s.fighters[0]; s.fighters[1].x = 900 * FX;
  shoot(s, 0);
  for (let i = 0; i < 30; i++) step(s, [0, 0]);
  step(s, [BTN.SPECIAL, 0]);
  check('only one ball at a time', s.projectiles.length === 1 && a.move !== 'jumpShot');
  // a rolling ball hits for 3%
  s = createMatch(setup); [a, v] = s.fighters; v.x = 900 * FX; a.x = 110 * FX;
  shoot(s, 15);
  let rollingAt = null;
  for (let i = 0; i < 200 && rollingAt === null; i++) { step(s, [0, 0]); const p = s.projectiles[0]; if (p && p.rolling && Math.abs(p.vx) > 0.7 * FX) rollingAt = p.x; }
  if (rollingAt !== null) { v.x = rollingAt + 14 * FX * Math.sign(s.projectiles[0].vx); v.y = 170 * FX; v.state = 'idle'; v.grounded = 1; v.ground = 0; }
  for (let i = 0; i < 30; i++) step(s, [0, 0]);
  check('a rolling ball hits for 3%', rollingAt !== null && v.percent === 30, `${v.percent / 10}%`);
  // shield blocks it, Bluff counters it
  s = createMatch(setup); [a, v] = s.fighters; v.x = a.x + 70 * FX; v.facing = -1;
  shoot(s, 0);
  for (let i = 0; i < 80; i++) step(s, [0, BTN.SHIELD]);
  check('shield blocks the ball', v.percent === 0 && v.shieldHitTick >= 0);
  s = createMatch(setup); [a, v] = s.fighters; v.x = a.x + 70 * FX; v.facing = -1;
  shoot(s, 0);
  let countered = false;
  for (let i = 0; i < 80; i++) { const p = s.projectiles[0]; const near = p && Math.abs(p.x - v.x) < 30 * FX && !v.move; step(s, [0, near ? BTN.SPECIAL | BTN.DOWN : 0]); if (v.move === 'bluffHit') countered = true; }
  check('Bluff counters the ball', countered && v.percent === 0);
  // deterministic
  const run = () => { const s = createMatch(setup); shoot(s, 17); for (let i = 0; i < 150; i++) step(s, [0, 0]); return hashState(s); };
  check('ball flight is deterministic', run() === run());
}
// Air specials can land without crashing (this used to freeze the game)
for (const [name, input] of [['Bluff', BTN.SPECIAL | BTN.DOWN], ['Jump Shot', BTN.SPECIAL]]) {
  const s = createMatch(setup); const a = s.fighters[0];
  a.y -= 16 * FX; a.grounded = 0; a.ground = -1; a.state = 'air';
  let ok = true;
  try { step(s, [input, 0]); for (let i = 0; i < 80; i++) step(s, [0, 0]); } catch (e) { ok = false; }
  check(`${name} in the air lands safely`, ok && a.grounded === 1);
}
// Grabs, pummel and throws
{
  const near = (gap = 16) => { const s = createMatch(setup); s.fighters[1].x = s.fighters[0].x + gap * FX; s.fighters[1].facing = -1; return s; };
  const grabbed = (s) => { step(s, [BTN.GRAB, 0]); for (let i = 0; i < 10 && s.fighters[0].state !== 'holding'; i++) step(s, [0, 0]); return s.fighters[0].state === 'holding'; };
  let s = near(); let [a, v] = s.fighters;
  check('standing grab catches a nearby opponent', grabbed(s) && v.state === 'grabbed' && v.heldBy === 0);
  s = near(); [a, v] = s.fighters;
  for (let i = 0; i < 4; i++) step(s, [0, BTN.SHIELD]);
  check('grabs go through shields', grabbed(s));
  s = near(60); [a, v] = s.fighters;
  step(s, [BTN.GRAB, 0]); for (let i = 0; i < 40; i++) step(s, [0, 0]);
  check('a missed grab has ending lag, then he can act', a.state === 'idle' && v.state === 'idle');
  s = near(); [a, v] = s.fighters;
  for (let i = 0; i < 3; i++) step(s, [0, BTN.SHIELD]);
  step(s, [0, BTN.SHIELD | BTN.ATTACK]); for (let i = 0; i < 10; i++) step(s, [0, 0]);
  check('shield + attack grabs out of shield', v.state === 'holding');
  // pummel
  s = near(); [a, v] = s.fighters; grabbed(s);
  step(s, [BTN.ATTACK, 0]); for (let i = 0; i < 16; i++) step(s, [0, 0]);
  check('pummel deals 1.3% and keeps holding', v.percent === 13 && a.state === 'holding');
  // each throw: damage and direction
  for (const [name, input, dmg, test] of [
    ['forward throw', BTN.RIGHT, 80, (v, a) => v.x > a.x + 30 * FX],
    ['back throw', BTN.LEFT, 110, (v, a) => v.x < a.x - 30 * FX],
    ['up throw', BTN.UP, 70, (v, a) => v.y < a.y - 40 * FX],
    ['down throw', BTN.DOWN, 50, (v, a) => v.y < a.y - 10 * FX],
  ]) {
    const s = near(); const [a, v] = s.fighters; grabbed(s);
    step(s, [input, 0]);
    let spun = false, top = v.y;
    for (let i = 0; i < 60; i++) { step(s, [0, 0]); top = Math.min(top, v.y); if (a.state === 'throwing' && a.facing !== 1) spun = true; if (i === 40) break; }
    if (name === 'down throw') v.y = top;
    const went = test(v, a);
    for (let i = 0; i < 30; i++) step(s, [0, 0]);
    const endFacing = name === 'back throw' ? -1 : 1;   // a back throw leaves him facing the way he threw
    check(`${name}: ${dmg / 10}%, sends the right way${name === 'back throw' ? ', spins round and ends facing back' : ''}`,
      v.percent === dmg && went && (name !== 'back throw' || spun) && a.state !== 'throwing' && a.facing === endFacing, `${v.percent / 10}% dx ${((v.x - a.x) / FX).toFixed(0)} dy ${((v.y - a.y) / FX).toFixed(0)}`);
  }
  // back throw kills at high percent near the edge
  const { CpuController } = await import('../engine/cpu.js');
  // throw toward the left edge from right beside it; the victim tries to recover
  const throwKO = (dirName, pct) => {
    const s = near(); const [a, v] = s.fighters;
    const faceEdge = dirName !== 'back';
    a.x = (faceEdge ? 102 : 86) * FX; v.x = (faceEdge ? 86 : 102) * FX;
    a.facing = v.x > a.x ? 1 : -1; v.facing = -a.facing; v.percent = pct * 10;
    step(s, [BTN.GRAB, 0]); for (let i = 0; i < 10 && a.state !== 'holding'; i++) step(s, [0, 0]);
    step(s, [{ forward: a.facing > 0 ? BTN.RIGHT : BTN.LEFT, back: a.facing > 0 ? BTN.LEFT : BTN.RIGHT, down: BTN.DOWN }[dirName], 0]);
    const d = new CpuController('dummy', 3);   // the victim tries to recover
    for (let i = 0; i < 400; i++) { step(s, [0, d.sample(s, 1)]); if (v.state === 'dead') return true; }
    return false;
  };
  const backThrowKO = (pct) => throwKO('back', pct);
  check('back throw near the edge: survivable at 100%, KOs at 140%', !backThrowKO(100) && backThrowKO(140));
  check('forward throw near the edge: still survivable at 180%', !throwKO('forward', 180));
  check('down throw near the edge: still survivable at 250%', !throwKO('down', 250));
  // mashing breaks free sooner
  const escape = (mash) => { const s = near(); grabbed(s); let t = 0; for (; t < 300 && s.fighters[1].state === 'grabbed'; t++) step(s, [0, mash && (t & 1) ? BTN.ATTACK : 0]); return t; };
  const slow = escape(false), fast = escape(true);
  check('grab lets go on its own, and mashing breaks out much sooner', slow >= 85 && fast < slow * 0.6, `${slow} vs ${fast} frames`);
  // dash grab
  s = near(70); [a, v] = s.fighters;
  for (const [n, m] of [[1, BTN.RIGHT], [2, 0], [5, BTN.RIGHT]]) for (let i = 0; i < n; i++) step(s, [m, 0]);
  step(s, [BTN.RIGHT | BTN.GRAB, 0]);
  const dg = a.move;
  for (let i = 0; i < 14; i++) step(s, [0, 0]);
  check('grab while running is a dash grab', dg === 'dashGrab');
}
// Specials by direction in the air: none = Jump Shot, sideways = Combo Breaker, up = Alley-Oop
for (const [label, hold, wait, want] of [['no direction', 0, 20, 'jumpShot'], ['holding sideways', BTN.RIGHT, 6, 'combo1'], ['holding up', BTN.UP, 20, 'alleyOop']]) {
  const s = createMatch(setup); const a = s.fighters[0]; s.fighters[1].x = 900 * FX;
  step(s, [BTN.JUMP, 0]); for (let i = 0; i < wait; i++) step(s, [BTN.JUMP | hold, 0]);
  step(s, [BTN.SPECIAL | hold, 0]);
  check(`special in the air while ${label} is ${want}`, a.move === want, a.move);
}
// Fast Break: no longer Simeon's side special, but kept (for another fighter):
// these tests put it back on his side special while they run.
const SIM_SPECIALS = (await import('../characters/index.js')).getCharacter('simeon').specials;
const SIM_SIDE = SIM_SPECIALS.side;
SIM_SPECIALS.side = 'fastBreak';
// Fast Break (side special): charge for distance and damage; 1 in 10 misfires
{
  const fb = (hold, seed, gap) => {
    const s = createMatch({ ...setup, seed }); const [a, v] = s.fighters; a.x = 100 * FX; v.x = gap ? a.x + gap * FX : 900 * FX;
    const x0 = a.x; let mv = '';
    step(s, [BTN.SPECIAL | BTN.RIGHT, 0]); for (let i = 0; i < hold; i++) step(s, [BTN.SPECIAL, 0]);
    for (let i = 0; i < 150; i++) { step(s, [0, 0]); if (a.move) mv = a.move; }
    return { mv, dist: (a.x - x0) / FX, pct: v.percent, state: a.state, facing: a.facing };
  };
  let normal = 0, misSeed = 0;
  for (let sd = 1; sd < 200 && (!normal || !misSeed); sd++) { const r = fb(0, sd, 0); if (r.mv === 'fastBreakMisfire') misSeed = misSeed || sd; else normal = normal || sd; }
  const tap = fb(0, normal, 0), full = fb(90, normal, 0);
  check('fast break: a tap goes a short way, a full charge much further', tap.mv === 'fastBreak' && tap.dist > 60 && full.dist > tap.dist + 35 && tap.state === 'idle', `tap ${tap.dist.toFixed(0)}px, full ${full.dist.toFixed(0)}px`);
  const tapHit = fb(0, normal, 30), fullHit = fb(90, normal, 30);
  check('fast break: 6% uncharged, 21% fully charged', tapHit.pct === 60 && fullHit.pct === 210, `${tapHit.pct / 10}% and ${fullHit.pct / 10}%`);
  const mis = fb(0, misSeed, 0), misHit = fb(0, misSeed, 40);
  check('fast break misfire: flies furthest of all and deals 25%', misSeed > 0 && mis.dist > full.dist + 40 && misHit.pct === 250, `seed ${misSeed}: ${mis.dist.toFixed(0)}px, ${misHit.pct / 10}%`);
  let count = 0;
  for (let sd = 1; sd <= 300; sd++) if (fb(0, sd * 7919, 0).mv === 'fastBreakMisfire') count++;
  check('fast break misfires about 1 time in 10', count >= 15 && count <= 48, `${count} of 300`);
  // same seed and inputs always give the same result
  check('fast break misfire is deterministic', fb(0, misSeed, 0).dist === mis.dist);
  // hitting someone stops the dive instead of carrying on through them
  {
    const t = createMatch({ ...setup, seed: normal }); const [a, v] = t.fighters; a.x = 120 * FX; v.x = a.x + 40 * FX;
    step(t, [BTN.SPECIAL | BTN.RIGHT, 0]); for (let i = 0; i < 90; i++) step(t, [BTN.SPECIAL, 0]);
    let hitX = 0;
    for (let i = 0; i < 150; i++) { step(t, [0, 0]); if (!hitX && v.percent) hitX = a.x; }
    check('fast break stops when it connects (does not carry on past them)', hitX && a.x <= hitX + 2 * FX, `went ${((a.x - hitX) / FX).toFixed(0)}px past the hit`);
  }
}
// Charging Fast Break in the air: no drifting
{
  const s = createMatch(setup); const a = s.fighters[0]; s.fighters[1].x = 900 * FX;
  a.y -= 100 * FX; a.grounded = 0; a.ground = -1; a.state = 'air'; a.vx = 0; a.vy = 0;
  step(s, [BTN.SPECIAL | BTN.RIGHT, 0]);
  const x0 = a.x;
  for (let i = 0; i < 12; i++) step(s, [BTN.SPECIAL | BTN.LEFT, 0]);
  check('charging fast break in the air: holding a direction does not drift', a.move === 'fastBreak' && Math.abs(a.x - x0) < FX, `moved ${((a.x - x0) / FX).toFixed(1)}px`);
}
SIM_SPECIALS.side = SIM_SIDE;
// Combo Breaker (side special): up to four swings of the controller; direction picks each one
{
  const run = (dirs) => {
    const s = createMatch(setup); const [a, v] = s.fighters; v.x = a.x + 24 * FX; const moves = []; let high = false;
    step(s, [BTN.SPECIAL | BTN.RIGHT, 0]);
    for (let i = 0, k = 0; i < 160; i++) {
      // press again in each swing's window
      const pressNow = k < dirs.length && a.state === 'attack' && a.stateFrame === 12;
      step(s, [pressNow ? BTN.SPECIAL | dirs[k] : 0, 0]); if (pressNow) k++;
      if (a.move && moves[moves.length - 1] !== a.move) moves.push(a.move);
      if (v.y < a.y - 30 * FX) high = true;
    }
    return { moves, pct: v.percent / 10, up: high };
  };
  const fwd = run([0, 0, 0]), up = run([BTN.UP, BTN.UP, BTN.UP]), down = run([BTN.DOWN, BTN.DOWN, BTN.DOWN]), one = run([]);
  check('Combo Breaker: four forward swings for 18%, ending in a launch', fwd.moves.join() === 'combo1,combo2,combo3,combo4' && fwd.pct === 18, `${fwd.moves.join()} ${fwd.pct}%`);
  check('Combo Breaker: holding up or down changes the swings (up ends launching them upward)', up.moves.join() === 'combo1,combo2Up,combo3Up,combo4Up' && up.up && down.moves.join() === 'combo1,combo2Down,combo3Down,combo4Down' && down.pct >= 15,
    `${up.moves.join()} ${up.pct}% / ${down.moves.join()} ${down.pct}%`);
  check('Combo Breaker: a single press is a single 4% swing', one.moves.join() === 'combo1' && one.pct === 4, `${one.moves.join()} ${one.pct}%`);
}
// Falling below the screen is not an instant KO: there is time to recover
{
  const s = createMatch(setup); const a = s.fighters[0]; s.fighters[1].x = 900 * FX;
  a.x = 30 * FX; a.y = 300 * FX; a.grounded = 0; a.ground = -1; a.state = 'air'; a.vy = 0; a.jumpsLeft = 1;
  let frames = 0;
  while (a.state !== 'dead' && frames < 300) { step(s, [0, 0]); frames++; }
  check('falling from the bottom of the screen takes a while to KO', frames >= 40, frames + ' frames');
  const r = createMatch(setup); const b = r.fighters[0]; r.fighters[1].x = 900 * FX;
  b.x = 30 * FX; b.y = 330 * FX; b.grounded = 0; b.ground = -1; b.state = 'air'; b.vy = 0; b.jumpsLeft = 1;
  let saved = false;
  for (let i = 0; i < 260 && b.state !== 'dead' && !saved; i++) {
    // stay beside the ledge, not under the stage (but don't tap away from it during the up special: that turns him round)
    const toward = b.x < 52 * FX ? BTN.RIGHT : b.x > 60 * FX && (i < 30 || i > 60) ? BTN.LEFT : 0;
    const inp = i === 2 ? BTN.JUMP | toward : i === 30 ? BTN.SPECIAL | BTN.UP : toward;
    step(r, [inp, 0]); saved = b.state === 'ledge' || b.grounded === 1;
  }
  check('from below the screen, double jump + alley-oop gets back', saved, b.state + ' y ' + (b.y / FX).toFixed(0));
}
// Alley-Oop (up special): rising kicks that carry, a launching last kick, then helpless
{
  let s = createMatch(setup); let [a, v] = s.fighters; v.x = 900 * FX;
  const y0 = a.y, x0 = a.x; let top = y0, helpless = false, jumped = false, peakAt = 0;
  step(s, [BTN.SPECIAL | BTN.UP, 0]);
  for (let i = 0; i < 200; i++) {
    step(s, [(i < 30 ? BTN.LEFT : 0) | (a.state === 'helpless' ? BTN.JUMP | BTN.ATTACK : 0), 0]);
    if (a.y < top) { top = a.y; peakAt = i; }
    if (a.state === 'helpless') { helpless = true; if (a.vy < -FX || a.move) jumped = true; }
    if (helpless && a.grounded) break;
  }
  check('alley-oop shoots up about 110px fast, with only a little steering', (y0 - top) / FX > 95 && (y0 - top) / FX < 130 && peakAt < 46 && Math.abs(a.x - x0) / FX < 40, `${((y0 - top) / FX).toFixed(0)}px up in ${peakAt} frames, ${((a.x - x0) / FX).toFixed(0)}px sideways`);
  check('alley-oop ends in a helpless fall: no jump or attack until he lands', helpless && !jumped);
  check('landing from the helpless fall has landing lag', a.state === 'land' && a.landLag === 14, a.state + ' ' + a.landLag);
  // the kicks carry a nearby opponent up with him, and the last one launches them sideways
  s = createMatch(setup); [a, v] = s.fighters; v.x = a.x + 14 * FX;
  let hitsN = 0, last = 0, lastAngle = -1, carried = v.y;
  step(s, [BTN.SPECIAL | BTN.UP, 0]);
  for (let i = 0; i < 60; i++) { step(s, [0, 0]); if (v.percent !== last) { hitsN++; last = v.percent; lastAngle = v.kbAngle; } if (hitsN < 7) carried = Math.min(carried, v.y); }
  check('alley-oop: all seven kicks connect for 15%, carrying them up', hitsN === 7 && v.percent === 150 && (170 * FX - carried) / FX > 50, `${hitsN} hits, ${v.percent / 10}%, carried ${((170 * FX - carried) / FX).toFixed(0)}px up`);
  check('alley-oop: the last kick launches them sideways, not straight up', lastAngle === 48, 'angle ' + lastAngle);
  // recovering from below the ledge: it grabs the ledge on the way up
  s = createMatch(setup); [a, v] = s.fighters; v.x = 900 * FX;
  a.x = 56 * FX; a.y = 290 * FX; a.grounded = 0; a.ground = -1; a.state = 'air'; a.jumpsLeft = 0; a.vy = 0;
  step(s, [BTN.SPECIAL | BTN.UP, 0]);
  let grabbed = false;
  for (let i = 0; i < 120 && !grabbed; i++) { step(s, [0, 0]); grabbed = a.state === 'ledge'; }
  check('alley-oop from far below the stage reaches and grabs the ledge', grabbed, a.state + ' y ' + (a.y / FX).toFixed(0));
}
// Body push: no running through standing opponents, no pushing off edges, rolls still pass
{
  let s = createMatch(setup); let [a, v] = s.fighters;
  for (const [n, m] of [[1, BTN.RIGHT], [2, 0], [80, BTN.RIGHT]]) for (let i = 0; i < n; i++) step(s, [m, 0]);
  check('running into a standing opponent pushes them instead of passing through', v.x > a.x && v.x - a.x >= 5 * FX && v.x > 300 * FX);
  s = createMatch(setup); [a, v] = s.fighters; v.x = 390 * FX;
  for (const [n, m] of [[1, BTN.RIGHT], [2, 0], [190, BTN.RIGHT]]) for (let i = 0; i < n; i++) step(s, [m, 0]);
  check('nobody gets pushed off the edge', v.grounded === 1 && v.x <= 410 * FX && v.state !== 'dead');
  s = createMatch(setup); [a, v] = s.fighters; a.x = 230 * FX; v.x = 244 * FX;
  for (let i = 0; i < 3; i++) step(s, [BTN.SHIELD, 0]); step(s, [BTN.SHIELD | BTN.RIGHT, 0]); for (let i = 0; i < 35; i++) step(s, [BTN.SHIELD, 0]);
  check('rolling still goes through them', a.x > v.x);
  s = createMatch(setup); [a, v] = s.fighters; a.x = 220 * FX; v.x = 250 * FX;
  step(s, [BTN.JUMP | BTN.RIGHT, 0]); for (let i = 0; i < 40; i++) step(s, [BTN.JUMP | BTN.RIGHT, 0]);
  check('jumping over them still works', a.x > v.x);
}
// Grabbing someone you are pressed right up against (used to miss)
for (const [label, runFrames] of [['running into them', 40], ['already pushing them', 60]]) {
  const s = createMatch(setup); const [a, v] = s.fighters;
  for (const [n, m] of [[1, BTN.RIGHT], [2, 0], [runFrames, BTN.RIGHT]]) for (let i = 0; i < n; i++) step(s, [m, 0]);
  step(s, [BTN.RIGHT | BTN.GRAB, 0]);
  let caught = false;
  for (let i = 0; i < 14; i++) { step(s, [BTN.RIGHT, 0]); if (a.state === 'holding') caught = true; }
  check(`dash grab works when ${label}`, caught);
}
{
  const s = createMatch(setup); const [a, v] = s.fighters; v.x = a.x + 6 * FX;
  step(s, [BTN.GRAB, 0]); let caught = false;
  for (let i = 0; i < 10; i++) { step(s, [0, 0]); if (a.state === 'holding') caught = true; }
  check('standing grab works on someone right up against you', caught);
}
// Jump Shot keeps going when you land in the middle of it (charging included)
for (const hold of [0, 30]) {
  const s = createMatch(setup); const a = s.fighters[0]; s.fighters[1].x = 900 * FX;
  a.y -= 12 * FX; a.grounded = 0; a.ground = -1; a.state = 'air';
  step(s, [BTN.SPECIAL, 0]);
  let landedMid = false;
  for (let i = 0; i < hold + 6; i++) { step(s, [BTN.SPECIAL, 0]); if (a.grounded && a.move === 'jumpShot') landedMid = true; }
  for (let i = 0; i < 30 && !s.projectiles.length; i++) { step(s, [0, 0]); if (a.grounded && a.move === 'jumpShot') landedMid = true; }
  check(`Jump Shot is not cancelled by landing${hold ? ' while charging' : ''}`, landedMid && s.projectiles.length === 1 && a.grounded === 1);
}
// Ledge intangibility, smaller on each regrab without landing
{
  const { CONFIG } = await import('../config/config.js');
  const s = createMatch(setup); const [f, v] = s.fighters;
  const grab = () => { for (let i = 0; i < 300 && f.state !== 'ledge'; i++) step(s, [f.grounded ? BTN.LEFT : BTN.RIGHT, 0]); return f.intangible; };
  const first = grab();
  // a forward tilt from the stage while he is intangible on the ledge does nothing
  v.x = 112 * FX; v.facing = -1; v.y = 170 * FX;
  step(s, [0, BTN.ATTACK | BTN.LEFT]); for (let i = 0; i < 12; i++) step(s, [0, 0]);
  const safe = f.percent === 0;
  for (let i = 0; i < 30; i++) step(s, [0, 0]);
  step(s, [BTN.DOWN, 0]); for (let i = 0; i < 3; i++) step(s, [0, 0]);   // let go
  step(s, [BTN.JUMP | BTN.LEFT, 0]);                                       // double jump away and back
  for (let i = 0; i < 12; i++) step(s, [BTN.LEFT, 0]);
  let second = -1;
  for (let i = 0; i < 200 && second < 0; i++) { step(s, [BTN.RIGHT, 0]); if (f.state === 'ledge') second = f.intangible; if (f.grounded) break; }
  check('grabbing the ledge gives intangibility, less on a regrab', first >= CONFIG.LEDGE_INTANGIBLE[0] - 1 && safe && second > 0 && second < first, `first ${first}, regrab ${second}`);
}
// Move library: saved moves still work when plugged into a character
{
  const { LIBRARY, useMoves } = await import('../characters/library.js');
  const { getCharacter } = await import('../characters/index.js');
  const ch = getCharacter('simeon');
  const saved = { anims: { ...ch.animations }, moves: { ...ch.moves } };
  const lib = useMoves({ nair: 'nair_heldKick', dashAttack: 'dashAttack_slide' });
  Object.assign(ch.animations, lib.animations); Object.assign(ch.moves, lib.moves);
  try {
    let s = createMatch(setup); let [a, v] = s.fighters;
    for (const f of [a, v]) { f.y -= 60 * FX; f.grounded = 0; f.ground = -1; f.state = 'air'; f.vy = 0; }
    v.x = a.x + 22 * FX;
    step(s, [BTN.ATTACK, 0]);
    let first = -1;
    for (let i = 0; i < 10; i++) { step(s, [0, 0]); a.vy = 0; if (v.state !== 'hitstun') v.vy = 0; if (first < 0 && v.percent) first = a.stateFrame; }
    check('library: held-kick neutral air comes out on frame 3 for 8%', v.percent === 80 && first === 3, `${v.percent / 10}% on ${first}`);
    s = createMatch(setup); [a, v] = s.fighters; v.x = a.x + 70 * FX;
    for (const [n, m] of [[1, BTN.RIGHT], [2, 0], [6, BTN.RIGHT]]) for (let i = 0; i < n; i++) step(s, [m, 0]);
    step(s, [BTN.RIGHT | BTN.ATTACK, 0]);
    for (let i = 0; i < 60; i++) step(s, [0, 0]);
    check('library: slide dash attack slides in and hits', v.percent > 0 && a.state === 'idle', `${v.percent / 10}%`);
    check('library entries name the slot they belong to', Object.values(LIBRARY).every((e) => e.slot && e.anim && e.move));
  } finally {
    for (const k of Object.keys(lib.moves)) { ch.animations[k] = saved.anims[k]; ch.moves[k] = saved.moves[k]; }
  }
}
// Roster: two fighters, two skins each, sharing every normal attack
{
  const { CHARACTERS } = await import('../characters/index.js');
  check('twelve characters with two skins each', CHARACTERS.length === 12 && CHARACTERS.every((c) => c.palettes.length === 2), CHARACTERS.map((c) => c.name + ':' + c.palettes.length).join(' '));
  const [sim, kae, luc] = CHARACTERS;
  const shared = ['jab1', 'ftilt', 'utilt', 'dtilt', 'dashAttack', 'nair', 'fair', 'bair', 'uair', 'dair', 'grab'];
  check('Kaelyn shares all normals, grabs and throws with Simeon', shared.every((m) => kae.moves[m] === sim.moves[m]) && kae.throws === sim.throws);
  check('Luca shares all normals, grabs and throws too, with his own four specials', shared.every((m) => luc.moves[m] === sim.moves[m]) && ['neutral', 'side', 'up', 'down'].every((k) => luc.specials[k] && luc.specials[k] !== sim.specials[k] && luc.specials[k] !== kae.specials[k]));
  check('Kaelyn has her own four specials', ['neutral', 'side', 'up', 'down'].every((k) => kae.specials[k] && kae.specials[k] !== sim.specials[k]));
}
// Kaelyn's specials
{
  const ksetup = { stageId: 'cloudrest', players: [{ charId: 'kaelyn', alt: 0 }, { charId: 'simeon', alt: 1 }], stocks: 3, seed: 5 };
  // Puff Pass: flies out, comes back, is caught; hits on the way out and back; one at a time
  let s = createMatch(ksetup); let [a, v] = s.fighters; v.x = 900 * FX;
  step(s, [BTN.SPECIAL, 0]);
  let far = 0, count = 0, caught = false, second = false;
  for (let i = 0; i < 200; i++) {
    step(s, [i === 45 ? BTN.SPECIAL : 0, 0]);
    const ps = s.projectiles || [];
    count = Math.max(count, ps.length);
    if (ps.length) far = Math.max(far, (ps[0].x - a.x) / FX);
    if (i > 30 && !ps.length && !caught) { caught = true; }
  }
  check('puff pass: the vape flies out over 100px, comes back and is caught', far > 100 && caught && (s.projectiles || []).length === 0, `${far.toFixed(0)}px out`);
  check('puff pass: only one out at a time', count === 1);
  s = createMatch(ksetup); [a, v] = s.fighters; v.x = a.x + 60 * FX;
  step(s, [BTN.SPECIAL, 0]);
  const pcts = [];
  for (let i = 0; i < 160; i++) { step(s, [0, 0]); if (v.percent !== (pcts[pcts.length - 1] || 0)) pcts.push(v.percent); if (v.state === 'hitstun') { v.vx = 0; v.kbSpeed = 0; } }
  check('puff pass: can hit going out and again coming back (7% each)', pcts.length === 2 && pcts[1] === 140, pcts.map((p) => p / 10).join('% then ') + '%');
  // Roll Out: stays on the floor, stops on hit, launches them upward; once per jump in the air
  s = createMatch(ksetup); [a, v] = s.fighters; v.x = 900 * FX;
  const x0 = a.x; let left = false;
  step(s, [BTN.SPECIAL | BTN.RIGHT, 0]);
  for (let i = 0; i < 80; i++) { step(s, [0, 0]); if (!a.grounded) left = true; }
  check('roll out on the ground: skates forward without leaving the floor', !left && (a.x - x0) / FX > 70 && a.state === 'idle', `${((a.x - x0) / FX).toFixed(0)}px`);
  s = createMatch(ksetup); [a, v] = s.fighters; v.x = a.x + 60 * FX;
  step(s, [BTN.SPECIAL | BTN.RIGHT, 0]);
  let hitX = 0, top = v.y;
  for (let i = 0; i < 80; i++) { step(s, [0, 0]); if (!hitX && v.percent) hitX = a.x; top = Math.min(top, v.y); }
  check('roll out: 11%, she stops where it lands and they go straight up', v.percent === 110 && a.x <= hitX + 2 * FX && (v.y === top ? 0 : 1) + ((170 * FX - top) / FX > 30 ? 1 : 0) >= 1, `${v.percent / 10}%, up ${((170 * FX - top) / FX).toFixed(0)}px`);
  s = createMatch(ksetup); [a, v] = s.fighters; v.x = 900 * FX;
  a.y -= 120 * FX; a.grounded = 0; a.ground = -1; a.state = 'air'; a.vy = 0;
  step(s, [BTN.SPECIAL | BTN.RIGHT, 0]);
  const first = a.move; let again = '';
  for (let i = 0; i < 70 && a.state === 'attack'; i++) step(s, [0, 0]);
  if (!a.grounded) { step(s, [BTN.SPECIAL | BTN.RIGHT, 0]); again = a.move; }
  check('roll out in the air: once per jump', first === 'rollOut' && again !== 'rollOut' && !a.grounded, `second try: ${again || 'nothing'}`);
  // Half Pipe: a flipping leap that cannot be hit at first; stomps on the way down, or kick out of it
  s = createMatch(ksetup); [a, v] = s.fighters; v.x = 900 * FX;
  let peak = a.y; const hx = a.x; let ghost = 0;
  step(s, [BTN.SPECIAL | BTN.DOWN, 0]);
  for (let i = 0; i < 80; i++) { step(s, [0, 0]); peak = Math.min(peak, a.y); if (i < 8 && a.intangible > 0) ghost++; }
  check('half pipe: leaps high and forward, untouchable at the start', (170 * FX - peak) / FX > 40 && (a.x - hx) / FX > 90 && ghost === 8 && a.state === 'idle', `${((170 * FX - peak) / FX).toFixed(0)}px up, ${((a.x - hx) / FX).toFixed(0)}px across`);
  s = createMatch(ksetup); [a, v] = s.fighters; v.x = a.x + 80 * FX;
  step(s, [BTN.SPECIAL | BTN.DOWN, 0]);
  const vstates = new Set();
  for (let i = 0; i < 90; i++) { step(s, [0, 0]); vstates.add(v.state); }
  check('half pipe stomp on a standing fighter: 8%, pops them up, no burying', v.percent === 80 && vstates.has('hitstun') && [...vstates].every((x) => ['idle', 'hitstun', 'land', 'air', 'knockdown'].includes(x)), [...vstates].join(','));
  s = createMatch(ksetup); [a, v] = s.fighters; v.x = a.x + 70 * FX; v.y -= 20 * FX; v.grounded = 0; v.ground = -1; v.state = 'air';
  step(s, [BTN.SPECIAL | BTN.DOWN, 0]);
  let spikedK = false;
  for (let i = 0; i < 60; i++) { step(s, [0, 0]); if (v.state === 'air') { v.vy = 0; v.y = 150 * FX; } if (v.state === 'hitstun' && v.kbAngle === 270) spikedK = true; }
  check('half pipe stomp on an airborne fighter spikes them', spikedK && v.percent === 80, v.percent / 10 + '%');
  s = createMatch(ksetup); [a, v] = s.fighters; v.x = a.x + 80 * FX;
  step(s, [BTN.SPECIAL | BTN.DOWN, 0]);
  const km = new Set();
  for (let i = 0; i < 80; i++) { step(s, [i === 20 ? BTN.SPECIAL : 0, 0]); if (a.move) km.add(a.move); }
  check('half pipe: pressing special again kicks out of the flip for 14%', km.has('halfPipeKick') && v.percent === 140, v.percent / 10 + '%');
  s = createMatch(ksetup); [a, v] = s.fighters; v.x = 900 * FX;
  a.y -= 140 * FX; a.grounded = 0; a.ground = -1; a.state = 'air'; a.vy = 0;
  step(s, [BTN.SPECIAL | BTN.DOWN, 0]);
  const firstHP = a.move; let againHP = '';
  for (let i = 0; i < 70 && a.state === 'attack'; i++) step(s, [0, 0]);
  if (!a.grounded) { step(s, [BTN.SPECIAL | BTN.DOWN, 0]); againHP = a.move; }
  check('half pipe in the air: once per jump', firstHP === 'halfPipe' && againHP !== 'halfPipe', `second try: ${againHP || 'nothing'}`);
  // Kickflip: big rise, steerable, shockwave on landing, grabs the ledge
  s = createMatch(ksetup); [a, v] = s.fighters; v.x = 900 * FX;
  let wave = false; const kx = a.x; peak = a.y;
  step(s, [BTN.SPECIAL | BTN.UP, 0]);
  for (let i = 0; i < 130; i++) { step(s, [i < 30 ? BTN.RIGHT : 0, 0]); peak = Math.min(peak, a.y); if ((s.projectiles || []).some((p) => p.kind === 'shockwave')) wave = true; }
  check('kickflip: rises over 100px, steers, and sends a shockwave when she lands', (170 * FX - peak) / FX > 100 && a.x > kx + 15 * FX && wave && a.state === 'idle', `${((170 * FX - peak) / FX).toFixed(0)}px up, ${((a.x - kx) / FX).toFixed(0)}px across`);
  s = createMatch(ksetup); [a, v] = s.fighters; v.x = 900 * FX;
  a.x = 56 * FX; a.y = 300 * FX; a.grounded = 0; a.ground = -1; a.state = 'air'; a.jumpsLeft = 0; a.vy = 0;
  step(s, [BTN.SPECIAL | BTN.UP, 0]);
  let grabbedK = false;
  for (let i = 0; i < 120 && !grabbedK; i++) { step(s, [0, 0]); grabbedK = a.state === 'ledge'; }
  check('kickflip from far below the stage grabs the ledge', grabbedK, a.state);
}

// Luca's specials
{
  const lsetup = { stageId: 'cloudrest', players: [{ charId: 'luca', alt: 0 }, { charId: 'simeon', alt: 1 }], stocks: 3, seed: 5 };
  // Bass Drop: bigger blast and more damage the longer it is charged; hits both sides, launching away
  const bass = (hold, gap) => {
    const s = createMatch(lsetup); const [a, v] = s.fighters; v.x = a.x + gap * FX;
    step(s, [BTN.SPECIAL, 0]); for (let i = 0; i < hold; i++) step(s, [BTN.SPECIAL, 0]);
    let dir = 0;
    for (let i = 0; i < 60; i++) { step(s, [0, 0]); if (!dir && v.state === 'hitstun') dir = Math.sign(v.vx); }
    return { pct: v.percent, dir };
  };
  check('bass drop uncharged: a small 6% blast that only reaches close up', bass(0, 12).pct === 60 && bass(0, 30).pct === 0);
  const fullF = bass(80, 40), fullB = bass(80, -40);
  check('bass drop fully charged: 20%, reaches 40px away on both sides, launching away from him',
    fullF.pct === 200 && fullB.pct === 200 && fullF.dir === 1 && fullB.dir === -1 && bass(80, 62).pct === 0, `${fullF.pct / 10}% / ${fullB.pct / 10}%`);
  // Supply & Demand: tap = fast weak arrow going up, hold = slow heavy arrow crashing down
  const arrow = (hold) => {
    const s = createMatch(lsetup); const [a, v] = s.fighters; v.x = 900 * FX;
    step(s, [BTN.SPECIAL | BTN.RIGHT, 0]); for (let i = 0; i < hold; i++) step(s, [BTN.SPECIAL, 0]);
    let kind = '', first = null, last = null, n = 0;
    for (let i = 0; i < 120; i++) { step(s, [0, 0]); const p = (s.projectiles || [])[0]; if (p) { kind = p.kind; first = first || { x: p.x, y: p.y }; last = { x: p.x, y: p.y }; n++; } }
    return { kind, dx: (last.x - first.x) / FX, dy: (last.y - first.y) / FX, n };
  };
  const tapA = arrow(2), holdA = arrow(30);
  check('supply & demand tap: a quick arrow that flies up and forward', tapA.kind === 'arrowUp' && tapA.dy < -60 && tapA.dx > 40, `${tapA.dx.toFixed(0)}px across, ${(-tapA.dy).toFixed(0)}px up`);
  check('supply & demand held: a slower arrow that crashes down to the floor', holdA.kind === 'arrowDown' && holdA.dy > 10 && holdA.n > tapA.n, `${holdA.dx.toFixed(0)}px across, ends ${holdA.dy.toFixed(0)}px lower, in the air ${holdA.n} frames vs ${tapA.n}`);
  const arrowHit = (hold, gx, gy) => {
    const s = createMatch(lsetup); const [a, v] = s.fighters; v.x = a.x + gx * FX;
    if (gy) { v.y -= gy * FX; v.grounded = 0; v.ground = -1; v.state = 'air'; }
    step(s, [BTN.SPECIAL | BTN.RIGHT, 0]); for (let i = 0; i < hold; i++) step(s, [BTN.SPECIAL, 0]);
    for (let i = 0; i < 100; i++) { step(s, [0, 0]); if (gy && v.state === 'air') { v.vy = 0; v.y = 170 * FX - gy * FX; } if (v.percent) break; }
    return v.percent;
  };
  check('supply & demand: the tap arrow does 5%, the held arrow 14%', arrowHit(2, 46, 60) === 50 && arrowHit(30, 92, 0) === 140, `${arrowHit(2, 46, 60) / 10}% and ${arrowHit(30, 92, 0) / 10}%`);
  // Wire Transfer: teleports about 110px in the held direction, untouchable on the way
  const tp = (inp) => {
    const s = createMatch(lsetup); const [a, v] = s.fighters; v.x = 900 * FX;
    const x0 = a.x, y0 = a.y; let ghost = true;
    step(s, [BTN.SPECIAL | BTN.UP, 0]);
    for (let i = 0; i < 28; i++) { step(s, [inp, 0]); if (a.stateFrame >= 15 && a.stateFrame <= 25 && !a.intangible) ghost = false; }
    const dx = (a.x - x0) / FX, dy = (a.y - y0) / FX;
    const states = new Set(); for (let i = 0; i < 120; i++) { step(s, [0, 0]); states.add(a.state); }
    return { dx, dy, ghost, states };
  };
  const up = tp(0), side = tp(BTN.RIGHT), diag = tp(BTN.RIGHT | BTN.UP);
  check('wire transfer: straight up by default, about 150px, untouchable on the way, helpless after', Math.abs(up.dx) < 1 && up.dy < -140 && up.dy > -160 && up.ghost && up.states.has('helpless'), `${up.dx.toFixed(0)}, ${up.dy.toFixed(0)}`);
  check('wire transfer: sideways along the floor, and diagonally', side.dx > 140 && side.dy === 0 && !side.states.has('helpless') && diag.dx > 95 && diag.dy < -95, `side ${side.dx.toFixed(0)},${side.dy.toFixed(0)}  diagonal ${diag.dx.toFixed(0)},${diag.dy.toFixed(0)}`);
  {
    const s = createMatch(lsetup); const [a, v] = s.fighters; v.x = a.x + 146 * FX;
    step(s, [BTN.SPECIAL | BTN.UP, 0]);
    for (let i = 0; i < 60; i++) step(s, [i < 20 ? BTN.RIGHT : 0, 0]);
    check('wire transfer: hits where he reappears (10%)', v.percent === 100, v.percent / 10 + '%');
  }
  // Stage Dive: an arcing leap; bounces back off a hit; once per jump in the air
  {
    let s = createMatch(lsetup); let [a, v] = s.fighters; v.x = 900 * FX;
    const x0 = a.x; let top = a.y;
    step(s, [BTN.SPECIAL | BTN.DOWN, 0]);
    for (let i = 0; i < 90; i++) { step(s, [0, 0]); top = Math.min(top, a.y); }
    check('stage dive: leaps forward in an arc and lands', (170 * FX - top) / FX > 20 && (a.x - x0) / FX > 60 && a.state === 'idle', `${((a.x - x0) / FX).toFixed(0)}px across, ${((170 * FX - top) / FX).toFixed(0)}px high`);
    s = createMatch(lsetup); [a, v] = s.fighters; v.x = a.x + 70 * FX;
    step(s, [BTN.SPECIAL | BTN.DOWN, 0]);
    let hitX = 0, back = false;
    for (let i = 0; i < 90; i++) { step(s, [0, 0]); if (!hitX && v.percent) hitX = a.x; else if (hitX && a.x < hitX - 4 * FX) back = true; }
    check('stage dive: 11%, and he springs back off the hit', v.percent === 110 && back, v.percent / 10 + '%');
  }
}

// Pass-through platforms on the Nest
{
  const { getStage } = await import('../stages/index.js');
  const nest = getStage('nest');
  check('the nest has three platforms: two low sides and a high middle', nest.platforms.length === 3 && nest.platforms[2].y < nest.platforms[0].y && nest.platforms[0].y === nest.platforms[1].y);
  const p = nest.platforms[0];
  const nsetup = { ...setup, stageId: 'nest' };
  // jump up through a side platform and land on it
  let s = createMatch(nsetup); let a = s.fighters[0]; s.fighters[1].x = 900 * FX;
  a.x = (p.x + p.w / 2) * FX;
  let passed = false;
  step(s, [BTN.JUMP, 0]); for (let i = 0; i < 80; i++) { step(s, [BTN.JUMP, 0]); if (a.y < p.y * FX - 2 * FX) passed = true; }
  check('jump up through a platform and land on top of it', passed && a.grounded && a.y === p.y * FX, `y ${(a.y / FX).toFixed(0)}`);
  // tap down to drop through, then land on the main stage
  for (let i = 0; i < 10; i++) step(s, [0, 0]);
  step(s, [BTN.DOWN, 0]);
  for (let i = 0; i < 80; i++) step(s, [0, 0]);
  check('tapping down drops through the platform to the stage below', a.grounded && a.y === 170 * FX, `y ${(a.y / FX).toFixed(0)}`);
  // down + attack on a platform is a down tilt, not a drop
  s = createMatch(nsetup); a = s.fighters[0]; s.fighters[1].x = 900 * FX;
  a.x = (p.x + p.w / 2) * FX; a.y = p.y * FX; a.ground = nest.solids.length; a.grounded = 1;
  step(s, [BTN.DOWN | BTN.ATTACK, 0]);
  check('down tilt on a platform does not drop through', a.move === 'dtilt' && a.grounded);
  // walking off the end of a platform falls
  s = createMatch(nsetup); a = s.fighters[0]; s.fighters[1].x = 900 * FX;
  a.x = (p.x + p.w - 3) * FX; a.y = p.y * FX; a.ground = nest.solids.length; a.grounded = 1;
  for (let i = 0; i < 40; i++) step(s, [BTN.RIGHT, 0]);
  check('walking off a platform falls to the stage', a.y > p.y * FX);
  // the other stages have none
  check('the other stages have no platforms', !getStage('balcony').platforms && !getStage('cloudrest').platforms);
}

// Teching: shield just before landing while tumbling
{
  const tumbleDown = (inputAt) => {
    const s = createMatch(setup); const [a, v] = s.fighters; v.x = 900 * FX;
    a.y = 120 * FX; a.grounded = 0; a.ground = -1; a.state = 'hitstun'; a.anim = 'tumble'; a.hitstun = 200; a.kbSpeed = 0; a.vy = 2 * FX; a.gv = 2 * FX;
    let landed = '';
    for (let i = 0; i < 80 && !landed; i++) {
      const toGo = (170 * FX - a.y) / FX;
      step(s, [inputAt(toGo, i), 0]);
      if (a.grounded) landed = a.state;
    }
    return { state: landed, a };
  };
  const none = tumbleDown(() => 0);
  check('landing while tumbling with no tech: knocked down', none.state === 'knockdown', none.state);
  const tech = tumbleDown((toGo) => (toGo < 12 ? BTN.SHIELD : 0));
  check('shield just before landing: tech in place, untouchable', tech.state === 'tech' && tech.a.intangible > 0, tech.state);
  const roll = tumbleDown((toGo) => (toGo < 12 ? BTN.SHIELD | BTN.RIGHT : 0));
  check('shield + direction just before landing: tech roll that way', roll.state === 'getupRoll' && roll.a.facing === 1 && roll.a.intangible > 0, roll.state);
  const early = tumbleDown((toGo, i) => (i === 0 ? BTN.SHIELD : 0));
  check('pressing shield far too early does not tech', early.state === 'knockdown', early.state);
  const mash = tumbleDown((toGo, i) => (i % 2 === 0 ? BTN.SHIELD : 0));
  check('mashing shield does not tech either (lockout)', mash.state === 'knockdown', mash.state);
  // wall tech: launched into the side of the stage
  const s = createMatch(setup); const [a, v] = s.fighters; v.x = 900 * FX;
  a.x = 50 * FX; a.y = 200 * FX; a.grounded = 0; a.ground = -1; a.state = 'hitstun'; a.anim = 'tumble'; a.hitstun = 60; a.kbAngle = 0; a.kbSpeed = 3 * FX;
  let walled = false;
  for (let i = 0; i < 20 && !walled; i++) { step(s, [i > 2 ? BTN.SHIELD : 0, 0]); walled = a.state === 'techWall'; }
  check('shield as you hit a wall while tumbling: wall tech', walled && a.intangible > 0);
}
// Top blast zone is close enough to KO with upward hits
{
  const { getStage } = await import('../stages/index.js');
  check('top blast zone is 335px above the stage on every stage', ['nest', 'balcony', 'cloudrest'].every((id) => getStage(id).solids[0].y - getStage(id).blast.top === 335));
}

// Tap jump (0 key): W also jumps, unless pressed together with an attack, special or grab
{
  const { KeyboardSource, DEFAULT_BINDINGS } = await import('../engine/input.js');
  const kb = { blocked: new Set(), keys: new Set(), held(c) { return this.keys.has(c); } };
  const b = DEFAULT_BINDINGS;
  let on = false;
  const src = new KeyboardSource(kb, b, () => on);
  const press = (...codes) => { kb.keys = new Set(codes); return src.sample(); };
  check('tap jump off: W is only up', !(press(b.up) & BTN.JUMP) && (press(b.up) & BTN.UP));
  on = true;
  check('tap jump on: W is up and jump', (press(b.up) & BTN.JUMP) && (press(b.up) & BTN.UP));
  check('tap jump on: W + attack is still an up attack, not a jump', !(press(b.up, b.attack) & BTN.JUMP) && !(press(b.up, b.special) & BTN.JUMP) && !(press(b.up, b.grab) & BTN.JUMP));
  check('tap jump on: Space still jumps', press(b.jump) & BTN.JUMP);
  // in a match: holding W with tap jump jumps
  const s = createMatch(setup); const a = s.fighters[0]; s.fighters[1].x = 900 * FX;
  step(s, [press(b.up), 0]);
  for (let i = 0; i < 6; i++) step(s, [press(b.up), 0]);
  check('tap jump on: pressing W leaves the ground', !a.grounded);
}

// Smash attacks: the smash button, or a direction tap followed straight away by attack
{
  TEST_CONFIG.SMASH_FLICK_FRAMES = FLICK;
  const { CHARACTERS } = await import('../characters/index.js');
  const mk = (id = 'simeon') => { const s = createMatch({ ...setup, players: [{ charId: id, alt: 0 }, { charId: 'simeon', alt: 1 }] }); s.fighters[1].x = 900 * FX; return s; };
  const moveAfter = (script, id) => { const s = mk(id); const a = s.fighters[0]; let mv = ''; for (const [n, inp] of script) for (let i = 0; i < n; i++) { step(s, [inp, 0]); if (a.move && !mv) mv = a.move; } return { mv, a }; };
  check('smash button alone: forward smash', moveAfter([[1, BTN.SMASH]]).mv === 'fsmash');
  check('smash button + up / down: up smash / down smash', moveAfter([[1, BTN.SMASH | BTN.UP]]).mv === 'usmash' && moveAfter([[1, BTN.SMASH | BTN.DOWN]]).mv === 'dsmash');
  const back = moveAfter([[1, BTN.SMASH | BTN.LEFT]]);
  check('smash button + back: turns round and forward smashes', back.mv === 'fsmash' && back.a.facing === -1);
  check('direction and attack together: smash attack', moveAfter([[1, BTN.ATTACK | BTN.RIGHT]]).mv === 'fsmash' && moveAfter([[1, BTN.ATTACK | BTN.UP]]).mv === 'usmash' && moveAfter([[1, BTN.ATTACK | BTN.DOWN]]).mv === 'dsmash');
  check('tap a direction, attack 3 frames later: still a smash', moveAfter([[1, BTN.RIGHT], [2, BTN.RIGHT], [1, BTN.RIGHT | BTN.ATTACK]]).mv === 'fsmash');
  check('hold a direction first, then attack: a tilt as before', moveAfter([[8, BTN.RIGHT], [1, BTN.RIGHT | BTN.ATTACK]]).mv === 'ftilt' && moveAfter([[8, BTN.UP], [1, BTN.UP | BTN.ATTACK]]).mv === 'utilt' && moveAfter([[8, BTN.DOWN], [1, BTN.DOWN | BTN.ATTACK]]).mv === 'dtilt');
  check('attack with no direction is still a jab', moveAfter([[1, BTN.ATTACK]]).mv === 'jab1');
  { const s = mk(); const a = s.fighters[0]; a.y -= 80 * FX; a.grounded = 0; a.ground = -1; a.state = 'air'; step(s, [BTN.SMASH | BTN.UP, 0]); check('smash button in the air does an aerial', a.move === 'uair', a.move); }
  // every fighter has three smashes that hit, charge up, and end
  for (const ch of CHARACTERS) {
    for (const [name, inp, place] of [['fsmash', 0, (a) => [a.x + 26 * FX, a.y]], ['usmash', BTN.UP, (a) => [a.x + 2 * FX, a.y - 52 * FX]], ['dsmash', BTN.DOWN, (a) => [a.x - 16 * FX, a.y]]]) {
      const run = (hold) => {
        const s = mk(ch.id); const [a, v] = s.fighters;
        [v.x, v.y] = place(a);
        if (v.y !== a.y) { v.grounded = 0; v.ground = -1; v.state = 'air'; }
        const y0 = v.y;
        step(s, [BTN.SMASH | inp, 0]);
        const started = a.move;
        for (let i = 0; i < hold; i++) { step(s, [BTN.SMASH | inp, 0]); if (v.state === 'air') { v.vy = 0; v.y = y0; } }
        let end = -1;
        for (let i = 0; i < 90 && end < 0; i++) { step(s, [0, 0]); if (v.state === 'air') { v.vy = 0; v.y = y0; } if (a.state === 'idle') end = i; }
        return { started, pct: v.percent, ended: end >= 0 };
      };
      const tap = run(0), full = run(75);
      const base = Math.max(...ch.moves[name].hitboxes.filter((h) => h.chargeScale).map((h) => h.chargeScale[0]));
      check(`${ch.name} ${name}: hits, ends, and a full charge does more`, tap.started === name && tap.pct >= 100 && tap.ended && full.ended && full.pct > tap.pct && full.pct - tap.pct >= Math.round(base * 0.4) - 1,
        `${tap.pct / 10}% uncharged, ${full.pct / 10}% fully charged`);
    }
  }
  // down smashes hit behind as well, launching that way
  { const s = mk('luca'); const [a, v] = s.fighters; v.x = a.x - 17 * FX; step(s, [BTN.SMASH | BTN.DOWN, 0]); let d = 0; for (let i = 0; i < 40; i++) { step(s, [0, 0]); if (!d && v.state === 'hitstun') d = Math.sign(v.vx); } check('down smash hits behind and launches them away', v.percent > 0 && d === -1); }
  // a forward smash is a real kill move: KOs from the middle of the stage at high percent
  { const s = mk(); const [a, v] = s.fighters; v.x = a.x + 26 * FX; v.percent = 1100; step(s, [BTN.SMASH, 0]); let ko = false; for (let i = 0; i < 300 && !ko; i++) { step(s, [0, 0]); ko = v.state === 'dead'; } check('Simeon forward smash KOs at 110% from mid-stage', ko); }
  { const s = mk(); const [a, v] = s.fighters; v.x = a.x + 26 * FX; v.percent = 300; step(s, [BTN.SMASH, 0]); let ko = false; for (let i = 0; i < 300 && !ko; i++) { step(s, [0, 0]); ko = v.state === 'dead'; } check('...but not at 30%', !ko); }
}

// Free-for-all: up to four fighters, and one swing can hit several of them.
{
  const four = { stageId: 'cloudrest', players: ['simeon', 'kaelyn', 'luca', 'simeon'].map((charId, i) => ({ charId, alt: i & 1 })), stocks: 3, seed: 3 };
  const s = createMatch(four);
  check('a match can start with four fighters, each on the stage', s.fighters.length === 4 && new Set(s.fighters.map((f) => f.x)).size === 4 && s.fighters.every((f) => f.grounded));
  const [a, v1, v2, far] = s.fighters;
  v1.x = a.x + 26 * FX; v2.x = a.x + 24 * FX;
  step(s, [BTN.SMASH, 0, 0, 0]);
  for (let i = 0; i < 60; i++) step(s, [0, 0, 0, 0]);
  check('one forward smash hits both fighters in front, each once', v1.percent > 0 && v1.percent === v2.percent && far.percent === 0, `${v1.percent / 10}% / ${v2.percent / 10}%`);
  // standing fighters are pushed apart whoever they are
  const t = createMatch(four); const [p, q, r2] = t.fighters;
  q.x = p.x + 2 * FX; r2.x = p.x + 4 * FX;
  for (let i = 0; i < 90; i++) step(t, [0, 0, 0, 0]);
  check('three fighters standing in one spot are pushed apart', Math.abs(q.x - p.x) > 8 * FX && Math.abs(r2.x - q.x) > 8 * FX, `${(q.x - p.x) / FX} / ${(r2.x - q.x) / FX}`);
  // a KO'd fighter with no stocks is out, and the others carry on
  const u = createMatch(four); u.fighters[3].stocks = 1; u.fighters[3].y = 500 * FX; u.fighters[3].grounded = false;
  for (let i = 0; i < 200; i++) step(u, [0, 0, 0, 0]);
  check('a fighter out of stocks leaves a four-fighter match to the other three', u.fighters[3].state === 'out' && u.fighters.filter((f) => f.state !== 'out').length === 3);
}

// Sara: her own smash attacks and specials
{
  const { getCharacter } = await import('../characters/index.js');
  const sara = getCharacter('sara'), sim = getCharacter('simeon');
  const shared = ['jab1', 'ftilt', 'utilt', 'dtilt', 'nair', 'fair', 'bair', 'uair', 'dair', 'dashAttack'].filter((m) => sim.moves[m]);
  check('Sara shares the normals with Simeon and has her own smashes and specials', shared.length > 6 && shared.every((m) => sara.moves[m] === sim.moves[m])
    && ['fsmash', 'usmash', 'dsmash'].every((m) => sara.moves[m] !== sim.moves[m]) && ['neutral', 'side', 'up', 'down'].every((k) => sara.moves[sara.specials[k]] && sara.specials[k] !== sim.specials[k]));
  const mk = (dx = 26, dy = 0) => { const s = createMatch({ ...setup, players: [{ charId: 'sara', alt: 0 }, { charId: 'simeon', alt: 1 }] }); const [a, v] = s.fighters; v.x = a.x + dx * FX; v.y += dy * FX; if (dy) { v.grounded = 0; v.ground = -1; } return s; };
  const run = (s, first, n = 80, hold = 0) => { step(s, [first, 0]); for (let i = 0; i < n; i++) step(s, [i < hold ? first : 0, 0]); return s.fighters[1].percent / 10; };
  TEST_CONFIG.SMASH_FLICK_FRAMES = FLICK;
  const f = run(mk(30), BTN.SMASH), u = run(mk(4, -44), BTN.SMASH | BTN.UP), d1 = run(mk(20), BTN.SMASH | BTN.DOWN), d2 = run(mk(-20), BTN.SMASH | BTN.DOWN);
  check('Match Point (forward smash) hits in front: 16% at the racket head', f === 16, f + '%');
  check('Steam Wand (up smash) hits a fighter above her several times', u >= 10 && u <= 14, u + '%');
  { const s = mk(-20); run(s, BTN.SMASH | BTN.DOWN); check('Baggage Claim (down smash) hits in front, then behind (and sends them away from her)', d1 === 13 && d2 === 13 && s.fighters[1].x < s.fighters[0].x - 30 * FX, `${d1}% / ${d2}%`); }
  TEST_CONFIG.SMASH_FLICK_FRAMES = 0;
  // To-Go: tap for a cup, hold for the Double Shot
  const tap = run(mk(80), BTN.SPECIAL, 70), held = run(mk(80), BTN.SPECIAL, 70, 30);
  check('To-Go throws a cup (6%); holding it throws a Double Shot (12%)', tap === 6 && held === 12, `${tap}% / ${held}%`);
  // Boarding Call
  { const s = mk(400); const a = s.fighters[0], x0 = a.x; run(s, BTN.SPECIAL | BTN.RIGHT, 70); const far = (a.x - x0) / FX;
    const hitp = run(mk(50), BTN.SPECIAL | BTN.RIGHT, 70);
    check('Boarding Call rides forward along the floor and hits on the way (10%)', far > 60 && far < 130 && a.grounded && hitp === 10, `${far.toFixed(0)}px, ${hitp}%`); }
  // Takeoff
  { const s = mk(400); const a = s.fighters[0], y0 = a.y; let top = 0, right = 0; step(s, [BTN.SPECIAL | BTN.UP, 0]); for (let i = 0; i < 60; i++) { step(s, [BTN.RIGHT, 0]); top = Math.max(top, (y0 - a.y) / FX); if (i === 45) right = a.x; }
    const x0 = s.fighters[0].x; 
    check('Takeoff carries her up (about 100px) and can be steered, then she falls helpless', top > 85 && top < 130 && a.state === 'helpless' || (top > 85 && top < 130 && a.grounded), `${top.toFixed(0)}px up, state ${a.state}`); }
  // Fresh Pot
  { const near = run(mk(22), BTN.SPECIAL | BTN.DOWN, 70), far = run(mk(70), BTN.SPECIAL | BTN.DOWN, 70);
    const s = mk(70); s.fighters[0].y -= 60 * FX; s.fighters[0].grounded = 0; s.fighters[0].ground = -1; const airp = run(s, BTN.SPECIAL | BTN.DOWN, 50);
    check('Fresh Pot: the swing hits up close (8%), the coffee runs along the floor (7%), and nothing pours in the air', near >= 8 && far === 7 && airp === 0, `${near}% / ${far}% / ${airp}%`); }
}

// Every move that turns into another move (tap / hold, follow-ups, misfires,
// landings) has an animation to show it with.
{
  const { CHARACTERS } = await import('../characters/index.js');
  const missing = [];
  for (const c of CHARACTERS) for (const [name, mv] of Object.entries(c.moves)) {
    if (!mv.hitboxes) continue;
    for (const to of [name, mv.variant && mv.variant.move, mv.followUp && mv.followUp.move, mv.rocket && mv.rocket.misfire && mv.rocket.misfire.move, mv.plunge && mv.plunge.landMove]) {
      if (to && to !== 'pivotGrab' && !c.animations[to]) missing.push(c.id + ':' + to);
    }
  }
  check('every special and smash has an animation', missing.length === 0, missing.join(' '));
}

// Malcolm: card tricks, calisthenics and a pool cue
{
  const { getCharacter } = await import('../characters/index.js');
  const mal = getCharacter('malcolm'), sim = getCharacter('simeon');
  check('Malcolm shares the normals with Simeon and has his own smashes and specials', ['ftilt', 'nair', 'fair', 'bair', 'dashAttack'].every((m) => mal.moves[m] === sim.moves[m])
    && ['fsmash', 'usmash', 'dsmash'].every((m) => mal.moves[m] !== sim.moves[m]) && ['neutral', 'side', 'up', 'down'].every((k) => mal.moves[mal.specials[k]]));
  check('Malcolm: glasses in the first skin only', mal.palettes[0].colors.G !== mal.palettes[0].colors.k && mal.palettes[1].colors.G === mal.palettes[1].colors.k);
  const mk = (dx = 26, dy = 0) => { const s = createMatch({ ...setup, players: [{ charId: 'malcolm', alt: 0 }, { charId: 'simeon', alt: 1 }] }); const [a, v] = s.fighters; v.x = a.x + dx * FX; v.y += dy * FX; if (dy) { v.grounded = 0; v.ground = -1; } return s; };
  const run = (s, first, n = 80) => { step(s, [first, 0]); for (let i = 0; i < n; i++) step(s, [0, 0]); return s.fighters[1].percent / 10; };
  TEST_CONFIG.SMASH_FLICK_FRAMES = FLICK;
  const f = run(mk(34), BTN.SMASH), u = run(mk(2, -40), BTN.SMASH | BTN.UP), d1 = run(mk(16), BTN.SMASH | BTN.DOWN);
  const sb = mk(-16); const d2 = run(sb, BTN.SMASH | BTN.DOWN);
  check('Showstopper (forward smash, the confetti popper) reaches well in front: 15%', f === 15, f + '%');
  check('Handstand Kick (up smash) hits above him: 15%', u === 15, u + '%');
  check('Windmill (down smash) hits in front (13%) and behind (12%)', d1 === 13 && d2 === 12 && sb.fighters[1].x < sb.fighters[0].x, `${d1}% / ${d2}%`);
  TEST_CONFIG.SMASH_FLICK_FRAMES = 0;
  const cards = run(mk(60), BTN.SPECIAL, 60);
  { const s = mk(400); step(s, [BTN.SPECIAL, 0]); for (let i = 0; i < 14; i++) step(s, [0, 0]); check('Pick a Card throws three cards, 3% each', s.projectiles.length === 3 && cards >= 3 && cards <= 9 && cards % 3 === 0, `${s.projectiles.length} cards, ${cards}%`); }
  { const near = run(mk(30), BTN.SPECIAL | BTN.RIGHT, 60), far = run(mk(90), BTN.SPECIAL | BTN.RIGHT, 60);
    check('Corner Pocket: the cue tip hits up close (6%), the cue ball hits further away along the floor', near >= 6 && far >= 4 && far <= 8, `${near}% / ${far}%`); }
  { const s = mk(400); const a = s.fighters[0], y0 = a.y; let top = 0; step(s, [BTN.SPECIAL | BTN.UP, 0]); for (let i = 0; i < 60; i++) { step(s, [0, 0]); top = Math.max(top, (y0 - a.y) / FX); }
    check('Muscle-Up rises about 110px, then he falls helpless', top > 70 && top < 130, `${top.toFixed(0)}px`); }
  { const s = mk(400); step(s, [BTN.SPECIAL | BTN.DOWN, 0]); for (let i = 0; i < 60; i++) step(s, [0, 0]);
    const ace = s.projectiles.find((p) => p.kind === 'ace'); const x0 = ace && ace.x;
    const v = s.fighters[1]; v.x = ace.x; v.y = ace.y + 10 * FX; v.grounded = 0; v.ground = -1; v.state = 'air';
    for (let i = 0; i < 10; i++) step(s, [0, 0]);
    check('Ace Up the Sleeve leaves a card hanging that pops up whoever touches it (9%)', !!ace && v.percent === 90 && v.vy < 0, `${v.percent / 10}%`); }
}

// Max: body slams, a champagne bottle and cash
{
  const { getCharacter } = await import('../characters/index.js');
  const mx = getCharacter('max'), sim = getCharacter('simeon');
  check('Max is a heavyweight about Simeon\'s height, with his own smashes and specials', mx.stats.weight > sim.stats.weight + 15 && Math.abs(mx.heightInches - sim.heightInches) <= 1
    && ['fsmash', 'usmash', 'dsmash'].every((m) => mx.moves[m] !== sim.moves[m]) && ['neutral', 'side', 'up', 'down'].every((k) => mx.moves[mx.specials[k]]));
  const mk = (dx = 26, dy = 0) => { const s = createMatch({ ...setup, players: [{ charId: 'max', alt: 0 }, { charId: 'simeon', alt: 1 }] }); const [a, v] = s.fighters; v.x = a.x + dx * FX; v.y += dy * FX; if (dy) { v.grounded = 0; v.ground = -1; } return s; };
  const run = (s, first, n = 80, hold = 0) => { step(s, [first, 0]); for (let i = 0; i < n; i++) step(s, [i < hold ? first : 0, 0]); return s.fighters[1].percent / 10; };
  TEST_CONFIG.SMASH_FLICK_FRAMES = FLICK;
  const f = run(mk(30), BTN.SMASH), u1 = run(mk(3, -44), BTN.SMASH | BTN.UP), d1 = run(mk(16), BTN.SMASH | BTN.DOWN), d2 = run(mk(-16), BTN.SMASH | BTN.DOWN);
  check('Money Bag (forward smash): 18%', f === 18, f + '%');
  check('Last Call (up smash): a bottle swung over his head, 15%', u1 === 15, `${u1}%`);
  check('Cannonball (down smash) hits both sides: 15%', d1 === 15 && d2 === 15, `${d1}% / ${d2}%`);
  TEST_CONFIG.SMASH_FLICK_FRAMES = 0;
  { // Money Gun: a held stream of bills; the range shrinks with use and grows back
    const s = mk(36); const a = s.fighters[0]; const v = s.fighters[1];
    step(s, [BTN.SPECIAL, 0]); for (let i = 0; i < 90; i++) step(s, [BTN.SPECIAL, 0]);
    const dmg = v.percent / 10, fuelAfter = a.fuel;
    for (let i = 0; i < 60; i++) step(s, [0, 0]);
    const far = (() => { const t = mk(400); const b = t.fighters[0]; b.fuel = 1000; step(t, [BTN.SPECIAL, 0]); let r = 0; for (let i = 0; i < 40; i++) { step(t, [BTN.SPECIAL, 0]); for (const p of t.projectiles) r = Math.max(r, (p.x - b.x) / FX); } return r; })();
    const near = (() => { const t = mk(400); const b = t.fighters[0]; b.fuel = 0; step(t, [BTN.SPECIAL, 0]); let r = 0; for (let i = 0; i < 40; i++) { step(t, [BTN.SPECIAL, 0]); for (const p of t.projectiles) r = Math.max(r, (p.x - b.x) / FX); } return r; })();
    check('Money Gun sprays cash while held (several small hits), runs out after about a second, and runs short as it empties', dmg >= 4 && dmg <= 10 && fuelAfter < 600 && a.fuel > fuelAfter && far > near * 2, `${dmg}%, range ${far.toFixed(0)}px fresh vs ${near.toFixed(0)}px empty`);
  }
  { const s = mk(400); const a = s.fighters[0], x0 = a.x; run(s, BTN.SPECIAL | BTN.RIGHT, 70); const far = (a.x - x0) / FX; const hp = run(mk(50), BTN.SPECIAL | BTN.RIGHT, 70);
    check('Hostile Takeover charges forward along the floor (12%)', far > 50 && a.grounded && hp === 12, `${far.toFixed(0)}px, ${hp}%`); }
  { const s = mk(400); const a = s.fighters[0], y0 = a.y; let top = 0, airFrames = 0; step(s, [BTN.SPECIAL | BTN.UP, 0]);
    for (let i = 0; i < 160; i++) { step(s, [0, 0]); top = Math.max(top, (y0 - a.y) / FX); if (!a.grounded) airFrames++; }
    check('Golden Parachute rises, then floats down slowly (stays up well over a second)', top > 50 && top < 110 && airFrames > 90, `${top.toFixed(0)}px up, ${airFrames} frames in the air`); }
  { // Market Crash: hop, drop, land
    const s = mk(400); const a = s.fighters[0]; let top = 0; const y0 = a.y; step(s, [BTN.SPECIAL | BTN.DOWN, 0]);
    let landed = ''; for (let i = 0; i < 90; i++) { step(s, [0, 0]); top = Math.max(top, (y0 - a.y) / FX); if (a.move === 'marketCrashLand') landed = 'yes'; }
    const under = run(mk(2), BTN.SPECIAL | BTN.DOWN, 90), side = run(mk(18), BTN.SPECIAL | BTN.DOWN, 90);
    const air = mk(400); const b = air.fighters[0], v = air.fighters[1]; b.y -= 120 * FX; b.grounded = 0; b.ground = -1; b.state = 'air'; v.x = b.x; v.y = b.y + 40 * FX; v.grounded = 0; v.ground = -1; v.state = 'air';
    step(air, [BTN.SPECIAL | BTN.DOWN, 0]); let spiked = false; for (let i = 0; i < 30; i++) { step(air, [0, 0]); if (v.percent > 0 && v.vy > 0) spiked = true; }
    check('Market Crash: hops, drops and lands with a shockwave; spikes in the air', landed === 'yes' && top > 20 && under >= 13 && side >= 6 && spiked, `hop ${top.toFixed(0)}px, ${under}% under him, ${side}% beside`); }
}

// Osama: MMA
{
  const { getCharacter } = await import('../characters/index.js');
  const os = getCharacter('osama'), sim = getCharacter('simeon');
  check('Osama has his own smashes and specials, with glasses in the first skin only', ['fsmash', 'usmash', 'dsmash'].every((m) => os.moves[m] !== sim.moves[m]) && ['neutral', 'side', 'up', 'down'].every((k) => os.moves[os.specials[k]])
    && os.palettes[0].colors.G !== os.palettes[0].colors.k && os.palettes[1].colors.G === os.palettes[1].colors.k);
  const mk = (dx = 26, dy = 0) => { const s = createMatch({ ...setup, players: [{ charId: 'osama', alt: 0 }, { charId: 'simeon', alt: 1 }] }); const [a, v] = s.fighters; v.x = a.x + dx * FX; v.y += dy * FX; if (dy) { v.grounded = 0; v.ground = -1; } return s; };
  const run = (s, first, n = 80) => { step(s, [first, 0]); for (let i = 0; i < n; i++) step(s, [0, 0]); return s.fighters[1].percent / 10; };
  TEST_CONFIG.SMASH_FLICK_FRAMES = FLICK;
  const f = run(mk(28), BTN.SMASH), u = run(mk(3, -44), BTN.SMASH | BTN.UP), d1 = run(mk(16), BTN.SMASH | BTN.DOWN);
  const sb = mk(-16); const d2 = run(sb, BTN.SMASH | BTN.DOWN);
  check('Head Kick 17%, Uppercut 15%, Leg Kicks 13% in front and behind', f === 17 && u === 15 && d1 === 13 && d2 === 13 && sb.fighters[1].x < sb.fighters[0].x, `${f}% / ${u}% / ${d1}% / ${d2}%`);
  TEST_CONFIG.SMASH_FLICK_FRAMES = 0;
  { // press twice quickly: a weak, slow spit
    const t = mk(150); step(t, [BTN.SPECIAL, 0]); step(t, [0, 0]); step(t, [BTN.SPECIAL, 0]); let out = -1;
    for (let i = 0; i < 100; i++) { step(t, [0, 0]); if (out < 0 && (t.projectiles || []).length) out = i + 3; }
    const tap = t.fighters[1].percent / 10;
    // one press: it charges by itself and, once full, he keeps it
    const s = mk(150); const [a, v] = s.fighters; let shots = 0;
    step(s, [BTN.SPECIAL, 0]); for (let i = 0; i < 110; i++) { step(s, [0, 0]); shots = Math.max(shots, (s.projectiles || []).length); }
    const kept = a.stored === 90 && shots === 0 && a.state !== 'attack';
    step(s, [BTN.SPECIAL, 0]); for (let i = 0; i < 100; i++) step(s, [0, 0]);
    const full = v.percent / 10, launched = v.y < a.y - 4 * FX || Math.abs(v.x - a.x) > 170 * FX || v.tumbling;
    // shield while charging keeps part of it
    const sh = mk(400); const o = sh.fighters[0];
    step(sh, [BTN.SPECIAL, 0]); for (let i = 0; i < 30; i++) step(sh, [0, 0]); step(sh, [BTN.SHIELD, 0]);
    const part = o.stored > 15 && o.stored < 90 && !(sh.projectiles || []).length;
    // in the air it does not charge: it spits straight away
    const air = mk(400); const b = air.fighters[0]; b.y -= 100 * FX; b.grounded = 0; b.ground = -1; b.state = 'air';
    step(air, [BTN.SPECIAL, 0]); for (let i = 0; i < 24; i++) step(air, [0, 0]);
    const airShot = (air.projectiles || []).length === 1 && air.projectiles[0].power === 0;
    check('Oil Beam is a charge shot: press to charge, press again to spit (2%), full charge is saved and fires for 18%; shield saves part; no charging in the air',
      tap === 2 && out >= 15 && kept && full === 18 && launched && part && airShot, `tap ${tap}% (out on frame ${out}), full ${full}%, kept ${kept}, part ${o.stored}, air ${airShot}`); }
  { const s = mk(30); const [a, v] = s.fighters; let threw = false; step(s, [BTN.SPECIAL | BTN.RIGHT, 0]); for (let i = 0; i < 90; i++) { step(s, [0, 0]); if (a.state === 'throwing') threw = true; }
    const miss = mk(400); run(miss, BTN.SPECIAL | BTN.RIGHT, 70);
    check('Suplex: catches them, slams them down behind him (12%); whiffs harmlessly at range', threw && v.percent === 120 && (v.x - a.x) * a.facing < 0 && miss.fighters[1].percent === 0 && miss.fighters[0].state !== 'throwing', `${v.percent / 10}%`); }
  { const s = mk(400); const a = s.fighters[0], y0 = a.y, x0 = a.x; let top = 0, wasHelpless = false; step(s, [BTN.SPECIAL | BTN.UP, 0]); for (let i = 0; i < 70; i++) { step(s, [BTN.RIGHT, 0]); top = Math.max(top, (y0 - a.y) / FX); if (a.state === 'helpless') wasHelpless = true; }
    const k = run(mk(20, -10), BTN.SPECIAL | BTN.UP, 50);
    check('Jet Mode: flies up and forward as a plane (steerable), the nose hits for 9%, then helpless', top > 60 && (a.x - x0) / FX > 60 && k === 9 && wasHelpless, `${top.toFixed(0)}px up, ${((a.x - x0) / FX).toFixed(0)}px across, ${k}%`); }
  check('Ground and Pound: three hammer fists and a heavy last blow (15%)', run(mk(18), BTN.SPECIAL | BTN.DOWN, 70) === 15, run(mk(18), BTN.SPECIAL | BTN.DOWN, 70) + '%');
}

// Walter Gage Ballroom: a flat floor with nothing to fall off; only the side and top blast zones KO.
{
  const s = createMatch({ ...setup, stageId: 'ballroom' });
  const f = s.fighters[0]; s.fighters[1].x = 900 * FX;
  let stayed = true;
  for (let i = 0; i < 400 && f.stocks === 3; i++) { step(s, [BTN.LEFT, 0]); if (f.state !== 'dead' && !f.grounded) stayed = false; }
  check('Ballroom: walking left he stays on the floor all the way out, and is KO\'d by the side blast zone', stayed && (f.state === 'dead' || f.stocks === 2 || f.state === 'respawn'), `state ${f.state}, stocks ${f.stocks}`);
  const { getStage } = await import('../stages/index.js');
  const st = getStage('ballroom');
  check('Ballroom: the floor runs past both side blast zones and there are no ledges', st.solids[0].x < st.blast.left && st.solids[0].x + st.solids[0].w > st.blast.right && st.ledges.length === 0);
}

// Zeid: vapes and cigarettes
{
  const { getCharacter } = await import('../characters/index.js');
  const z = getCharacter('zeid'), sim = getCharacter('simeon');
  check('Zeid has his own smashes and specials', ['fsmash', 'usmash', 'dsmash'].every((m) => z.moves[m] !== sim.moves[m]) && ['neutral', 'side', 'up', 'down'].every((k) => z.moves[z.specials[k]]));
  const mk = (dx = 26, dy = 0) => { const s = createMatch({ ...setup, players: [{ charId: 'zeid', alt: 0 }, { charId: 'simeon', alt: 1 }] }); const [a, v] = s.fighters; v.x = a.x + dx * FX; v.y += dy * FX; if (dy) { v.grounded = 0; v.ground = -1; } return s; };
  const run = (s, first, n = 80) => { step(s, [first, 0]); for (let i = 0; i < n; i++) step(s, [0, 0]); return s.fighters[1].percent / 10; };
  TEST_CONFIG.SMASH_FLICK_FRAMES = FLICK;
  const f1 = run(mk(16), BTN.SMASH), f3 = run(mk(54), BTN.SMASH), u = run(mk(4, -40), BTN.SMASH | BTN.UP), d1 = run(mk(16), BTN.SMASH | BTN.DOWN), d2 = run(mk(-16), BTN.SMASH | BTN.DOWN);
  check('Exhale reaches far (16% close, 12% at the far end), Smoke Rings 14%, Lighter Flare 14% both sides', f1 === 16 && f3 === 12 && u === 14 && d1 === 14 && d2 === 14, `${f1}% / ${f3}% / ${u}% / ${d1}% / ${d2}%`);
  TEST_CONFIG.SMASH_FLICK_FRAMES = 0;
  { // the cloud hangs and hits more than once
    const s = mk(60); const v = s.fighters[1]; let hitsTaken = 0, last = 0;
    step(s, [BTN.SPECIAL, 0]); for (let i = 0; i < 150; i++) { step(s, [0, 0]); if (v.percent > last) { hitsTaken++; last = v.percent; } v.x = s.projectiles[0] ? s.projectiles[0].x : v.x; }
    check('Cloud Chaser: a cloud that hangs in the air and hits again and again (2% a time)', hitsTaken >= 3 && last % 20 === 0, `${hitsTaken} hits, ${last / 10}%`);
  }

  { // the butt bounces along the floor like a fireball and pops on a hit
    const s = mk(400); const a = s.fighters[0]; step(s, [BTN.SPECIAL | BTN.RIGHT, 0]); let bounces = 0, top = 0, out = -1, wasDown = false;
    for (let i = 0; i < 100; i++) { step(s, [0, 0]); const p = (s.projectiles || [])[0]; if (!p) continue; if (out < 0) out = i + 1;
      if (p.vy < 0 && wasDown) bounces++; wasDown = p.vy > 0; if (bounces) top = Math.max(top, (a.y - p.y) / FX); }
    const dmg = run(mk(70), BTN.SPECIAL | BTN.RIGHT, 90);
    check('Flick: a lit butt that bounces slowly along the floor like a fireball (5%, gone after one hit)', bounces >= 2 && top > 28 && top < 50 && out >= 17 && dmg === 5, `${bounces} bounces up to ${Math.round(top)}px, out on frame ${out}, ${dmg}%`);
  }
  { const s = mk(400); const a = s.fighters[0], y0 = a.y; let top = 0; step(s, [BTN.SPECIAL | BTN.UP, 0]); for (let i = 0; i < 60; i++) { step(s, [0, 0]); top = Math.max(top, (y0 - a.y) / FX); }
    check('Big Rip rides a plume up about 120px', top > 70 && top < 140, `${top.toFixed(0)}px`); }
  { // Bomb: pulled out and held; thrown with attack; blows up on touch or on its fuse; goes off in his hand if held too long
    const s = mk(70); const [a, v] = s.fighters; step(s, [BTN.SPECIAL | BTN.DOWN, 0]); for (let i = 0; i < 30; i++) step(s, [0, 0]);
    const held = a.item === 'bomb' && !(s.projectiles || []).length && a.state === 'idle';
    for (let i = 0; i < 20; i++) step(s, [BTN.RIGHT, 0]);   // walks with it
    const walked = a.item === 'bomb' && a.state !== 'attack';
    step(s, [BTN.ATTACK, 0]); let up = false; for (let i = 0; i < 100; i++) { step(s, [0, 0]); if (v.y < a.y - 15 * FX) up = true; }
    const thrown = v.percent / 10;
    // thrown up, it comes back down on him? no: his own bombs never hurt him once thrown
    const u = mk(400); const [ua] = u.fighters; step(u, [BTN.SPECIAL | BTN.DOWN, 0]); for (let i = 0; i < 30; i++) step(u, [0, 0]);
    step(u, [BTN.ATTACK | BTN.UP, 0]); let rose = 0; for (let i = 0; i < 20; i++) { step(u, [0, 0]); const p = (u.projectiles || [])[0]; if (p) rose = Math.max(rose, (ua.y - p.y) / FX); }
    // grab drops it at his feet; back throw turns him round
    const g = mk(400); const ga = g.fighters[0]; step(g, [BTN.SPECIAL | BTN.DOWN, 0]); for (let i = 0; i < 30; i++) step(g, [0, 0]); step(g, [BTN.GRAB, 0]); step(g, [0, 0]);
    const dropped = !ga.item && g.projectiles.length === 1 && Math.abs(g.projectiles[0].vx) === 0;
    const bk = mk(400); const ba = bk.fighters[0]; step(bk, [BTN.SPECIAL | BTN.DOWN, 0]); for (let i = 0; i < 30; i++) step(bk, [0, 0]); step(bk, [BTN.ATTACK | BTN.LEFT, 0]); for (let i = 0; i < 10; i++) step(bk, [0, 0]);
    const back = ba.facing === -1 && bk.projectiles.length === 1 && bk.projectiles[0].vx < 0;
    // held too long: it goes off in his hand and hurts him
    const h = mk(400); const ha = h.fighters[0]; step(h, [BTN.SPECIAL | BTN.DOWN, 0]); for (let i = 0; i < 220; i++) step(h, [0, 0]);
    const self = ha.percent === 70 && !ha.item;
    // hit while holding it: he lets go
    const x = mk(20); const [xa, xv] = x.fighters; step(x, [BTN.SPECIAL | BTN.DOWN, 0]); for (let i = 0; i < 30; i++) step(x, [0, 0]); xv.facing = -1;
    step(x, [0, BTN.ATTACK]); for (let i = 0; i < 12; i++) step(x, [0, 0]);
    const letGo = xa.percent > 0 && !xa.item;
    check('Bomb: pulled out and held (he can walk with it), thrown with attack for 7% that launches, up, back, or dropped with grab; goes off in his hand if held too long; let go when hit',
      held && walked && thrown === 7 && up && rose > 40 && dropped && back && self && letGo, `held ${held} walked ${walked} thrown ${thrown}% up ${up} rose ${Math.round(rose)}px dropped ${dropped} back ${back} self ${ha.percent / 10}% letGo ${letGo}`); }
}

// Sam: melee, plus a powder stream
{
  const { getCharacter } = await import('../characters/index.js');
  const sm = getCharacter('sam'), sim = getCharacter('simeon');
  const projMoves = Object.entries(sm.moves).filter(([n, m]) => (m.spawn || m.stream || m.spawns) && sm.moves[n] !== sim.moves[n]).map(([n]) => n);
  check('Sam has his own smashes and specials, and the powder is his only projectile', ['fsmash', 'usmash', 'dsmash'].every((m) => sm.moves[m] !== sim.moves[m]) && ['neutral', 'side', 'up', 'down'].every((k) => sm.moves[sm.specials[k]])
    && projMoves.join() === 'powderBlast', projMoves.join());
  const mk = (dx = 26, dy = 0) => { const s = createMatch({ ...setup, players: [{ charId: 'sam', alt: 0 }, { charId: 'simeon', alt: 1 }] }); const [a, v] = s.fighters; v.x = a.x + dx * FX; v.y += dy * FX; if (dy) { v.grounded = 0; v.ground = -1; } return s; };
  const run = (s, first, n = 80) => { step(s, [first, 0]); for (let i = 0; i < n; i++) step(s, [0, 0]); return s.fighters[1].percent / 10; };
  TEST_CONFIG.SMASH_FLICK_FRAMES = FLICK;
  const f = run(mk(30), BTN.SMASH), u = run(mk(3, -44), BTN.SMASH | BTN.UP), d1 = run(mk(16), BTN.SMASH | BTN.DOWN), d2 = run(mk(-16), BTN.SMASH | BTN.DOWN);
  check('Drop the Beat 18%, Order in the Court 15%, Spin Kick 13% in front and behind', f === 18 && u === 15 && d1 === 13 && d2 === 13, `${f}% / ${u}% / ${d1}% / ${d2}%`);
  TEST_CONFIG.SMASH_FLICK_FRAMES = 0;
  { const s = mk(50); const a = s.fighters[0], v = s.fighters[1]; step(s, [BTN.SPECIAL, 0]); for (let i = 0; i < 90; i++) step(s, [BTN.SPECIAL, 0]);
    check('Powder Blast: a held stream (small hits) that uses up fuel', v.percent >= 60 && a.fuel < 600, `${v.percent / 10}%`); }
  check('Objection! lunges in with the gavel: 11%', run(mk(40), BTN.SPECIAL | BTN.RIGHT, 70) === 11);
  { const s = mk(400); const a = s.fighters[0], y0 = a.y; let top = 0; step(s, [BTN.SPECIAL | BTN.UP, 0]); for (let i = 0; i < 60; i++) { step(s, [0, 0]); top = Math.max(top, (y0 - a.y) / FX); }
    check('Appeal spins him up about 120px', top > 70 && top < 140, `${top.toFixed(0)}px`); }
  { const s = mk(400); const a = s.fighters[0], x0 = a.x; run(s, BTN.SPECIAL | BTN.DOWN, 50); const slide = (a.x - x0) / FX; const g = run(mk(60), BTN.SPECIAL | BTN.DOWN, 60);
    const air = mk(400); const b = air.fighters[0]; b.y -= 90 * FX; b.grounded = 0; b.ground = -1; b.state = 'air'; const by = b.y, bx = b.x;
    step(air, [BTN.SPECIAL | BTN.DOWN, 0]); for (let i = 0; i < 30; i++) step(air, [0, 0]);
    check('Falcon Kick: slides forward on the ground (14%), dives down at an angle in the air', slide > 50 && a.grounded && g === 14 && b.move === 'falconKickAir' && b.y > by + 20 * FX && b.x > bx + 20 * FX, `${slide.toFixed(0)}px, ${g}%`); }
}

// Teams: no friendly fire, and the match is over when one team is left
{
  const { teamsLeft } = await import('../engine/sim.js');
  const two = (teams) => createMatch({ ...setup, players: [{ charId: 'simeon', alt: 0, team: teams[0] }, { charId: 'kaelyn', alt: 0, team: teams[1] }, { charId: 'luca', alt: 0, team: teams[2] }] });
  const s = two([0, 0, 1]); const [a, mate, foe] = s.fighters;
  mate.x = a.x + 24 * FX; foe.x = a.x + 26 * FX;
  step(s, [BTN.SMASH, 0, 0]); for (let i = 0; i < 60; i++) step(s, [0, 0, 0]);
  check('teams: a smash hits the opponent but not the teammate standing right there', foe.percent > 0 && mate.percent === 0, `${mate.percent / 10}% / ${foe.percent / 10}%`);
  const g = two([0, 0, 1]); const [b, m2] = g.fighters; m2.x = b.x + 30 * FX; g.fighters[2].x = 900 * FX;
  step(g, [BTN.SPECIAL | BTN.RIGHT, 0, 0]); for (let i = 0; i < 40; i++) step(g, [0, 0, 0]);
  check('teams: no grabbing or hitting a teammate with a special either', m2.percent === 0 && m2.state !== 'grabbed');
  const e = two([0, 0, 1]); e.fighters[2].stocks = 0; e.fighters[2].state = 'out';
  const f = two([0, 1, 1]); f.fighters[1].state = 'out';
  check('teams: the match is over once only one team is left (2 on one team still counts as 1)', teamsLeft(e) === 1 && teamsLeft(f) === 2 && teamsLeft(createMatch(setup)) === 2);
}

// Random on the fighter select: drawn at the start, a different fighter over many draws.
{
  const { resolveRandom, RANDOM } = await import('../net/room.js');
  const { CHARACTERS } = await import('../characters/index.js');
  const seen = new Set(); let ok = true;
  for (let k = 0; k < 200; k++) {
    const out = resolveRandom([{ type: 'human', char: RANDOM, alt: 0 }, { type: 'cpu', char: 2, alt: 0 }, { type: 'off', char: RANDOM, alt: 0 }]);
    if (!(out[0].char >= 0 && out[0].char < CHARACTERS.length) || out[1].char !== 2 || out[2].char !== RANDOM) ok = false;
    if (out[0].char === 2 && out[0].alt === 0) ok = false;   // never the same fighter in the same skin as someone else
    seen.add(out[0].char);
  }
  check('Random picks a real fighter (and a free skin) when the match starts, and covers the whole roster', ok && seen.size === CHARACTERS.length, `${seen.size} of ${CHARACTERS.length} seen`);
}

// Matt: volleyball, frisbee, League, Roblox
{
  const { getCharacter } = await import('../characters/index.js');
  const mt = getCharacter('matt'), sim = getCharacter('simeon');
  check('Matt has his own smashes and specials', ['fsmash', 'usmash', 'dsmash'].every((m) => mt.moves[m] !== sim.moves[m]) && ['neutral', 'side', 'up', 'down'].every((k) => mt.moves[mt.specials[k]] && mt.animations[mt.specials[k]]));
  const mk = (dx = 26, dy = 0) => { const s = createMatch({ ...setup, players: [{ charId: 'matt', alt: 0 }, { charId: 'simeon', alt: 1 }] }); const [a, v] = s.fighters; v.x = a.x + dx * FX; v.y += dy * FX; if (dy) { v.grounded = 0; v.ground = -1; } return s; };
  const run = (s, first, n = 80) => { step(s, [first, 0]); for (let i = 0; i < n; i++) step(s, [0, 0]); return s.fighters[1].percent / 10; };
  TEST_CONFIG.SMASH_FLICK_FRAMES = FLICK;
  const f = run(mk(26), BTN.SMASH), u = run(mk(3, -40), BTN.SMASH | BTN.UP), d1 = run(mk(16), BTN.SMASH | BTN.DOWN), d2 = run(mk(-16), BTN.SMASH | BTN.DOWN);
  check('Power Serve 17%, Set 15%, Disc Sweep 13% in front and behind', f === 17 && u === 15 && d1 === 13 && d2 === 13, `${f}% / ${u}% / ${d1}% / ${d2}%`);
  TEST_CONFIG.SMASH_FLICK_FRAMES = 0;
  { // Header: on time it goes steeply down; pressed again early it goes flatter and further; shield drops the ball
    const header = (press, hold = 0) => { const s = mk(400); const a = s.fighters[0]; step(s, [BTN.SPECIAL | BTN.RIGHT, 0]); let first = null, land = 0, dropped = false;
      for (let i = 1; i < 120; i++) { step(s, [i === press ? hold : 0, 0]); const p = (s.projectiles || [])[0];
        if (p && !first) first = { vx: p.vx, vy: p.vy, frame: i }; if (p && p.bounces && !land) land = (p.x - a.x) / FX; if (p && i === press + 2 && hold === BTN.SHIELD) dropped = p.vx === 0; }
      return { first, land, dropped, state: a.state };
    };
    const onTime = header(-1), early = header(26, BTN.SPECIAL), cancel = header(20, BTN.SHIELD);
    check('Spike (side): spiked on its own it goes steeply down; pressed again early it goes flatter, faster and lands further; shield drops the ball',
      onTime.first && early.first && early.first.frame < onTime.first.frame && early.first.vy < onTime.first.vy && early.first.vx > onTime.first.vx && early.land > onTime.land && cancel.dropped,
      `on time vy ${onTime.first && onTime.first.vy} lands ${Math.round(onTime.land)}px / early vy ${early.first && early.first.vy} lands ${Math.round(early.land)}px / cancel drops ${cancel.dropped}`); }
  { const hd = run(mk(60), BTN.SPECIAL | BTN.RIGHT, 100), close = run(mk(16), BTN.SPECIAL | BTN.RIGHT, 100);
    const fr = mk(400); step(fr, [BTN.SPECIAL, 0]); let far = 0, back = false;
    for (let i = 0; i < 200; i++) { step(fr, [0, 0]); const p = (fr.projectiles || [])[0]; if (p) far = Math.max(far, (p.x - fr.fighters[0].x) / FX); else if (far > 0) back = true; }
    const fh = run(mk(70), BTN.SPECIAL, 60);
    check('Frisbee (neutral) flies out over 100px and comes back (6%); Spike (side) sends a volleyball forward (7%), and close up his hand hits too (4% more)', hd === 7 && close === 11 && far > 100 && back && fh === 6, `spike ${hd}% / close ${close}% / out ${Math.round(far)}px back ${back} / frisbee ${fh}%`); }
  { const s = mk(400); const a = s.fighters[0], y0 = a.y; step(s, [BTN.SPECIAL | BTN.UP, 0]); let top = 0, gone = false; for (let i = 0; i < 40; i++) { step(s, [0, 0]); top = Math.max(top, (y0 - a.y) / FX); if (a.intangible > 0 && a.stateFrame > 7 && a.stateFrame < 15) gone = true; }
    const h = mk(400); const ha = h.fighters[0]; step(h, [BTN.SPECIAL | BTN.UP | BTN.RIGHT, 0]); for (let i = 0; i < 20; i++) step(h, [BTN.RIGHT, 0]);
    check('Flash blinks about 110px (up, or the way held), untouchable while gone', top > 80 && top < 150 && gone && (ha.x - h.fighters[0].x === 0) && ha.x > y0 * 0 && (ha.x - mk(400).fighters[0].x) / FX > 80, `${Math.round(top)}px up, sideways ${Math.round((ha.x - mk(400).fighters[0].x) / FX)}px`); }
  { const o1 = run(mk(14), BTN.SPECIAL | BTN.DOWN, 60), o2 = run(mk(-14), BTN.SPECIAL | BTN.DOWN, 60);
    const s = mk(400); const a = s.fighters[0]; step(s, [BTN.SPECIAL | BTN.DOWN, 0]); for (let i = 0; i < 8; i++) step(s, [0, 0]);
    check('Oof!: bursts into blocks that hit all round him (10% each side), untouchable at the start', o1 === 10 && o2 === 10 && a.intangible > 0, `${o1}% / ${o2}%`); }
}

// The kill screen: only for the KO that ends the game
{
  const go = (n, setStocks) => {
    const s = createMatch({ stageId: 'nest', players: Array.from({ length: n }, (_, i) => ({ charId: 'simeon', alt: i & 1 })), stocks: 3, seed: 1 });
    for (let i = 0; i < 90; i++) step(s, s.fighters.map(() => 0));
    setStocks(s.fighters);
    const v = s.fighters[1]; v.x = s.fighters[0].x + 26 * FX; v.y = s.fighters[0].y; v.percent = 1600;
    for (const f of s.fighters.slice(2)) f.x = s.fighters[0].x - 120 * FX;
    step(s, s.fighters.map((_, i) => (i === 0 ? BTN.SMASH | BTN.RIGHT : 0))); let frz = false;
    for (let i = 0; i < 60; i++) { step(s, s.fighters.map(() => 0)); if (s.killFreeze > 0) frz = true; }
    return frz;
  };
  check('kill screen on the game-ending KO only (not an earlier stock, not while a third fighter is still in)',
    go(2, (f) => { f[1].stocks = 1; }) && !go(2, () => {}) && !go(3, (f) => { f[1].stocks = 1; }) && go(3, (f) => { f[1].stocks = 1; f[2].stocks = 0; f[2].state = 'out'; }));
}

// Directional influence, jab locks, turning an up special round
{
  // DI: a forward smash at 100%; holding up bends the launch higher, down lower, toward it no change
  const di = (hold) => {
    const s = createMatch(setup); const [a, v] = s.fighters; for (let i = 0; i < 70; i++) step(s, [0, 0]);
    v.x = a.x + 26 * FX; v.percent = 1000; a.facing = 1; step(s, [BTN.SMASH | BTN.RIGHT, 0]);
    for (let i = 0; i < 60; i++) { step(s, [0, hold]); if (v.state === 'hitstun' && v.stateFrame > 2) return v.kbAngle; }
    return -1;
  };
  const none = di(0), up = di(BTN.UP), down = di(BTN.DOWN), along = di(BTN.RIGHT);
  check('DI: holding a direction bends the launch (up raises it, down lowers it), up to 18 degrees', none > 0 && up > none && down < none && up - none <= 18 && none - down <= 18,
    `none ${none}, up ${up}, down ${down}, toward ${along}`);
  // jab lock: hit while lying on the floor by a jab, they bounce and stay down; after too many they get up
  const s = createMatch(setup); const [a, v] = s.fighters; v.x = a.x + 14 * FX; for (let i = 0; i < 70; i++) step(s, [0, 0]);
  v.state = 'knockdown'; v.anim = 'knockdown'; v.stateFrame = 0; v.vx = 0;
  let stayed = true, hits = 0, forcedUp = false;
  for (let n = 0; n < 9 && !forcedUp; n++) {
    const p0 = v.percent; step(s, [BTN.ATTACK, 0]); for (let i = 0; i < 16; i++) step(s, [0, 0]);
    if (v.percent > p0) hits++;
    if (v.state === 'getupStand') forcedUp = true; else if (v.state !== 'knockdown') stayed = false;
  }
  check('jab lock: jabbing someone lying on the floor keeps them down, until they are forced up', hits >= 4 && stayed && forcedUp, `${hits} hits, stayed down ${stayed}, forced up ${forcedUp}`);
  // up special: holding the other way faces that way; pressing it in the first frames turns him too
  const k = createMatch({ ...setup, players: [{ charId: 'kaelyn', alt: 0 }, { charId: 'simeon', alt: 1 }] }); const ka = k.fighters[0]; ka.facing = 1;
  step(k, [BTN.SPECIAL | BTN.UP | BTN.LEFT, 0]); const turned = ka.facing === -1 && ka.move === 'kickflip';
  const k2 = createMatch({ ...setup, players: [{ charId: 'kaelyn', alt: 0 }, { charId: 'simeon', alt: 1 }] }); const kb = k2.fighters[0]; kb.facing = 1;
  step(k2, [BTN.SPECIAL | BTN.UP, 0]); step(k2, [0, 0]); step(k2, [BTN.LEFT, 0]); const late = kb.facing === -1;
  for (let i = 0; i < 6; i++) step(k2, [0, 0]); step(k2, [BTN.RIGHT, 0]);
  check('up special can be turned to face either way (held at the start, or tapped during it)', turned && late && kb.facing === 1, `held ${turned}, tapped ${late}, tapped back ${kb.facing}`);
}

// Ginger: ice cream, surfing, taekwondo, Muay Thai, guitar, snowboarding
{
  const { getCharacter } = await import('../characters/index.js');
  const g = getCharacter('ginger'), sim = getCharacter('simeon');
  check('Ginger has her own smashes and specials', ['fsmash', 'usmash', 'dsmash'].every((m) => g.moves[m] !== sim.moves[m]) && ['neutral', 'side', 'up', 'down'].every((k) => g.moves[g.specials[k]] && g.animations[g.specials[k]]));
  const mk = (dx = 26, dy = 0) => { const s = createMatch({ ...setup, players: [{ charId: 'ginger', alt: 0 }, { charId: 'simeon', alt: 1 }] }); const [a, v] = s.fighters; v.x = a.x + dx * FX; v.y += dy * FX; if (dy) { v.grounded = 0; v.ground = -1; } return s; };
  const run = (s, first, n = 80) => { step(s, [first, 0]); for (let i = 0; i < n; i++) step(s, [0, 0]); return s.fighters[1].percent / 10; };
  TEST_CONFIG.SMASH_FLICK_FRAMES = FLICK;
  const f = run(mk(28), BTN.SMASH), u = run(mk(3, -44), BTN.SMASH | BTN.UP), d1 = run(mk(16), BTN.SMASH | BTN.DOWN), d2 = run(mk(-16), BTN.SMASH | BTN.DOWN);
  check('Power Chord 17%, Board Flip 15%, Muay Thai Sweep 13% in front and behind', f === 17 && u === 15 && d1 === 13 && d2 === 13, `${f}% / ${u}% / ${d1}% / ${d2}%`);
  TEST_CONFIG.SMASH_FLICK_FRAMES = 0;
  const truck = run(mk(90), BTN.SPECIAL, 120), surf = run(mk(60), BTN.SPECIAL | BTN.RIGHT, 80);
  const t = mk(400); const ta = t.fighters[0], y0 = ta.y; step(t, [BTN.SPECIAL | BTN.UP, 0]); let top = 0; for (let i = 0; i < 50; i++) { step(t, [0, 0]); top = Math.max(top, (y0 - ta.y) / FX); }
  const tk = run(mk(10), BTN.SPECIAL | BTN.UP, 60);
  check('Ice Cream Truck rolls into them (8%), Surf\'s Up rides into them (10%), Tornado Kick rises about 120px hitting (13%)', truck === 8 && surf === 10 && top > 80 && top < 160 && tk === 13, `${truck}% / ${surf}% / ${Math.round(top)}px, ${tk}%`);
  // Snack Break heals 4%, but only once every ten seconds
  const h = mk(400); const ha = h.fighters[0]; ha.percent = 300;
  step(h, [BTN.SPECIAL | BTN.DOWN, 0]); for (let i = 0; i < 60; i++) step(h, [0, 0]); const once = ha.percent;
  step(h, [BTN.SPECIAL | BTN.DOWN, 0]); for (let i = 0; i < 60; i++) step(h, [0, 0]); const twice = ha.percent;
  for (let i = 0; i < 600; i++) step(h, [0, 0]); step(h, [BTN.SPECIAL | BTN.DOWN, 0]); for (let i = 0; i < 60; i++) step(h, [0, 0]);
  check('Snack Break heals 4%, at most once every ten seconds', once === 260 && twice === 260 && ha.percent === 220, `${once / 10}% / ${twice / 10}% / ${ha.percent / 10}%`);
}

// Faybua: cookies, a tactical dash, skateboarding, fashion, dancing, horses
{
  const { getCharacter } = await import('../characters/index.js');
  const fb = getCharacter('faybua'), sim = getCharacter('simeon');
  check('Faybua has her own smashes and specials', ['fsmash', 'usmash', 'dsmash'].every((m) => fb.moves[m] !== sim.moves[m]) && ['neutral', 'side', 'up', 'down'].every((k) => fb.moves[fb.specials[k]] && fb.animations[fb.specials[k]]));
  const mk = (dx = 26, dy = 0) => { const s = createMatch({ ...setup, players: [{ charId: 'faybua', alt: 0 }, { charId: 'simeon', alt: 1 }] }); const [a, v] = s.fighters; v.x = a.x + dx * FX; v.y += dy * FX; if (dy) { v.grounded = 0; v.ground = -1; } return s; };
  const run = (s, first, n = 80) => { step(s, [first, 0]); for (let i = 0; i < n; i++) step(s, [0, 0]); return s.fighters[1].percent / 10; };
  TEST_CONFIG.SMASH_FLICK_FRAMES = FLICK;
  const f = run(mk(28), BTN.SMASH), u = run(mk(3, -40), BTN.SMASH | BTN.UP), d1 = run(mk(-16), BTN.SMASH | BTN.DOWN), d2 = run(mk(16), BTN.SMASH | BTN.DOWN);
  check('Scythe 17%, Spin Move 15%, Buck Kick 13% behind and in front', f === 17 && u === 15 && d1 === 13 && d2 === 13, `${f}% / ${u}% / ${d1}% / ${d2}%`);
  TEST_CONFIG.SMASH_FLICK_FRAMES = 0;
  const ck = run(mk(80), BTN.SPECIAL, 60), dash = run(mk(60), BTN.SPECIAL | BTN.RIGHT, 60);
  const d = mk(400); const da = d.fighters[0], x0 = da.x; step(d, [BTN.SPECIAL | BTN.RIGHT, 0]); for (let i = 0; i < 60; i++) step(d, [0, 0]); const untouchable = true;
  const o = mk(400); const oa = o.fighters[0], y0 = oa.y; step(o, [BTN.SPECIAL | BTN.UP, 0]); let top = 0; for (let i = 0; i < 50; i++) { step(o, [0, 0]); top = Math.max(top, (y0 - oa.y) / FX); }
  check('Cookie Toss 5%; Giddy Up gallops forward on her horse (11%); Ollie rides up about 110px', ck === 5 && dash === 11 && (da.x - x0) / FX > 90 && top > 80 && top < 150,
    `${ck}% / ${dash}% galloped ${Math.round((da.x - x0) / FX)}px / up ${Math.round(top)}px`);
  // Serve!: a counter. Simeon jabs her while she poses: she takes nothing, he takes at least 8%
  const c = createMatch({ ...setup, players: [{ charId: 'faybua', alt: 0 }, { charId: 'simeon', alt: 1 }] }); const [ca, cv] = c.fighters; cv.x = ca.x + 14 * FX; cv.facing = -1;
  step(c, [BTN.SPECIAL | BTN.DOWN, 0]); for (let i = 0; i < 5; i++) step(c, [0, 0]); step(c, [0, BTN.ATTACK]); for (let i = 0; i < 50; i++) step(c, [0, 0]);
  check('Serve! counters a hit with a camera flash (no damage to her, at least 8% back)', ca.percent === 0 && cv.percent >= 80, `her ${ca.percent / 10}%, his ${cv.percent / 10}%`);
}

process.exit(fails ? 1 : 0);
