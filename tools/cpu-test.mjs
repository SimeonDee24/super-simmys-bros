// Headless CPU checks:  node tools/cpu-test.mjs
// Plays matches with no browser and reports what happened.
import { createMatch, step } from '../engine/sim.js';
import { CpuController } from '../engine/cpu.js';
import { BTN } from '../engine/input.js';
import { FX } from '../engine/fixed.js';

let fails = 0;
const check = (name, ok, extra = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!ok) fails++; };
const setup = (stageId = 'nest') => ({ stageId, players: [{ charId: 'simeon', alt: 0 }, { charId: 'simeon', alt: 1 }], stocks: 3, seed: 7 });

// Fighter vs fighter for 2 minutes: both deal damage and somebody gets KO'd.
for (const stageId of ['nest', 'cloudrest']) {
  const s = createMatch(setup(stageId));
  const cpus = [new CpuController('fighter', 11), new CpuController('fighter', 22)];
  let dealt = [0, 0];
  for (let t = 0; t < 7200; t++) {
    const before = s.fighters.map((f) => f.percent);
    step(s, [cpus[0].sample(s, 0), cpus[1].sample(s, 1)]);
    s.fighters.forEach((f, i) => { if (f.percent > before[i]) dealt[1 - i] += f.percent - before[i]; });
    if (s.fighters.some((f) => f.state === 'out')) break;
  }
  const falls = s.fighters.map((f) => f.falls);
  check(`${stageId}: two fighter CPUs fight (damage dealt, KOs happen)`, dealt[0] > 300 && dealt[1] > 300 && falls[0] + falls[1] > 0,
    `damage ${dealt.map((d) => d / 10).join(' / ')}%, falls ${falls.join(' / ')}`);
}

// Same seeds, same match: CPU play is deterministic.
{
  const run = () => {
    const s = createMatch(setup());
    const cpus = [new CpuController('fighter', 5), new CpuController('fighter', 6)];
    for (let t = 0; t < 1800; t++) step(s, [cpus[0].sample(s, 0), cpus[1].sample(s, 1)]);
    return JSON.stringify(s);
  };
  check('CPU matches replay identically', run() === run());
}

// The dummy stands still on stage...
{
  const s = createMatch(setup()); const dummy = new CpuController('dummy', 3);
  const x0 = s.fighters[1].x;
  for (let t = 0; t < 300; t++) step(s, [0, dummy.sample(s, 1)]);
  check('dummy stands still when left alone', s.fighters[1].x === x0 && s.fighters[1].state === 'idle');
}

// ...but recovers when knocked off, from many places off both sides.
{
  let ok = 0, total = 0;
  for (const side of [-1, 1]) for (const ox of [10, 25, 40, 55]) for (const oy of [-40, 0, 20, 35]) {
    const s = createMatch(setup()); const d = s.fighters[1]; const dummy = new CpuController('dummy', 9 + ox + oy);
    s.fighters[0].x = 240 * FX;
    d.x = (side < 0 ? 100 - ox : 380 + ox) * FX; d.y = (170 + oy) * FX;
    d.grounded = 0; d.ground = -1; d.state = 'air'; d.vy = 0; d.jumpsLeft = 1; d.vx = side * 2 * FX;
    let back = false;
    for (let t = 0; t < 600 && !back; t++) { step(s, [0, dummy.sample(s, 1)]); if (d.grounded && d.state !== 'dead') back = true; if (d.state === 'dead') break; }
    total++; if (back) ok++;
  }
  check('dummy recovers from reasonable spots off the stage', ok >= total * 0.75, `${ok}/${total} made it back`);
}

// Fighter recovers too
{
  const s = createMatch(setup()); const f = s.fighters[1]; const cpu = new CpuController('fighter', 4);
  f.x = 70 * FX; f.y = 185 * FX; f.grounded = 0; f.ground = -1; f.state = 'air'; f.vy = 0; f.jumpsLeft = 1;
  let back = false;
  for (let t = 0; t < 600 && !back; t++) { step(s, [0, cpu.sample(s, 1)]); if (f.grounded) back = true; if (f.state === 'dead') break; }
  check('fighter CPU recovers back to the stage', back);
}
// The fighter CPU defends: shields, spot dodges, rolls and air dodges all show up.
{
  const seen = {};
  for (const [stageId, sa, sb] of [['nest', 31, 32], ['balcony', 41, 42], ['cloudrest', 51, 52]]) {
    const s = createMatch(setup(stageId));
    const cpus = [new CpuController('fighter', sa), new CpuController('fighter', sb)];
    for (let t = 0; t < 5400; t++) {
      step(s, [cpus[0].sample(s, 0), cpus[1].sample(s, 1)]);
      for (const f of s.fighters) if (f.stateFrame === 1) seen[f.state] = (seen[f.state] || 0) + 1;
      if (s.fighters.some((f) => f.state === 'out')) break;
    }
  }
  const n = (k) => seen[k] || 0;
  check('fighter CPU shields, spot dodges, rolls and air dodges',
    n('shield') + n('shieldStun') >= 15 && n('spotdodge') >= 3 && n('roll') >= 3 && n('airdodge') >= 3,
    `shield ${n('shield')}, blocked ${n('shieldStun')}, spot dodge ${n('spotdodge')}, roll ${n('roll')}, air dodge ${n('airdodge')}`);
}

process.exit(fails ? 1 : 0);
