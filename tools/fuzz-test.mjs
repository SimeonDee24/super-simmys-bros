// Crash hunt:  node tools/fuzz-test.mjs
// Plays many games with random button mashing (and CPUs) on every stage and
// reports any error thrown by the simulation. Any error here would freeze the
// game in the browser, so this should always print 0 crashes.
import { createMatch, step } from '../engine/sim.js';
import { CpuController } from '../engine/cpu.js';
import { STAGES } from '../stages/index.js';

let seed = 12345;
const r = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
let games = 0, crashes = 0;
for (const stage of STAGES) {
  for (let g = 0; g < 15; g++) {
    games++;
    const s = createMatch({ stageId: stage.id, players: [{ charId: g % 2 ? 'kaelyn' : 'simeon', alt: 0 }, { charId: g % 3 ? 'simeon' : 'kaelyn', alt: 1 }], stocks: 3, seed: g + 1 });
    const cpu = g % 3 === 0 ? new CpuController('fighter', g + 7) : null;
    const held = [0, 0];
    try {
      for (let t = 0; t < 3000; t++) {
        for (let k = 0; k < 2; k++) if (r() < 0.15) { held[k] = 0; for (let b = 0; b < 10; b++) if (r() < 0.25) held[k] |= 1 << b; }
        step(s, [held[0], cpu ? cpu.sample(s, 1) : held[1]]);
      }
    } catch (e) {
      crashes++;
      if (crashes <= 3) console.log(`CRASH on ${stage.id}, game ${g}:`, e.stack.split('\n').slice(0, 3).join(' | '));
    }
  }
}
console.log(`${crashes ? 'FAIL' : 'PASS'} ${games} mashing games, ${crashes} crashes`);
process.exit(crashes ? 1 : 0);
