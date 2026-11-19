// Headless sound checks:  node tools/sound-test.mjs
// Plays matches with no browser and checks that the right sounds would be
// asked for, that every one of them exists, and that listening changes nothing.
import { createMatch, step, hashState } from '../engine/sim.js';
import { CpuController } from '../engine/cpu.js';
import { BTN } from '../engine/input.js';
import { SoundDirector } from '../audio/director.js';
import { SOUND_NAMES, SOUNDS } from '../audio/sfx.js';

let fails = 0;
const check = (name, ok, extra = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!ok) fails++; };
const FX = 256;
const mk = (a = 'simeon', b = 'simeon', stageId = 'cloudrest') => createMatch({ stageId, players: [{ charId: a, alt: 0 }, { charId: b, alt: 1 }], stocks: 3, seed: 7 });
// run a script of [frames, p1 input] and return the sound names heard
const hear = (s, script) => {
  const d = new SoundDirector(), names = [];
  d.update(s);
  for (const [n, inp] of script) for (let i = 0; i < n; i++) { step(s, [inp, 0]); for (const e of d.update(s)) names.push(e.name); }
  return names;
};
const has = (names, ...want) => want.every((w) => names.includes(w));

{
  const n = hear(mk(), [[1, BTN.JUMP], [20, BTN.JUMP], [1, 0], [1, BTN.JUMP], [80, 0]]);
  check('jump, double jump and landing', has(n, 'jump', 'djump', 'land'), n.join(' '));
}
{
  const s = mk(); s.fighters[1].x = s.fighters[0].x + 18 * FX;
  const n = hear(s, [[1, BTN.ATTACK], [30, 0]]);
  check('a jab that lands: swing then hit', has(n, 'swingS', 'hitS') && n.indexOf('swingS') <= n.indexOf('hitS'), n.join(' '));
}
{
  const s = mk(); s.fighters[1].x = 900 * FX;
  const n = hear(s, [[1, BTN.ATTACK], [30, 0]]);
  check('a jab that misses: swing only', has(n, 'swingS') && !n.some((x) => x.startsWith('hit')), n.join(' '));
}
{
  const n = hear(mk(), [[1, BTN.RIGHT], [2, 0], [1, BTN.RIGHT], [30, BTN.RIGHT], [20, 0]]);
  check('dash, footsteps and skid', has(n, 'dash', 'step', 'skid'), [...new Set(n)].join(' '));
}
{
  const n = hear(mk(), [[20, BTN.SHIELD], [1, BTN.SHIELD | BTN.LEFT], [40, 0], [1, BTN.SHIELD], [1, BTN.SHIELD | BTN.DOWN], [40, 0]]);
  check('shield, roll and spot dodge', has(n, 'shieldOn', 'dodge') && n.filter((x) => x === 'dodge').length === 2, n.join(' '));
}
{
  const s = mk(); s.fighters[1].x = s.fighters[0].x + 14 * FX;
  const n = hear(s, [[1, BTN.GRAB], [14, 0], [1, BTN.RIGHT], [50, 0]]);
  check('grab and throw', has(n, 'grab', 'throw'), n.join(' '));
}
{
  const s = mk(); s.fighters[1].x = 900 * FX;
  const a = s.fighters[0]; a.x = 700 * FX;
  const n = hear(s, [[120, 0]]);
  check('KO blast and respawn', has(n, 'ko', 'respawn'), n.join(' '));
}
{
  const s = mk(); s.fighters[1].x = 900 * FX;
  const n = hear(s, [[1, BTN.SPECIAL], [30, BTN.SPECIAL], [150, 0]]);
  check('Simeon jump shot: charge ticks, the shot, bounces', has(n, 'charge', 'shoot', 'bounce'), [...new Set(n)].join(' '));
  const u = hear(mk(), [[1, BTN.SPECIAL | BTN.UP], [200, 0]]);
  check('Simeon alley-oop: a run of kick swings', u.filter((x) => x.startsWith('swing')).length >= 5, u.join(' '));
  let mis = false;
  // (Fast Break is no longer Simeon's side special, but is kept: put it back for this test)
  const { getCharacter } = await import('../characters/index.js');
  const sp = getCharacter('simeon').specials, side = sp.side; sp.side = 'fastBreak';
  for (let sd = 1; sd < 60 && !mis; sd++) { const m = createMatch({ stageId: 'cloudrest', players: [{ charId: 'simeon', alt: 0 }, { charId: 'simeon', alt: 1 }], stocks: 3, seed: sd }); m.fighters[1].x = 900 * FX; if (hear(m, [[1, BTN.SPECIAL | BTN.RIGHT], [60, 0]]).includes('misfire')) mis = true; }
  check('Simeon fast break: launch, and a misfire sounds different', has(hear(s, [[1, BTN.SPECIAL | BTN.RIGHT], [60, 0]]), 'rocket') && mis);
  sp.side = side;
}
{
  const s = mk('kaelyn'); s.fighters[1].x = 900 * FX;
  const n = hear(s, [[1, BTN.SPECIAL], [200, 0], [1, BTN.SPECIAL | BTN.RIGHT], [70, 0], [1, BTN.SPECIAL | BTN.UP], [140, 0]]);
  check('Kaelyn: vape thrown and caught, skates, shockwave', has(n, 'vape', 'catch', 'skate', 'wave'), [...new Set(n)].join(' '));
}
{
  const s = mk('luca'); s.fighters[1].x = 900 * FX;
  const n = hear(s, [[1, BTN.SPECIAL], [40, BTN.SPECIAL], [50, 0], [1, BTN.SPECIAL | BTN.RIGHT], [60, 0], [1, BTN.SPECIAL | BTN.UP], [120, 0]]);
  check('Luca: bass drop, arrow, teleport out and in', has(n, 'charge', 'bass', 'arrow', 'warpOut', 'warpIn'), [...new Set(n)].join(' '));
}
// Whole CPU matches with every fighter: every sound asked for exists, and
// between them the matches use nearly the whole sound set.
{
  const heard = new Set(); let unknown = '';
  for (const [a, b, stageId] of [['simeon', 'kaelyn', 'nest'], ['luca', 'simeon', 'cloudrest'], ['kaelyn', 'luca', 'balcony']]) {
    const s = mk(a, b, stageId), d = new SoundDirector();
    const cpus = [new CpuController('fighter', 5), new CpuController('fighter', 6)];
    for (let t = 0; t < 7200; t++) {
      step(s, [cpus[0].sample(s, 0), cpus[1].sample(s, 1)]);
      for (const e of d.update(s)) { heard.add(e.name); if (!SOUNDS[e.name]) unknown = e.name; if (!(e.strength >= 0) || !(Math.abs(e.pan) <= 1)) unknown = e.name + ' (bad values)'; }
      if (s.fighters.some((f) => f.state === 'out')) break;
    }
  }
  check('every sound a match asks for exists', !unknown, unknown);
  const inMatch = SOUND_NAMES.filter((n) => !n.startsWith('menu') && n !== 'pause' && n !== 'start');
  const unheard = inMatch.filter((n) => !heard.has(n));
  check('CPU matches use nearly every in-match sound', unheard.length <= 6, `${heard.size} heard; not heard: ${unheard.join(', ') || 'none'}`);
}
// Listening never changes the match.
{
  const run = (listen) => {
    const s = mk('kaelyn', 'luca', 'nest'), d = new SoundDirector();
    const cpus = [new CpuController('fighter', 5), new CpuController('fighter', 6)];
    for (let t = 0; t < 1500; t++) { step(s, [cpus[0].sample(s, 0), cpus[1].sample(s, 1)]); if (listen) d.update(s); }
    return hashState(s);
  };
  check('a match is identical with and without sound', run(true) === run(false));
}
process.exit(fails ? 1 : 0);
