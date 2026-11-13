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
  step(s, [BTN.ATTACK | BTN.RIGHT, 0]);
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
  a.y -= 24 * FX; a.grounded = 0; a.ground = -1; a.state = 'air'; // falling from just above the floor
  step(s, [BTN.ATTACK | BTN.RIGHT, 0]);
  let lag = -1;
  for (let i = 0; i < 80 && lag < 0; i++) { step(s, [0, 0]); if (a.state === 'land') lag = a.landLag; }
  check('landing during forward air gives its landing lag', lag === 8, 'lag ' + lag);
  s = createMatch(setup); a = s.fighters[0];
  for (let i = 0; i < 4; i++) step(s, [BTN.JUMP, 0]);
  step(s, [BTN.JUMP | BTN.ATTACK | BTN.UP, 0]);
  lag = -1;
  for (let i = 0; i < 80 && lag < 0; i++) { step(s, [BTN.JUMP, 0]); if (a.state === 'land') lag = a.landLag; }
  check('up air finished before landing auto-cancels', lag === 2, 'lag ' + lag);
  // buffering: double-tap and a jump pressed during a tilt's last frames come out at once
  s = createMatch(setup); a = s.fighters[0]; s.fighters[1].x = 900 * FX;
  step(s, [BTN.ATTACK | BTN.UP, 0]);
  for (let i = 0; i < 19; i++) step(s, [0, 0]);
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
  // forward air: strongest hit at the foot on frame 10
  s = createMatch(setup); [a, v] = s.fighters;
  for (const f of [a, v]) { f.y -= 80 * FX; f.grounded = 0; f.ground = -1; f.state = 'air'; f.vy = 0; }
  v.x = a.x + 22 * FX;
  step(s, [BTN.ATTACK | BTN.RIGHT, 0]);
  let fairFrame = -1;
  for (let i = 0; i < 20; i++) { step(s, [0, 0]); a.vy = 0; if (v.state !== 'hitstun') v.vy = 0; if (fairFrame < 0 && v.percent) fairFrame = a.stateFrame; }
  check('forward air punch: 12% on frame 8, launched forward not down', v.percent === 120 && fairFrame === 8 && v.kbAngle !== 270, `${v.percent / 10}% on ${fairFrame}, angle ${v.kbAngle}`);
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
// Ledge attack
{
  const s = createMatch(setup); const [f, v] = s.fighters;
  for (let i = 0; i < 200 && f.state !== 'ledge'; i++) step(s, [f.grounded ? BTN.LEFT : BTN.RIGHT, 0]);
  for (let i = 0; i < 10; i++) step(s, [0, 0]);
  v.x = 125 * FX; v.facing = -1;
  step(s, [BTN.ATTACK, 0]);
  check('ledge attack starts from the ledge and is intangible', f.move === 'ledgeAttack' && f.intangible > 0);
  for (let i = 0; i < 60; i++) step(s, [0, 0]);
  check('ledge attack climbs onto the stage and hits for 9%', f.state === 'idle' && f.grounded && f.y === 170 * FX && f.x > 100 * FX && v.percent === 90, `${v.percent / 10}% x ${f.x / FX}`);
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
  check('directional air dodge travels that way', (a.x - ax) / FX > 40, `${((a.x - ax) / FX).toFixed(1)}px`);
  {
    const s2 = createMatch(setup); const b = s2.fighters[0];
    b.y -= 100 * FX; b.grounded = 0; b.ground = -1; b.state = 'air'; b.vy = 0;
    const y0 = b.y;
    step(s2, [BTN.SHIELD, 0]); step(s2, [BTN.SHIELD | BTN.UP, 0]);   // direction one frame late
    for (let i = 0; i < 20; i++) step(s2, [0, 0]);
    check('air dodge direction pressed a frame late still counts (up)', b.dodgeDir === 1 && (y0 - b.y) / FX > 30, `${((y0 - b.y) / FX).toFixed(1)}px up`);
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
process.exit(fails ? 1 : 0);
