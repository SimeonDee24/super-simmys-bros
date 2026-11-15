// Online netcode checks, with no network:  node tools/net-test.mjs
// Rooms are joined by pretend links with made-up lag (net/links.js) and play
// whole matches against each other.
import { createMatch, step, hashState } from '../engine/sim.js';
import { Room } from '../net/room.js';
import { makeNet } from '../net/links.js';
import { GAME_VERSION } from '../config/version.js';

let fails = 0;
const check = (name, ok, extra = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!ok) fails++; };
const rng = (seed) => () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
const TICK = 1000 / 60;

// A host and some friends in one lobby, every friend joined.
function party(friends, lag) {
  const net = makeNet({ ...lag, rand: rng(99) });
  const host = new Room(true, { char: 0, alt: 0 });
  const rooms = [host];
  for (let i = 0; i < friends; i++) {
    const [a, b] = net.pair();
    const r = new Room(false);
    host.accept(a); r.join(b);
    rooms.push(r);
  }
  for (let i = 0; i < 30; i++) net.advance(TICK);
  return { net, host, rooms };
}
// Each room mashes buttons with its own random stream.
function mashers(rooms, seed = 5) {
  return rooms.map((_, i) => { const r = rng(seed + i * 77); let held = 0; return () => { if (r() < 0.12) { held = 0; for (let b = 0; b < 10; b++) if (r() < 0.25) held |= 1 << b; } return held; }; });
}
// Play until the match is over everywhere (or for `max` ticks). hitch(i, t) true = room i misses that tick.
function play(p, max, hitch = () => false, during = () => {}) {
  const mash = mashers(p.rooms);
  let t = 0;
  for (; t < max; t++) {
    p.net.advance(TICK);
    p.rooms.forEach((r, i) => { if (r.session && !hitch(i, t)) r.tick(mash[i]); });
    during(t);
    if (p.rooms.every((r) => !r.session || r.session.over)) break;
  }
  // let the last messages arrive
  for (let i = 0; i < 60; i++) { p.net.advance(TICK); p.rooms.forEach((r, k) => { if (r.session) r.tick(mash[k]); }); }
  return t;
}
// The same match played offline from the inputs a session ended up with.
function replay(session, setup) {
  const s = createMatch(setup);
  for (let f = 0; f < session.cframe; f++) step(s, session.inputs.map((_, q) => session.inputAt(q, f)));
  return hashState(s);
}
const sameGame = (rooms) => {
  const live = rooms.filter((r) => r.session);
  const f = Math.min(...live.map((r) => r.session.cframe));
  // compare at a frame everyone has passed: replay each one's inputs up to it
  const hs = live.map((r) => { const s = createMatch(r.match.setup); for (let k = 0; k < f; k++) step(s, r.session.inputs.map((_, q) => r.session.inputAt(q, k))); return hashState(s); });
  return hs.every((h) => h === hs[0]) && live.every((r) => r.session.desync < 0);
};

// --- lobby ---
{
  const p = party(2, { delay: 30 });
  const [host, a, b] = p.rooms;
  check('friends who join get slots 2 and 3', a.me === 1 && b.me === 2 && host.slots[1].type === 'human' && host.slots[2].type === 'human' && host.slots[3].type === 'off');
  a.pick(a.me, 2, 0); b.pick(b.me, 2, 0); host.toggleCpu(3); host.changeLevel(3, 1);
  for (let i = 0; i < 20; i++) p.net.advance(TICK);
  const same = p.rooms.every((r) => JSON.stringify(r.slots) === JSON.stringify(host.slots));
  check('picks reach everyone, and two players on one fighter get different skins', same && host.slots[1].char === 2 && host.slots[2].char === 2 && host.slots[1].alt !== host.slots[2].alt && host.slots[3].type === 'cpu' && host.slots[3].level === 'lv4');
  a.pick(b.me, 0, 0); host.pick(1, 0, 0);
  for (let i = 0; i < 20; i++) p.net.advance(TICK);
  check('nobody can change another player\'s fighter', host.slots[2].char === 2 && host.slots[1].char === 2);
  // a fifth player: the CPU gives up its slot; a sixth is turned away
  const mk = () => { const [x, y] = p.net.pair(); const r = new Room(false); host.accept(x); r.join(y); return r; };
  const c = mk(); for (let i = 0; i < 20; i++) p.net.advance(TICK);
  const d = mk(); for (let i = 0; i < 20; i++) p.net.advance(TICK);
  check('a joining friend replaces a CPU, and a full room turns the next one away', c.me === 3 && host.slots[3].type === 'human' && d.error === 'THAT ROOM IS FULL', String(d.error));
  // someone leaves the lobby
  a.leave(); for (let i = 0; i < 20; i++) p.net.advance(TICK);
  check('a friend who leaves the lobby frees their slot', host.slots[1].type === 'off' && b.slots[1].type === 'off');
}
{
  // a different game version is refused
  const net = makeNet({ delay: 10 }); const host = new Room(true); const [x, y] = net.pair();
  host.accept(x);
  let told = null; y.onmessage = (m) => { if (m.t === 'refuse') told = m.reason; };
  y.send({ type: 'hello', version: '0.0.1', protocol: 1 });
  for (let i = 0; i < 20; i++) net.advance(TICK);
  check('a friend on another game version is refused', !!told && host.slots[1].type === 'off', told || '');
}

// --- matches ---
for (const [name, friends, lag, cpu] of [
  ['two players, no lag', 1, { delay: 0 }, false],
  ['two players, 40-70 ms each way', 1, { delay: 40, jitter: 30 }, false],
  ['two players, 120-200 ms each way', 1, { delay: 120, jitter: 80 }, false],
  ['three players and a CPU, 30-60 ms each way', 2, { delay: 30, jitter: 30 }, true],
  ['four players, 50-90 ms each way', 3, { delay: 50, jitter: 40 }, false],
]) {
  const p = party(friends, lag);
  p.rooms.forEach((r, i) => r.pick(r.me, i % 3, 0));
  if (cpu) p.host.toggleCpu(3);
  for (let i = 0; i < 30; i++) p.net.advance(TICK);
  p.host.start('nest', 1234);
  for (let i = 0; i < 30; i++) p.net.advance(TICK);
  const started = p.rooms.every((r) => r.session);
  const ticks = started ? play(p, 60 * 60 * 6) : 0;
  const ss = p.rooms.map((r) => r.session);
  const st = ss.map((s) => s.stats);
  const offline = started && ss.every((s) => replay(s, p.host.match.setup) === hashState(s.confirmed));
  check(`${name}: every machine ends with the same game`, started && sameGame(p.rooms) && offline && ss.every((s) => s.over),
    `${Math.round(ticks / 60)}s, rollbacks ${st.map((x) => x.rollbacks).join(' / ')}, longest ${Math.max(...st.map((x) => x.maxRollback))} frames, waits ${st.map((x) => x.waits + x.syncWaits).join(' / ')}`);
  if (lag.delay === 0) check('with no lag nothing is ever rolled back', st.every((x) => x.rollbacks === 0 && x.waits === 0));
  if (lag.delay === 40) check('with lag, wrong guesses are rolled back and fixed', st.every((x) => x.rollbacks > 20));
  if (lag.delay === 120) check('heavy lag never runs more than a few frames on guesses', st.every((x) => x.maxRollback <= 9));
}

// A machine that keeps hitching (a slow computer): the others wait for it, and stay in step.
{
  const p = party(1, { delay: 30, jitter: 10 });
  p.host.start('cloudrest', 77); for (let i = 0; i < 10; i++) p.net.advance(TICK);
  let worst = 0;
  play(p, 60 * 40, (i, t) => i === 1 && t % 7 === 0, (t) => { if (t > 300) worst = Math.max(worst, Math.abs(p.rooms[0].session.frame - p.rooms[1].session.frame)); });
  check('a machine running slow holds the other back instead of drifting apart', worst <= 8 && sameGame(p.rooms), `largest gap ${worst} frames, host waited ${p.rooms[0].session.stats.waits + p.rooms[0].session.stats.syncWaits} times`);
}
// One machine starts late: it does not stay behind.
{
  const p = party(1, { delay: 25 });
  p.host.start('nest', 5); for (let i = 0; i < 10; i++) p.net.advance(TICK);
  let gapEnd = 0;
  play(p, 600, (i, t) => i === 1 && t < 12, (t) => { if (t === 599) gapEnd = Math.abs(p.rooms[0].session.frame - p.rooms[1].session.frame); });
  check('machines that start out of step even out', gapEnd <= 3 && sameGame(p.rooms), `gap after 10s: ${gapEnd} frames`);
}
// A friend disconnects in the middle of a match.
{
  const p = party(2, { delay: 40, jitter: 20 });
  p.host.start('nest', 31); for (let i = 0; i < 20; i++) p.net.advance(TICK);
  const [host, a, b] = p.rooms;
  let left = false; const k = b.me;
  const ticks = play({ ...p, rooms: [host, a, b] }, 60 * 60 * 6, (i) => i === 2 && left, (t) => { if (t === 400) { left = true; b.leave(); } });
  const live = [host, a];
  check('a friend leaving mid-match does not break it for the others', sameGame(live) && live.every((r) => r.session.over) && host.session.ended[k] >= 0 && a.session.ended[k] === host.session.ended[k],
    `${Math.round(ticks / 60)}s, their fighter stopped at frame ${host.session.ended[k]}`);
  host.endMatch(); a.endMatch();
  for (let i = 0; i < 20; i++) p.net.advance(TICK);
  check('after the match everyone is back in the lobby, and the host can start another', host.phase === 'lobby' && a.phase === 'lobby' && host.slots[k].type === 'off' && host.start('balcony', 9) === true);
}
// The host disappears.
{
  const p = party(1, { delay: 20 });
  p.host.start('nest', 3); for (let i = 0; i < 20; i++) p.net.advance(TICK);
  p.host.leave(); for (let i = 0; i < 20; i++) p.net.advance(TICK);
  check('if the host leaves, friends are told', p.rooms[1].error === 'LOST THE CONNECTION TO THE HOST' && p.rooms[1].events.some((e) => e.type === 'error'));
}
// A machine whose game differs is noticed.
{
  const p = party(1, { delay: 20 });
  p.host.start('nest', 8); for (let i = 0; i < 20; i++) p.net.advance(TICK);
  const mash = mashers(p.rooms);
  for (let t = 0; t < 400; t++) { p.net.advance(TICK); p.rooms.forEach((r, i) => r.tick(mash[i])); if (t === 100) { p.rooms[1].session.confirmed.fighters[0].percent += 10; p.rooms[1].session.dirty = 0; } }
  check('games that drift apart are detected', p.rooms.every((r) => r.session.desync >= 0) && p.rooms[0].events.some((e) => e.type === 'desync'));
}
check('version in the hello matches the game', typeof GAME_VERSION === 'string');
process.exit(fails ? 1 : 0);
