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
  check('3 stages registered with collision, ledges and art', STAGES.length === 3 && STAGES.every((st) => st.solids.length && st.ledges.length === 2 && typeof st.art.draw === 'function'));
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
  check('forward roll travels, is intangible mid-roll, ends facing the other way', (rx - v.x) / FX > 25 && intang[6] === 1 && intang[0] === 0 && v.facing === -face, `${((rx - v.x) / FX).toFixed(1)}px`);
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
    check(`${name}: ${dmg / 10}%, sends the right way${name === 'back throw' ? ', spins round' : ''}`,
      v.percent === dmg && test(v, a) && (name !== 'back throw' || spun), `${v.percent / 10}% dx ${((v.x - a.x) / FX).toFixed(0)} dy ${((v.y - a.y) / FX).toFixed(0)}`);
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
// Specials by direction in the air: none = Jump Shot, sideways = Fast Break, up = Rotor Cap
for (const [label, hold, wait, want] of [['no direction', 0, 20, 'jumpShot'], ['holding sideways', BTN.RIGHT, 6, 'fastBreak'], ['holding up', BTN.UP, 20, 'rotorCap']]) {
  const s = createMatch(setup); const a = s.fighters[0]; s.fighters[1].x = 900 * FX;
  step(s, [BTN.JUMP, 0]); for (let i = 0; i < wait; i++) step(s, [BTN.JUMP | hold, 0]);
  step(s, [BTN.SPECIAL | hold, 0]);
  check(`special in the air while ${label} is ${want}`, a.move === want, a.move);
}
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
    const toward = b.x < 52 * FX ? BTN.RIGHT : b.x > 60 * FX ? BTN.LEFT : 0;   // stay beside the ledge, not under the stage
    const inp = i === 2 ? BTN.JUMP | toward : i === 30 ? BTN.SPECIAL | BTN.UP : toward;
    step(r, [inp, 0]); saved = b.state === 'ledge' || b.grounded === 1;
  }
  check('from below the screen, double jump + rotor cap gets back', saved, b.state + ' y ' + (b.y / FX).toFixed(0));
}
// Rotor Cap (up special): flies up, steerable, hits above, then helpless
{
  let s = createMatch(setup); let [a, v] = s.fighters; v.x = 900 * FX;
  const y0 = a.y, x0 = a.x; let top = y0, helpless = false, jumped = false;
  step(s, [BTN.SPECIAL | BTN.UP, 0]);
  for (let i = 0; i < 260; i++) {
    step(s, [(i < 40 ? BTN.LEFT : 0) | (a.state === 'helpless' ? BTN.JUMP | BTN.ATTACK : 0), 0]);
    top = Math.min(top, a.y);
    if (a.state === 'helpless') { helpless = true; if (a.vy < -FX || a.move) jumped = true; }
    if (helpless && a.grounded) break;
  }
  check('rotor cap lifts him well over 100px and can be steered', (y0 - top) / FX > 110 && a.x < x0 - 20 * FX, `${((y0 - top) / FX).toFixed(0)}px up, ${((a.x - x0) / FX).toFixed(0)}px sideways`);
  check('rotor cap ends in a helpless fall: no jump or attack until he lands', helpless && !jumped);
  check('landing from the helpless fall has landing lag', a.state === 'land' && a.landLag === 14, a.state + ' ' + a.landLag);
  // blades hit someone above several times
  s = createMatch(setup); [a, v] = s.fighters; v.x = a.x; v.y = a.y - 64 * FX; v.grounded = 0; v.ground = -1; v.state = 'air';
  let hitsN = 0, last = 0;
  step(s, [BTN.SPECIAL | BTN.UP, 0]);
  for (let i = 0; i < 90; i++) { step(s, [0, 0]); if (v.percent !== last) { hitsN++; last = v.percent; } }
  check('rotor cap blades hit an opponent above more than once, 3% each', hitsN >= 2 && v.percent === hitsN * 30, `${hitsN} hits, ${v.percent / 10}%`);
  // recovering from below the ledge: it grabs the ledge on the way up
  s = createMatch(setup); [a, v] = s.fighters; v.x = 900 * FX;
  a.x = 56 * FX; a.y = 290 * FX; a.grounded = 0; a.ground = -1; a.state = 'air'; a.jumpsLeft = 0; a.vy = 0;
  step(s, [BTN.SPECIAL | BTN.UP, 0]);
  let grabbed = false;
  for (let i = 0; i < 120 && !grabbed; i++) { step(s, [0, 0]); grabbed = a.state === 'ledge'; }
  check('rotor cap from far below the stage reaches and grabs the ledge', grabbed, a.state + ' y ' + (a.y / FX).toFixed(0));
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
  check('three characters with two skins each', CHARACTERS.length === 3 && CHARACTERS.every((c) => c.palettes.length === 2), CHARACTERS.map((c) => c.name + ':' + c.palettes.length).join(' '));
  const [sim, kae, luc] = CHARACTERS;
  const shared = ['jab1', 'ftilt', 'utilt', 'dtilt', 'dashAttack', 'nair', 'fair', 'bair', 'uair', 'dair', 'grab'];
  check('Kaelyn shares all normals, grabs and throws with Simeon', shared.every((m) => kae.moves[m] === sim.moves[m]) && kae.throws === sim.throws);
  check('Luca shares all normals, grabs and throws too, with his own four specials', shared.every((m) => luc.moves[m] === sim.moves[m]) && ['neutral', 'side', 'up', 'down'].every((k) => luc.specials[k] && luc.specials[k] !== sim.specials[k] && luc.specials[k] !== kae.specials[k]));
  check('Kaelyn has her own four specials', ['neutral', 'side', 'up', 'down'].every((k) => kae.specials[k] && kae.specials[k] !== sim.specials[k]));
}
// Kaelyn's specials
{
  const ksetup = { stageId: 'nest', players: [{ charId: 'kaelyn', alt: 0 }, { charId: 'simeon', alt: 1 }], stocks: 3, seed: 5 };
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
  const lsetup = { stageId: 'nest', players: [{ charId: 'luca', alt: 0 }, { charId: 'simeon', alt: 1 }], stocks: 3, seed: 5 };
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

process.exit(fails ? 1 : 0);
