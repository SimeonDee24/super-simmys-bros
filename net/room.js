// An online room: the lobby (who is in which slot, with which fighter) and
// the match that is played from it. One machine is the host; everyone else
// connects to the host, and the host passes each player's inputs on to the
// others. No networking in here: a room talks through links (net/links.js).
import { CONFIG } from '../config/config.js';
import { CHARACTERS } from '../characters/index.js';
import { CpuController, CPU_ORDER } from '../engine/cpu.js';
import { RollbackSession } from './session.js';
import { makeHello, checkHello } from './handshake.js';

export const MAX_SLOTS = 4;

// Same fighter in the same skin as someone else: move slot i to a skin nobody
// is using, if the fighter has one left (with more players than skins, some share).
export function freeSkin(slots, i, dir = 1) {
  const sl = slots[i], m = CHARACTERS[sl.char].palettes.length;
  const taken = (alt) => slots.some((o, k) => k !== i && o.type !== 'off' && o.char === sl.char && o.alt === alt);
  for (let k = 0; k < m && taken(sl.alt); k++) sl.alt = (sl.alt + dir + m) % m;
}
const validChar = (c) => Number.isInteger(c) && c >= 0 && c < CHARACTERS.length;

export class Room {
  // first = the host's own fighter pick { char, alt }
  constructor(isHost, first = { char: 0, alt: 0 }) {
    this.isHost = isHost;
    this.id = isHost ? 0 : -1;        // who we are: 0 is the host, friends get 1, 2, 3...
    this.me = isHost ? 0 : -1;        // our slot
    // slot: { type: 'human' | 'cpu' | 'off', owner: id of the machine playing it (-1 for none), char, alt, level }
    this.slots = Array.from({ length: MAX_SLOTS }, (_, i) => ({ type: i === 0 ? 'human' : 'off', owner: i === 0 ? 0 : -1, char: i === 0 ? first.char : i % CHARACTERS.length, alt: i === 0 ? first.alt : 0, level: 'lv3', team: [0, 1, 0, 1][i] }));
    this.mode = 'ffa';                // 'ffa' or 'teams' (the host decides)
    this.phase = 'lobby';             // 'lobby' | 'stage' (host is choosing a stage) | 'match'
    this.hostPhase = 'lobby';
    this.links = new Map();           // host: id -> link to that friend
    this.hostLink = null;             // friend: link to the host
    this.nextId = 1;
    this.session = null;              // the running match (net/session.js)
    this.match = null;                // { setup, ports, owners, levels } of the running match
    this.cpus = [];
    this.events = [];                 // things the screen should react to: { type, text }
    this.error = null;                // set when the room is finished: why
    this.ping = 0;                    // milliseconds there and back
    this.ticks = 0;
    this.matchNo = 0;                 // host: counts matches, so messages from an earlier match are ignored
    this.away = new Set();            // slots whose game is in a background tab (it cannot run there)
  }
  emit(type, text = '') { this.events.push({ type, text }); }
  fail(text) { if (this.error) return; this.error = text; this.emit('error', text); this.leave(); }
  slotOf(id) { return this.slots.findIndex((s) => s.type === 'human' && s.owner === id); }
  activeCount() { return this.slots.filter((s) => s.type !== 'off').length; }

  // ---------- host ----------
  // A friend has connected.
  accept(link) {
    const id = this.nextId++;
    link.joined = false;
    this.links.set(id, link);
    link.onmessage = (m) => this.fromFriend(id, link, m);
    link.onclose = () => this.friendLeft(id);
    link.send(makeHello());
  }
  refuse(id, link, reason) { link.send({ t: 'refuse', reason }); this.links.delete(id); link.onclose = null; setTimeout(() => link.close(), 500); }
  fromFriend(id, link, m) {
    if (!m || typeof m !== 'object') return;
    if (m.type === 'hello') {
      if (link.joined) return;
      const ok = checkHello(m);
      if (!ok.ok) { this.refuse(id, link, 'YOUR GAME VERSION DOES NOT MATCH THE HOST. BOTH REFRESH THE PAGE AND TRY AGAIN'); return; }
      if (this.phase === 'match') { this.refuse(id, link, 'A MATCH IS BEING PLAYED IN THAT ROOM. TRY AGAIN WHEN IT ENDS'); return; }
      // an empty slot first, else take over a CPU's
      let i = this.slots.findIndex((s, k) => k > 0 && s.type === 'off');
      if (i < 0) i = this.slots.findIndex((s, k) => k > 0 && s.type === 'cpu');
      if (i < 0) { this.refuse(id, link, 'THAT ROOM IS FULL'); return; }
      link.joined = true;
      Object.assign(this.slots[i], { type: 'human', owner: id });
      freeSkin(this.slots, i);
      this.emit('joined', 'P' + (i + 1) + ' JOINED');
      this.sendLobby();
      return;
    }
    if (!link.joined) return;
    if (m.t === 'pick') {
      const i = this.slotOf(id);
      if (i < 0 || this.phase === 'match' || !validChar(m.char)) return;
      const sl = this.slots[i], n = CHARACTERS[m.char].palettes.length;
      sl.char = m.char; sl.alt = ((m.alt | 0) % n + n) % n;
      freeSkin(this.slots, i);
      this.sendLobby();
    } else if (m.t === 'team') {
      const i = this.slotOf(id);
      if (i < 0 || this.phase === 'match') return;
      this.slots[i].team = ((m.team | 0) % 3 + 3) % 3;
      this.sendLobby();
    } else if (m.t === 'i') {
      // only the owner of a fighter may send its inputs
      if (!this.session || !this.match || m.m !== this.match.id || this.match.owners[m.s] !== id || !Array.isArray(m.v)) return;
      this.session.receive(m.s, m.f | 0, m.v, typeof m.a === 'number' ? m.a : null);
      for (const [other, l] of this.links) if (other !== id && l.joined) l.send(m);
    } else if (m.t === 'h') {
      if (this.session && m.m === this.match.id) this.session.receiveHash(m.f, m.h);
    } else if (m.t === 'away') {
      const i = this.slotOf(id);
      if (i >= 0) { if (m.v) this.away.add(i); else this.away.delete(i); this.broadcast({ t: 'away', s: i, v: !!m.v }); }
    } else if (m.t === 'p') link.send({ t: 'q', c: m.c });
    else if (m.t === 'q') this.ping = Math.round(performance.now() - m.c);
  }
  friendLeft(id) {
    const link = this.links.get(id);
    this.links.delete(id);
    if (!link || !link.joined) return;
    const i = this.slotOf(id);
    if (i < 0) return;
    if (this.session && this.match) {
      // their fighter stops getting inputs; tell everyone from which frame
      const k = this.match.ports.indexOf(i);
      if (k >= 0 && this.session.ended[k] < 0) {
        const f = this.session.inputs[k].length;
        this.session.drop(k, f);
        this.broadcast({ t: 'drop', s: k, f, m: this.match.id });
      }
    }
    Object.assign(this.slots[i], { type: 'off', owner: -1 });
    this.away.delete(i);
    this.emit('left', 'P' + (i + 1) + ' LEFT');
    this.sendLobby();
  }
  broadcast(m) { for (const l of this.links.values()) if (l.joined) l.send(m); }
  sendLobby() {
    if (!this.isHost) return;
    for (const [id, l] of this.links) if (l.joined) l.send({ t: 'lobby', slots: this.slots, you: id, mode: this.mode, phase: this.phase === 'match' ? 'lobby' : this.phase });
  }
  // Who may change slot i from this machine.
  canEdit(i) {
    const sl = this.slots[i];
    if (this.phase === 'match') return false;
    return this.isHost ? !(sl.type === 'human' && sl.owner !== 0) : i === this.me;
  }
  // Choose a fighter (and skin) for a slot.
  pick(i, char, alt = 0) {
    if (!this.canEdit(i) || !validChar(char)) return;
    if (!this.isHost) { this.hostLink.send({ t: 'pick', char, alt }); return; }
    const sl = this.slots[i], n = CHARACTERS[char].palettes.length;
    if (sl.type === 'off') sl.type = 'cpu';
    sl.char = char; sl.alt = ((alt | 0) % n + n) % n;
    freeSkin(this.slots, i);
    this.sendLobby();
  }
  // Host: add or remove a CPU in slot i. Returns false if that is not allowed.
  toggleCpu(i) {
    const sl = this.slots[i];
    if (!this.isHost || i === 0 || !this.canEdit(i)) return false;
    sl.type = sl.type === 'off' ? 'cpu' : 'off';
    if (sl.type === 'cpu') freeSkin(this.slots, i);
    this.sendLobby();
    return true;
  }
  changeLevel(i, d) {
    const sl = this.slots[i];
    if (!this.isHost || sl.type !== 'cpu') return;
    sl.level = CPU_ORDER[(CPU_ORDER.indexOf(sl.level) + d + CPU_ORDER.length) % CPU_ORDER.length];
    this.sendLobby();
  }
  // Host: free-for-all or teams.
  setMode(mode) {
    if (!this.isHost || this.phase === 'match') return;
    this.mode = mode === 'teams' ? 'teams' : 'ffa';
    this.sendLobby();
  }
  // Change slot i's team (friends: only their own slot).
  setTeam(i, team) {
    if (!this.canEdit(i) || this.slots[i].type === 'off') return;
    team = ((team | 0) % 3 + 3) % 3;
    if (!this.isHost) { this.hostLink.send({ t: 'team', team }); return; }
    this.slots[i].team = team;
    this.sendLobby();
  }
  setPhase(phase) {
    if (!this.isHost || this.phase === 'match') return;
    this.phase = phase;
    this.sendLobby();
  }
  // Host: start the match on this stage. Returns false if there are not two fighters.
  start(stageId, seed = (Math.random() * 0x7fffffff) | 0) {
    if (!this.isHost || this.phase === 'match') return false;
    const ports = this.slots.map((s, i) => (s.type !== 'off' ? i : -1)).filter((i) => i >= 0);
    if (ports.length < 2) return false;
    const teams = this.mode === 'teams' ? ports.map((i) => this.slots[i].team) : null;
    if (teams && new Set(teams).size < 2) return false;
    const info = {
      id: ++this.matchNo,
      setup: { stageId, players: ports.map((i, k) => ({ charId: CHARACTERS[this.slots[i].char].id, alt: this.slots[i].alt, team: teams ? teams[k] : undefined })), stocks: CONFIG.DEFAULT_STOCKS, seed },
      teams,                                                                                  // fighter number -> team, or null in a free-for-all
      ports,                                                                                  // fighter number -> slot
      owners: ports.map((i) => (this.slots[i].type === 'human' ? this.slots[i].owner : 0)),   // fighter number -> machine that plays it
      levels: ports.map((i) => (this.slots[i].type === 'cpu' ? this.slots[i].level : null)),  // CPU level, for CPU fighters
    };
    this.broadcast({ t: 'start', info });
    this.begin(info);
    return true;
  }

  // ---------- friend ----------
  // Connect this room to the host.
  join(link) {
    this.hostLink = link;
    link.onmessage = (m) => this.fromHost(m);
    link.onclose = () => this.fail('LOST THE CONNECTION TO THE HOST');
    link.send(makeHello());
  }
  fromHost(m) {
    if (!m || typeof m !== 'object') return;
    if (m.type === 'hello') { const ok = checkHello(m); if (!ok.ok) this.fail(ok.message.toUpperCase()); }
    else if (m.t === 'refuse') this.fail(String(m.reason));
    else if (m.t === 'lobby') {
      const first = this.me < 0;
      this.slots = m.slots; this.id = m.you; this.me = this.slotOf(m.you); this.mode = m.mode === 'teams' ? 'teams' : 'ffa';
      this.hostPhase = m.phase;
      if (!this.session) this.phase = m.phase;
      if (first) this.emit('entered');
    } else if (m.t === 'start') this.begin(m.info);
    else if (m.t === 'i') { if (this.session && m.m === this.match.id) this.session.receive(m.s, m.f, m.v, typeof m.a === 'number' ? m.a : null); }
    else if (m.t === 'h') { if (this.session && m.m === this.match.id) this.session.receiveHash(m.f, m.h); }
    else if (m.t === 'away') { if (m.v) this.away.add(m.s); else this.away.delete(m.s); }
    else if (m.t === 'drop') { if (this.session && m.m === this.match.id) { this.session.drop(m.s, m.f); this.emit('left', 'P' + (this.match.ports[m.s] + 1) + ' LEFT'); } }
    else if (m.t === 'p') this.hostLink.send({ t: 'q', c: m.c });
    else if (m.t === 'q') this.ping = Math.round(performance.now() - m.c);
  }

  // ---------- both ----------
  begin(info) {
    this.match = info;
    // this machine plays its own fighter; the host also plays the CPUs
    const local = info.owners.map((o, k) => (o === this.id && (info.levels[k] === null || this.isHost) ? k : -1)).filter((k) => k >= 0);
    this.session = new RollbackSession(info.setup, local);
    this.cpus = info.levels.map((lv, k) => (lv !== null && this.isHost ? new CpuController(lv, info.setup.seed ^ (0x2c9 * (k + 1))) : null));
    this.myFighter = info.owners.findIndex((o, k) => o === this.id && info.levels[k] === null);
    this.phase = 'match';
    this.emit('start');
  }
  // One 60 Hz tick. human(state) returns the buttons this player is holding.
  // Returns true if the match moved on a frame.
  tick(human) {
    this.ticks++;
    if (this.ticks % 60 === 0 && !this.error) {
      const p = { t: 'p', c: performance.now() };
      if (this.isHost) { const l = this.links.values().next().value; if (l && l.joined) l.send(p); } else if (this.hostLink) this.hostLink.send(p);
    }
    if (!this.session) return false;
    const s = this.session;
    const moved = s.tick((p, state) => (this.cpus[p] ? this.cpus[p].sample(state, p) : human(state)));
    for (const m of s.outbox) { m.m = this.match.id; if (this.isHost) this.broadcast(m); else this.hostLink.send(m); }
    s.outbox.length = 0;
    if (s.desync >= 0 && !this.toldDesync) { this.toldDesync = true; this.emit('desync'); }
    return moved;
  }
  // Tell the others this game went into (or came back from) a background tab.
  setAway(v) {
    if (this.isHost) { if (v) this.away.add(0); else this.away.delete(0); this.broadcast({ t: 'away', s: 0, v: !!v }); }
    else if (this.hostLink) this.hostLink.send({ t: 'away', v: !!v });
  }
  // While the match is stuck waiting for someone: { slot, away, seconds }, else null.
  waiting() {
    const s = this.session;
    if (!s || s.stuck < 30) return null;
    const k = s.waitingFor();
    if (k < 0) return null;
    const slot = this.match.ports[k];
    return { slot, away: this.away.has(slot), seconds: Math.floor(s.stuck / 60) };
  }
  // Back to the lobby when the match is over.
  endMatch() {
    this.session = null; this.match = null; this.cpus = []; this.toldDesync = false;
    this.phase = this.isHost ? 'lobby' : this.hostPhase;
    this.sendLobby();
  }
  leave() {
    for (const l of this.links.values()) { l.onclose = null; l.close(); }
    this.links.clear();
    if (this.hostLink) { this.hostLink.onclose = null; this.hostLink.close(); this.hostLink = null; }
    this.session = null;
  }
}
