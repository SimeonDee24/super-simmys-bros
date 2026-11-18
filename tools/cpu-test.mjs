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

// Out of jumps below the ledge, a CPU Kaelyn recovers with Kickflip.
{
  const s = createMatch({ stageId: 'nest', players: [{ charId: 'kaelyn', alt: 0 }, { charId: 'simeon', alt: 1 }], stocks: 3, seed: 9 });
  const k = s.fighters[0]; const cpu = new CpuController('dummy', 4);
  k.x = 50 * FX; k.y = 270 * FX; k.grounded = 0; k.ground = -1; k.state = 'air'; k.vy = FX; k.jumpsLeft = 0;
  let usedUp = false, back = false;
  for (let t = 0; t < 400 && !back && k.state !== 'dead'; t++) { step(s, [cpu.sample(s, 0), 0]); if (k.move === 'kickflip') usedUp = true; back = k.grounded === 1; }
  check('CPU Kaelyn recovers from below the ledge with Kickflip', usedUp && back, `${usedUp ? 'used it' : 'did not use it'}, ${k.state}`);
}

// A CPU can play Kaelyn too: it fights, uses her specials and gets back to the stage.
{
  const s = createMatch({ stageId: 'nest', players: [{ charId: 'kaelyn', alt: 0 }, { charId: 'simeon', alt: 1 }], stocks: 3, seed: 9 });
  const cpus = [new CpuController('fighter', 61), new CpuController('fighter', 62)];
  const used = new Set(); let dealt = 0;
  for (let t = 0; t < 7200; t++) {
    const before = s.fighters[1].percent;
    step(s, [cpus[0].sample(s, 0), cpus[1].sample(s, 1)]);
    if (s.fighters[1].percent > before) dealt += s.fighters[1].percent - before;
    if (s.fighters[0].move) used.add(s.fighters[0].move);
    if (s.fighters.some((f) => f.state === 'out')) break;
  }
  check('a CPU Kaelyn fights and uses her specials', dealt > 300 && used.has('puffPass'), `dealt ${dealt / 10}%, specials: ${['puffPass', 'rollOut', 'kickflip', 'dropIn'].filter((m) => used.has(m)).join(', ')}`);
}

// A CPU can play Luca: it fights, drops the bass and recovers with Wire Transfer.
{
  const s = createMatch({ stageId: 'cloudrest', players: [{ charId: 'luca', alt: 0 }, { charId: 'kaelyn', alt: 0 }], stocks: 3, seed: 9 });
  const cpus = [new CpuController('fighter', 71), new CpuController('fighter', 72)];
  const used = new Set(); let dealt = 0;
  for (let t = 0; t < 7200; t++) {
    const before = s.fighters[1].percent;
    step(s, [cpus[0].sample(s, 0), cpus[1].sample(s, 1)]);
    if (s.fighters[1].percent > before) dealt += s.fighters[1].percent - before;
    if (s.fighters[0].move) used.add(s.fighters[0].move);
    if (s.fighters.some((f) => f.state === 'out')) break;
  }
  check('a CPU Luca fights and uses Bass Drop', dealt > 300 && used.has('bassDrop'), `dealt ${dealt / 10}%, specials: ${['bassDrop', 'supplyDemand', 'supplyDemandCrash', 'wireTransfer', 'stageDive'].filter((m) => used.has(m)).join(', ')}`);
  const r = createMatch({ stageId: 'nest', players: [{ charId: 'luca', alt: 0 }, { charId: 'simeon', alt: 1 }], stocks: 3, seed: 9 });
  const k = r.fighters[0]; const cpu = new CpuController('dummy', 4);
  k.x = 50 * FX; k.y = 262 * FX; k.grounded = 0; k.ground = -1; k.state = 'air'; k.vy = FX; k.jumpsLeft = 0;
  let usedUp = false, back = false;
  for (let t = 0; t < 400 && !back && k.state !== 'dead'; t++) { step(r, [cpu.sample(r, 0), 0]); if (k.move === 'wireTransfer') usedUp = true; back = k.grounded === 1 || k.state === 'ledge'; }
  check('CPU Luca recovers from below the ledge with Wire Transfer', usedUp && back, `${usedUp ? 'used it' : 'did not use it'}, ${k.state}`);
}

// Five levels, and a higher level really is stronger: over several matches
// level 5 beats level 1 clearly, and level 4 beats level 2.
{
  const { CPU_ORDER, CPU_LEVELS, cpuLabel } = await import('../engine/cpu.js');
  check('training dummy plus five fighting levels', CPU_ORDER.join() === 'dummy,lv1,lv2,lv3,lv4,lv5' && CPU_ORDER.every((l) => CPU_LEVELS[l] && cpuLabel(l)));
  const duel = (hi, lo, games) => {
    let hiWins = 0, hiDmg = 0, loDmg = 0;
    for (let g = 0; g < games; g++) {
      const chars = ['simeon', 'kaelyn', 'luca'];
      const s = createMatch({ stageId: ['nest', 'balcony', 'cloudrest'][g % 3], players: [{ charId: chars[g % 3], alt: 0 }, { charId: chars[(g + 1) % 3], alt: 1 }], stocks: 2, seed: 100 + g });
      // swap sides every other game so neither side has an edge
      const hiSlot = g & 1;
      const cpus = [];
      cpus[hiSlot] = new CpuController(hi, 300 + g); cpus[1 - hiSlot] = new CpuController(lo, 400 + g);
      for (let t = 0; t < 9000; t++) {
        const before = s.fighters.map((f) => f.percent);
        step(s, [cpus[0].sample(s, 0), cpus[1].sample(s, 1)]);
        s.fighters.forEach((f, i) => { const d = Math.max(0, f.percent - before[i]); if (i === hiSlot) loDmg += d; else hiDmg += d; });
        if (s.fighters.some((f) => f.state === 'out')) break;
      }
      const [a, b] = [s.fighters[hiSlot], s.fighters[1 - hiSlot]];
      if (b.stocks < a.stocks || (b.stocks === a.stocks && b.percent > a.percent)) hiWins++;
    }
    return { hiWins, hiDmg: Math.round(hiDmg / 10), loDmg: Math.round(loDmg / 10) };
  };
  const r51 = duel('lv5', 'lv1', 6), r42 = duel('lv4', 'lv2', 6);
  check('level 5 beats level 1', r51.hiWins >= 5 && r51.hiDmg > r51.loDmg * 2, `${r51.hiWins}/6 wins, damage ${r51.hiDmg}% vs ${r51.loDmg}%`);
  check('level 4 beats level 2', r42.hiWins >= 4 && r42.hiDmg > r42.loDmg, `${r42.hiWins}/6 wins, damage ${r42.hiDmg}% vs ${r42.loDmg}%`);
}

// Free-for-all: three and four CPUs play to the end. Exactly one is left,
// everyone took part, and the same seeds give the same match.
for (const n of [3, 4]) {
  const chars = ['max', 'malcolm', 'luca', 'sara'];
  const play = () => {
    const s = createMatch({ stageId: n === 3 ? 'nest' : 'cloudrest', players: chars.slice(0, n).map((charId, i) => ({ charId, alt: i === 3 ? 1 : 0 })), stocks: 3, seed: 9 });
    const cpus = chars.slice(0, n).map((_, i) => new CpuController('lv4', 31 + i * 7));
    const dealtTo = new Array(n).fill(0);
    let t = 0;
    for (; t < 60 * 60 * 8; t++) {
      const before = s.fighters.map((f) => f.percent);
      step(s, cpus.map((c, i) => c.sample(s, i)));
      s.fighters.forEach((f, i) => { if (f.percent > before[i]) dealtTo[i] += f.percent - before[i]; });
      if (s.fighters.filter((f) => f.state !== 'out').length <= 1) break;
    }
    return { s, t, dealtTo };
  };
  const a = play(), b = play();
  const left = a.s.fighters.filter((f) => f.state !== 'out').length;
  check(`${n}-fighter free-for-all ends with one winner`, left === 1 && a.dealtTo.every((d) => d > 300),
    `${Math.round(a.t / 60)}s, stocks ${a.s.fighters.map((f) => f.stocks).join(' / ')}, damage taken ${a.dealtTo.map((d) => Math.round(d / 10)).join(' / ')}%`);
  check(`${n}-fighter free-for-all replays identically`, JSON.stringify(a.s) === JSON.stringify(b.s));
}

process.exit(fails ? 1 : 0);
