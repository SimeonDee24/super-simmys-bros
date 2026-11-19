// Entry point: owns the fixed 60 Hz loop and switches between screens.
// The simulation (engine/sim.js) is advanced only here, one tick at a time,
// from recorded input bitmasks. Rendering happens separately, once per
// browser frame.
import { CONFIG } from './config/config.js';
import { GAME_VERSION } from './config/version.js';
import { Keyboard, KeyboardSource, InputRecorder } from './engine/input.js';
import { createMatch, step, hashState, teamsLeft } from './engine/sim.js';
import { CpuController, CPU_ORDER, cpuLabel } from './engine/cpu.js';
import { STAGES } from './stages/index.js';
import { CHARACTERS } from './characters/index.js';
import { Renderer, TEAM_COLORS } from './render/renderer.js';
import { loadSettings, saveSettings } from './ui/settings.js';
import { checkForUpdate, UPDATE_MESSAGE } from './ui/updatecheck.js';
import { sfx } from './audio/sfx.js';
import { SoundDirector } from './audio/director.js';
import { Room, freeSkin, RANDOM, resolveRandom } from './net/room.js';
import { hostOnline, joinOnline, CODE_LENGTH, CODE_LETTERS } from './net/peer.js';

const settings = loadSettings();
sfx.setVolume(settings.volume);
sfx.setMuted(settings.muted);
const director = new SoundDirector();   // turns what happens in a match into sounds
const renderer = new Renderer(document.getElementById('game'));
// The menu fonts (Inter Display, see assets/fonts/OFL.txt). Text uses system
// fonts until they arrive, then switches on the next frame.
for (const [name, file, desc] of [['Brawl Heading', 'InterDisplay-BlackItalic', { style: 'italic', weight: '900' }], ['Brawl UI', 'InterDisplay-ExtraBold', { weight: '800' }]]) {
  try { new FontFace(name, 'url(assets/fonts/' + file + '.woff?v=' + GAME_VERSION + ')', desc).load().then((f) => document.fonts.add(f), () => {}); } catch (e) { /* old browser: system fonts */ }
}
const keyboard = new Keyboard();
['F1', 'F2', 'Escape', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].forEach((k) => keyboard.blocked.add(k));

let screen = 'title';   // 'title' | 'menu' | 'join' | 'charSelect' | 'stageSelect' | 'match'
let match = null;       // { state, sources, recorder, endTimer }, or { online: true, state, endTimer }
// Online play: the room we are in (net/room.js), its code, and how to hang up.
let online = null;      // { room, code, close() }
const MENU = ['PLAY ON THIS COMPUTER', 'HOST AN ONLINE ROOM', 'JOIN AN ONLINE ROOM'];
let menuIndex = 0, menuNote = '';
let joinCode = '', joinStatus = '';
let attempt = 0;        // counts connection attempts, so one that was cancelled is ignored when it finishes
const keySource = new KeyboardSource(keyboard, settings.bindings, () => settings.tapJump);
// Stage select tiles: every stage, then Random.
const stageTiles = [...STAGES.map((stage) => ({ stage })), { random: true }];
let stageIndex = 0;
let paused = false;
let toast = null;       // short message at the top of the screen, e.g. after a hotkey
let updateMessage = null;
let fps = 0, fpsFrames = 0, fpsTime = 0, slowSeconds = 0;

let selSlot = 0;        // fighter select: the slot the keys are moving
// Fighter select, like Smash: a hand you move with W A S D (or the mouse).
// J picks up a token and puts it down on a fighter; while it is in the hand
// the panel shows whoever the hand is over.
const cursor = { x: 240, y: 80, held: -1, speed: 0, was: '' };

// The four saved fighter slots, kept valid if the roster changes. Slot 1 is
// always the keyboard player, and there are always at least two fighters.
function slots() {
  const ss = settings.slots, n = CHARACTERS.length;
  ss.forEach((sl, i) => {
    if (sl.char !== RANDOM) {
      sl.char = ((sl.char | 0) % n + n) % n;
      sl.alt = ((sl.alt | 0) % CHARACTERS[sl.char].palettes.length + CHARACTERS[sl.char].palettes.length) % CHARACTERS[sl.char].palettes.length;
    } else sl.alt = 0;
    if (!CPU_ORDER.includes(sl.level)) sl.level = 'lv3';
    if (!(sl.team >= 0 && sl.team <= 2)) sl.team = [0, 1, 0, 1][i];
    sl.type = i === 0 ? 'human' : sl.type === 'off' ? 'off' : 'cpu';
  });
  if (!ss.some((sl, i) => i > 0 && sl.type !== 'off')) ss[1].type = 'cpu';
  return ss;
}
// The slots shown on the fighter select: the room's when online, else the saved ones.
const lobbySlots = () => (online ? online.room.slots : slots());
// The slot this player's keys change: friends in a room only have their own.
const curSlot = () => (online && !online.room.isHost ? Math.max(0, online.room.me) : selSlot);

// Teams: how many different teams the fighters in these slots are on.
const teamCount = (ss) => new Set(ss.filter((sl) => sl.type !== 'off').map((sl) => sl.team | 0)).size;
const teamsOn = () => (online ? online.room.mode === 'teams' : settings.mode === 'teams');

function startMatch(stage = STAGES[0]) {
  const active = resolveRandom(slots()).map((sl, port) => ({ ...sl, port })).filter((sl) => sl.type !== 'off');   // Random picks are drawn here
  const state = createMatch({
    stageId: stage.id,
    players: active.map((sl) => ({ charId: CHARACTERS[sl.char].id, alt: sl.alt, team: settings.mode === 'teams' ? sl.team : undefined })),
    stocks: CONFIG.DEFAULT_STOCKS,
    seed: CONFIG.DEFAULT_SEED,
  });
  match = {
    state,
    sources: active.map((sl) => (sl.type === 'human'
      ? new KeyboardSource(keyboard, settings.bindings, () => settings.tapJump)
      : new CpuController(sl.level, CONFIG.DEFAULT_SEED ^ (0x2c9 * sl.port)))),
    recorder: new InputRecorder(active.length),
    endTimer: 0,
  };
  renderer.setPlayers(active.map((sl) => ({ port: sl.port, label: sl.type === 'human' ? 'P' + (sl.port + 1) : 'CPU', color: settings.mode === 'teams' ? TEAM_COLORS[sl.team] : null })));
  renderer.resetEffects();
  director.reset();
  sfx.play('start');
  paused = false;
  screen = 'match';
}

// --- Online ---
function startOnlineMatch() {
  const room = online.room, info = room.match;
  match = { online: true, state: room.session.state, endTimer: 0 };
  renderer.setPlayers(info.ports.map((port, k) => ({ port, label: info.levels[k] !== null ? 'CPU' : 'P' + (port + 1), color: info.teams ? TEAM_COLORS[info.teams[k]] : null })));
  renderer.resetEffects();
  director.reset();
  sfx.play('start');
  paused = false;
  screen = 'match';
}
function leaveOnline() {
  attempt++;
  if (online) { online.room.leave(); online.close(); online = null; }
  if (match && match.online) match = null;
  paused = false;
}
function say(text, ms = 2600) { toast = { text, until: performance.now() + ms }; }
// Open a room and wait in its lobby for friends.
function hostRoom() {
  const mine = slots()[0], room = new Room(true, { char: mine.char, alt: mine.alt }), my = ++attempt;
  menuNote = 'OPENING A ROOM...';
  hostOnline((link) => room.accept(link)).then((r) => {
    if (my !== attempt) { r.close(); return; }
    enterRoom(room, r.code, r.close);
  }).catch((e) => { if (my === attempt) { menuNote = ''; say(e.message, 4000); sfx.play('menuBack'); } });
}
function enterRoom(room, code, close) {
  online = { room, code, close };
  menuNote = ''; selSlot = 0; screen = 'charSelect';
  sfx.play('menuOk');
}
// Join the room whose code was typed.
function joinRoom(code) {
  const my = ++attempt;
  joinStatus = 'CONNECTING...';
  joinOnline(code, (text) => { if (my === attempt) joinStatus = text; }).then((link) => {
    if (my !== attempt) { link.close(); return; }
    const room = new Room(false);
    online = { room, code, close: () => link.close() };
    room.join(link);   // the lobby opens when the host answers (see roomEvents)
  }).catch((e) => { if (my === attempt) { joinStatus = e.message; joinCode = ''; sfx.play('menuBack'); } });
}
// React to what happened in the room since the last tick.
function roomEvents() {
  if (!online) return;
  const room = online.room, events = room.events.splice(0);
  for (const e of events) {
    if (e.type === 'entered') { screen = 'charSelect'; joinStatus = ''; sfx.play('menuOk'); try { sessionStorage.removeItem('updatedFor'); } catch (err) { /* fine */ } }
    else if (e.type === 'waiting') joinStatus = 'CONNECTED. THE HOST IS IN A MATCH: YOU WILL JOIN WHEN IT ENDS';
    else if (e.type === 'outdated') {
      // our game is out of date: reload to get the new version, then rejoin this room by itself
      // (only once: if it is still out of date after that, say what to do instead of reloading forever)
      let again = false;
      try { again = sessionStorage.getItem('updatedFor') === online.code; if (!again) { sessionStorage.setItem('rejoin', online.code); sessionStorage.setItem('updatedFor', online.code); } } catch (err) { /* private mode: they type it again */ }
      const code = online.code;
      leaveOnline();
      if (again) { joinCode = ''; joinStatus = ''; screen = 'menu'; say('YOUR GAME IS STILL OUT OF DATE. CLOSE THIS TAB, OPEN THE GAME AGAIN AND REJOIN', 6000); sfx.play('menuBack'); }
      else { joinCode = code; joinStatus = 'UPDATING YOUR GAME...'; setTimeout(() => location.reload(), 600); }
      return;
    }
    else if (e.type === 'joined') { say(e.text, 1800); sfx.play('menuOk'); }
    else if (e.type === 'left') { say(e.text, 1800); sfx.play('menuBack'); }
    else if (e.type === 'start') startOnlineMatch();
    else if (e.type === 'desync') say('THE GAMES WENT OUT OF SYNC. THIS MATCH MAY NOT LOOK THE SAME FOR EVERYONE', 6000);
    else if (e.type === 'error') {
      leaveOnline(); joinCode = ''; joinStatus = ''; screen = 'menu';
      say(e.text, 6000); sfx.play('menuBack');
      return;
    }
  }
}

function tick() {
  roomEvents();
  if (online && screen === 'match' && match && match.online) {
    // Online: the room runs the match (with rollback) and tells us if it moved on a frame.
    const room = online.room;
    const moved = room.tick(() => keySource.sample());
    match.state = room.session.state;
    if (moved) for (const e of director.update(match.state)) sfx.play(e.name, e.strength, e.pan);
    if (room.session.over && ++match.endTimer >= CONFIG.GAME_END_FRAMES) {
      room.endMatch(); match = null; paused = false; selSlot = 0; screen = 'charSelect';
    }
  } else if (online) online.room.tick(() => 0);
  else if (screen === 'match' && !paused) {
    const inputs = match.sources.map((s, i) => s.sample(match.state, i));
    match.recorder.push(inputs);
    step(match.state, inputs);
    for (const e of director.update(match.state)) sfx.play(e.name, e.strength, e.pan);
    // One fighter (or nobody) left standing: show GAME!, then leave. (The
    // victory screen replaces this in milestone 5.)
    if (teamsLeft(match.state) <= 1 && ++match.endTimer >= CONFIG.GAME_END_FRAMES) {
      screen = 'stageSelect'; match = null;
    }
  }
  if (screen === 'charSelect') moveCursor();
  cursor.was = screen;
  keyboard.endTick();
}

// --- Fighter select hand ---
const SEL_KEYS = { left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'] };
const heldAny = (codes) => codes.some((c) => keyboard.held(c));
// Which slots this player may pick up: their own; offline or as host, CPUs too.
function canHold(i) {
  const sl = lobbySlots()[i];
  if (!sl || sl.type === 'off') return false;
  if (!online) return true;
  return online.room.isHost ? online.room.canEdit(i) : i === online.room.me;
}
const tileUnder = (x, y) => { const n = CHARACTERS.length + 1; for (let k = 0; k < n; k++) { const r = renderer.charTileRect(k, n); if (x >= r.x - 2 && x < r.x + r.w + 2 && y >= r.y - 2 && y < r.y + r.h + 2) return k; } return -1; };
const panelUnder = (x, y) => { for (let i = 0; i < 4; i++) { const r = renderer.slotPanelRect(i); if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return i; } return -1; };
function tokenUnder(x, y) {
  const spots = renderer.tokenSpots(CHARACTERS, lobbySlots(), cursor.held);
  let best = -1, bd = 12 * 12;   // (a generous reach: the token is small)
  for (const i of Object.keys(spots).map(Number)) {
    const dx = spots[i].x - x, dy = spots[i].y - y, d = dx * dx + dy * dy;
    if (canHold(i) && (d < bd || (d === bd && i === curSlot()))) { best = i; bd = d; }
  }
  return best;
}
function moveCursor() {
  // coming into the screen: the hand starts over your own fighter. Coming
  // from the menu it is holding your token, ready to put down (as in Smash);
  // coming back from a match your pick stays where it was.
  if (cursor.was !== 'charSelect') {
    const r = renderer.charTileRect(charTile(lobbySlots()[curSlot()].char), CHARACTERS.length + 1);
    cursor.x = r.x + r.w / 2; cursor.y = r.y + r.h / 2 + 4; cursor.speed = 0;
    cursor.held = (cursor.was === 'menu' || cursor.was === 'join') && canHold(curSlot()) ? curSlot() : -1;
  }
  if (cursor.held >= 0 && !canHold(cursor.held)) cursor.held = -1;   // (a friend left, the slot was switched off...)
  const dx = heldAny(SEL_KEYS.right) - heldAny(SEL_KEYS.left), dy = heldAny(SEL_KEYS.down) - heldAny(SEL_KEYS.up);
  // speeds up the longer it is held, so it is quick across the screen and precise in small taps
  cursor.speed = dx || dy ? Math.min(4.6, cursor.speed + 0.3) : 1.4;
  const k = dx && dy ? 0.72 : 1;
  cursor.x = Math.max(2, Math.min(CONFIG.SCREEN_W - 2, cursor.x + dx * cursor.speed * k));
  cursor.y = Math.max(24, Math.min(CONFIG.SCREEN_H - 14, cursor.y + dy * cursor.speed * k));
  // carrying a token over a fighter shows them in that slot's panel straight away
  if (cursor.held >= 0) {
    const t = tileUnder(cursor.x, cursor.y);
    if (t >= 0 && lobbySlots()[cursor.held].char !== tileChar(t)) pickChar(cursor.held, tileChar(t));
  }
}
// J (or a click): pick up a token, put it down, or press what the hand is on.
function selectPress() {
  const t = tileUnder(cursor.x, cursor.y);
  if (cursor.held >= 0) {
    if (t >= 0) { pickChar(cursor.held, tileChar(t)); cursor.held = -1; sfx.play('menuOk'); }
    else sfx.play('menuBack');
    return;
  }
  const tok = tokenUnder(cursor.x, cursor.y);
  if (tok >= 0) { cursor.held = tok; if (!online || online.room.isHost) selSlot = tok; sfx.play('menuMove'); return; }
  // straight onto a fighter: puts your own token there
  if (t >= 0) { pickChar(curSlot(), tileChar(t)); sfx.play('menuOk'); return; }
  const p = panelUnder(cursor.x, cursor.y);
  if (p >= 0) { pressPanel(p, cursor.y - renderer.slotPanelRect(p).y); sfx.play('menuMove'); return; }
  goFromSelect();
}
// A player panel: the coloured header switches a CPU off, the rest selects the slot
// (or changes skin if it is already the selected one).
function pressPanel(i, dy) {
  if (dy < 13 && i > 0 && lobbySlots()[i].type === 'cpu') toggleSlot(i);
  else if (i === curSlot() && lobbySlots()[i].type !== 'off') nextSkin(i);
  else selectSlot(i);
}
// On to the stage select (or tell them why not).
function goFromSelect() {
  if (cursor.held >= 0) cursor.held = -1;   // put down the token where it is
  if (teamsOn() && teamCount(lobbySlots()) < 2) say('PUT FIGHTERS ON AT LEAST TWO TEAMS (Y CHANGES TEAM)', 2600);
  else if (!online) screen = 'stageSelect';
  else if (!online.room.isHost) say('THE HOST STARTS THE MATCH', 1600);
  else if (online.room.activeCount() < 2) say('WAIT FOR A FRIEND TO JOIN, OR PRESS 2 TO ADD A CPU', 2600);
  else { online.room.setPhase('stage'); screen = 'stageSelect'; }
}

function render() {
  drawScreen();
  // sound switched off (M): say so in the corner, so it is never a mystery
  if (settings.muted) renderer.drawMuted();
  if (online && match && match.online) {
    const w = online.room.waiting();
    if (w) {
      const who = w.slot === online.room.me ? 'YOU' : 'P' + (w.slot + 1);
      renderer.drawWaiting(w.away ? who + '\'S GAME IS MINIMISED OR IN ANOTHER TAB' : 'WAITING FOR ' + who + '...',
        w.seconds >= 8 ? (w.away ? 'IT CANNOT RUN THERE. ASK THEM TO SWITCH BACK.  ' : 'THEIR CONNECTION MAY HAVE DROPPED.  ') + 'ESC THEN Q LEAVES THE ROOM' : '');
    }
  }
  if (toast) {
    const left = toast.until - performance.now();
    if (left <= 0) toast = null;
    else renderer.drawToast(toast.text, Math.min(1, left / 300));
  }
}

function drawScreen() {
  if (screen === 'title') {
    renderer.drawTitle(STAGES[0], { charId: CHARACTERS[0].id, updateMessage });
    return;
  }
  if (screen === 'menu') { renderer.drawMenu('PLAY', MENU, menuIndex, menuNote || ['', 'YOU GET A ROOM CODE TO GIVE TO YOUR FRIENDS', 'TYPE THE ROOM CODE A FRIEND GAVE YOU'][menuIndex]); return; }
  if (screen === 'join') { renderer.drawJoin(joinCode, CODE_LENGTH, joinStatus); return; }
  if (screen === 'charSelect' && online) {
    const room = online.room, host = room.isHost;
    renderer.drawCharSelect(CHARACTERS, room.slots, curSlot(), (i) => cpuLabel(room.slots[i].level), {
      title: 'ROOM CODE  ' + online.code,
      right: host ? 'ENTER  STAGE   ESC  CLOSE ROOM' : 'ESC  LEAVE',
      tag: (i) => (i === room.me ? 'YOU' : room.slots[i].owner === 0 ? 'HOST' : 'FRIEND'),
      offText: (i) => (host ? 'OPEN.  ' + (i + 1) + '  ADDS A CPU' : 'OPEN'),
      hint: host ? null : 'W A S D  MOVE     J  PICK UP / PUT DOWN     K  SKIN' + (room.mode === 'teams' ? '     Y  TEAM' : ''),
      teams: room.mode === 'teams', modeKey: host,
      banner: !host && room.phase === 'stage' ? 'THE HOST IS CHOOSING A STAGE' : null,
      cursor: { x: cursor.x, y: cursor.y, held: cursor.held, own: curSlot() },
      ready: host ? 'READY TO FIGHT!   PRESS ENTER' : null,
    });
    return;
  }
  if (screen === 'charSelect') {
    renderer.drawCharSelect(CHARACTERS, slots(), selSlot, (i) => cpuLabel(slots()[i].level), {
      teams: settings.mode === 'teams', cursor: { x: cursor.x, y: cursor.y, held: cursor.held, own: 0 }, ready: 'READY TO FIGHT!   PRESS ENTER' });
    return;
  }
  if (screen === 'stageSelect') { renderer.drawStageSelect(stageTiles, stageIndex); return; }
  const opts = { showBoxes: settings.showBoxes };
  if (settings.showDebug) {
    const f = match.state.fighters[0];
    opts.debugLines = [
      'TICK ' + match.state.tick + '  HASH ' + hashState(match.state) + '  FPS ' + fps,
      'P1 ' + (f.move || f.state) + ' ' + f.stateFrame + '  VX ' + f.vx + ' VY ' + f.vy + '  SHIELD ' + (f.shieldHp / 1000).toFixed(1),
    ];
    if (match.online) {
      const se = online.room.session, st = se.stats;
      opts.debugLines.push('ONLINE  PING ' + online.room.ping + ' MS  GUESSING ' + (se.frame - se.cframe) + ' FRAMES  ROLLBACKS ' + st.rollbacks + ' (LONGEST ' + st.maxRollback + ')  WAITS ' + (st.waits + st.syncWaits));
    }
  }
  renderer.drawMatch(match.state, opts);
  if (match.endTimer > 0) renderer.drawBanner('GAME!');
  if (paused) {
    // Two pages (A / D or Tab turns; online only Tab, since the match keeps going): the controls, then the specials of the fighters in this match.
    const who = new Set(match.state.fighters.map((f) => f.charId));
    const fighters = Object.entries(FIGHTER_HELP).filter(([id]) => who.has(id)).flatMap(([, l]) => l);
    const head = [
      match.online ? 'CONTROLS  (ONLINE MATCHES CANNOT BE PAUSED)' : 'PAUSED',
      (match.online ? 'ESC  CLOSE         Q  LEAVE THE ROOM' : 'ESC  RESUME        Q  QUIT TO STAGE SELECT') + '        ' + (match.online ? 'TAB' : 'A / D') + '  PAGE ' + (helpPage + 1) + ' OF 2',
      '',
    ];
    renderer.drawPause(head.concat(helpPage === 0 ? [
      'MOVE  W A S D      DOUBLE-TAP A / D TO DASH AND RUN',
      'JUMP  SPACE        TAP = SHORT HOP, HOLD = FULL HOP',
      'FAST FALL  TAP S AT OR AFTER THE TOP OF A JUMP',
      'CROUCH  HOLD S    (HOLD S + A / D TO CRAWL)',
      'PLATFORMS  JUMP UP THROUGH THEM.  TAP S WHILE STANDING ON ONE TO DROP THROUGH',
      'SHIELD  HOLD I.  + A / D = ROLL, + S = SPOT DODGE, + SPACE = JUMP OUT',
      '        LET GO JUST BEFORE A HIT LANDS TO PARRY.   I IN THE AIR = AIR DODGE',
      'GRAB  U (OR SHIELD + J).  THEN A / D / W / S = THROW THAT WAY, J = PUMMEL',
      'SMASH  L (+ W / S FOR UP / DOWN), OR TAP A DIRECTION AND PRESS J RIGHT AFTER.  HOLD TO CHARGE',
      'ATTACK  J    ON THE GROUND: JAB (PRESS AGAIN FOR 1-2-3), A / D = FORWARD TILT,',
      '             W = UP TILT, S = DOWN TILT',
      '             IN THE AIR: NEUTRAL, FORWARD, BACK, W = UP, S = DOWN AIR',
      '             WHILE DASHING OR RUNNING: DASH ATTACK',
      'DI  HOLD A DIRECTION WHEN HIT TO BEND YOUR LAUNCH (UP AND IN TO SURVIVE)',
      'TECH  PRESS I JUST BEFORE HITTING THE FLOOR, A WALL OR THE CEILING WHILE TUMBLING',
      '      (+ A / D TO TECH ROLL).  MASHING I WILL NOT WORK',
      'KNOCKED DOWN  J = GETUP ATTACK, A / D = ROLL, SPACE OR W = STAND UP',
      'LEDGE  GRABBED AUTOMATICALLY WHEN FALLING NEXT TO IT',
      '       TOWARD STAGE = GET UP, J = LEDGE ATTACK, I = LEDGE ROLL, SPACE = JUMP, S = DROP',
    ] : [
      'SPECIAL  K ALONE, OR WITH A / D, W OR S. EACH FIGHTER HAS FOUR:',
      '',
      ...fighters,
      '',
      'M  SOUND ON / OFF      0  TAP JUMP ON / OFF (W ALSO JUMPS)  NOW ' + (settings.tapJump ? 'ON' : 'OFF'),
      'F1  DEBUG INFO AND STATE HASH',
      'F2  HITBOXES (RED), HURTBOXES (YELLOW), LEDGE BOXES',
    ]));
  }
}

// Each fighter's specials, for the pause screen (two lines each).
const FIGHTER_HELP = {
  simeon: [' SIMEON  K = JUMP SHOT (HOLD TO CHARGE)     A / D + K = COMBO BREAKER (PRESS K UP TO 4 TIMES; + W / S CHANGES SWINGS)', '         W + K = ALLEY-OOP (RISING KICKS)   S + K = BLUFF (COUNTER)'],
  kaelyn: [' KAELYN  K = PUFF PASS (BOOMERANG)          A / D + K = ROLL OUT (SKATING DASH INTO AN UPPERCUT)', '         W + K = KICKFLIP (RISE, THEN DIVE) S + K = HALF PIPE (FLIP JUMP; PRESS K OR J AGAIN TO KICK)'],
  luca: ['   LUCA  K = BASS DROP (HOLD TO CHARGE)      A / D + K = SUPPLY & DEMAND (TAP: UP ARROW, HOLD: CRASH)', '         W + K = WIRE TRANSFER (TELEPORT)   S + K = STAGE DIVE (LEAPING KICK)'],
  sara: ['   SARA  K = TO-GO (CUP. HOLD: DOUBLE SHOT)  A / D + K = BOARDING CALL (RIDES HER SUITCASE FORWARD)', '         W + K = TAKEOFF (PAPER PLANE, STEER) S + K = FRESH POT (SWING, AND COFFEE ALONG THE FLOOR)'],
  malcolm: ['MALCOLM  K = PICK A CARD (THREE CARDS)     A / D + K = CORNER POCKET (CUE BALL ALONG THE FLOOR)', '         W + K = MUSCLE-UP (RISING)        S + K = ACE UP THE SLEEVE (LEAVES A CARD TRAP)'],
  max: ['    MAX  K = MONEY GUN (HOLD TO SPRAY CASH)       A / D + K = HOSTILE TAKEOVER (BELLY CHARGE)', '         W + K = GOLDEN PARACHUTE (RISE, FLOAT DOWN)  S + K = MARKET CRASH (HOP, THEN DROP LIKE A STONE)'],
  osama: ['  OSAMA  K = OIL BEAM (K CHARGES, K FIRES, SHIELD SAVES)    A / D + K = SUPLEX (SHOOT IN, SLAM THEM BEHIND)', '         W + K = JET MODE (BECOMES A PLANE)  S + K = GROUND AND POUND (HAMMER FISTS)'],
  zeid: ['   ZEID  K = CLOUD CHASER (A CLOUD THAT HANGS)  A / D + K = FLICK (A BOUNCING LIT BUTT)', '         W + K = BIG RIP (RIDE THE PLUME UP)  S + K = BOMB (HOLD IT, J TO THROW)'],
  matt: ['   MATT  K = FRISBEE (FLIES OUT AND COMES BACK)     A / D + K = SPIKE (TOSS, THEN K AGAIN SPIKES IT EARLY)', '         W + K = FLASH (BLINK THAT WAY)   S + K = OOF! (BURST INTO BLOCKS)'],
  ginger: [' GINGER  K = ICE CREAM TRUCK (ROLLS ALONG THE FLOOR)   A / D + K = SURF\'S UP (RIDES A WAVE)', '         W + K = TORNADO KICK (SPINS UP KICKING)   S + K = SNACK BREAK (EATS ICE CREAM, HEALS 4%)'],
  faybua: [' FAYBUA  K = COOKIE TOSS (FLAT AND FAST)     A / D + K = GIDDY UP (GALLOPS FORWARD ON HER HORSE)', '         W + K = OLLIE (RIDES HER BOARD UP)   S + K = SERVE! (POSE: COUNTERS A HIT WITH A FLASH)'],
  sam: ['    SAM  K = POWDER BLAST (HOLD: A STREAM)  A / D + K = OBJECTION! (GAVEL LUNGE)', '         W + K = APPEAL (SPIN UP WITH THE GAVEL)  S + K = FALCON KICK (SLIDE, OR DIVE IN THE AIR)'],
};
let helpPage = 0;   // pause screen page

// An online game cannot run in a background tab: tell the others why it stopped.
document.addEventListener('visibilitychange', () => { if (online) online.room.setAway(document.visibilityState === 'hidden'); });

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'F8' && crash) {
    navigator.clipboard.writeText(crash.details).then(() => say('ERROR DETAILS COPIED. PASTE THEM TO CLAUDE', 3000), () => say('COULD NOT COPY. TAKE A SCREENSHOT INSTEAD', 3000));
    return;
  }
  sfx.unlock();
  // typing a room code comes first: its letters must not set off the hotkeys below
  if (screen === 'join') {
    if (e.code === 'Escape') { attempt++; if (online) leaveOnline(); joinCode = ''; joinStatus = ''; screen = 'menu'; sfx.play('menuBack'); }
    else if (e.code === 'Backspace') { if (joinStatus !== 'CONNECTING...') { joinCode = joinCode.slice(0, -1); joinStatus = ''; } }
    else if (/^Key[A-Z]$/.test(e.code) && joinStatus !== 'CONNECTING...') {
      const ch = e.code[3];
      if (!CODE_LETTERS.includes(ch)) { joinStatus = 'ROOM CODES NEVER USE THE LETTERS I OR O'; return; }
      if (joinCode.length < CODE_LENGTH) { joinCode += ch; joinStatus = ''; sfx.play('menuMove'); }
      if (joinCode.length === CODE_LENGTH) joinRoom(joinCode);
    }
    return;
  }
  // M mutes and unmutes the sound on any screen
  // 0 switches tap jump (W also jumps) on and off, on any screen
  if (e.code === 'Digit0' || e.code === 'Numpad0') {
    settings.tapJump = !settings.tapJump; saveSettings(settings);
    sfx.play(settings.tapJump ? 'menuOk' : 'menuBack');
    toast = { text: 'TAP JUMP ' + (settings.tapJump ? 'ON: W ALSO JUMPS' : 'OFF: ONLY SPACE JUMPS'), until: performance.now() + 1800 };
    return;
  }
  if (e.code === 'KeyM') { settings.muted = !settings.muted; sfx.setMuted(settings.muted); saveSettings(settings); if (!settings.muted) sfx.play('menuOk'); say(settings.muted ? 'SOUND OFF  (M TURNS IT BACK ON)' : 'SOUND ON', 1600); return; }
  menuSound(e.code);
  if (screen === 'title') {
    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.code !== 'F5' && e.code !== 'F12') screen = 'menu';
    return;
  }
  if (screen === 'menu') {
    const c = e.code, n = MENU.length;
    if (menuNote) { if (c === 'Escape') { attempt++; menuNote = ''; } return; }   // opening a room: Esc cancels
    if (c === 'KeyW' || c === 'ArrowUp') menuIndex = (menuIndex + n - 1) % n;
    else if (c === 'KeyS' || c === 'ArrowDown') menuIndex = (menuIndex + 1) % n;
    else if (c === 'KeyJ' || c === 'Enter' || c === 'Space') {
      if (menuIndex === 0) screen = 'charSelect';
      else if (menuIndex === 1) hostRoom();
      else { joinCode = ''; joinStatus = ''; screen = 'join'; }
    }
    else if (c === 'Escape') screen = 'title';
    return;
  }
  if (screen === 'charSelect') {
    const c = e.code, at = curSlot(), sl = lobbySlots()[at], n = CHARACTERS.length;
    const digit = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(c) >= 0 ? ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(c) : ['Numpad1', 'Numpad2', 'Numpad3', 'Numpad4'].indexOf(c);
    if (digit >= 0) selectSlot(digit);
    else if (c === 'Tab') selectSlot((selSlot + (e.shiftKey ? 3 : 1)) % 4, false);
    // (W A S D and the arrows move the hand: see moveCursor)
    else if (c === 'KeyJ') selectPress();
    else if (c === 'KeyK') { const p = panelUnder(cursor.x, cursor.y); nextSkin(cursor.held >= 0 ? cursor.held : p >= 0 && canHold(p) ? p : at); }
    else if (c === 'KeyL') toggleSlot(at);
    else if (c === 'KeyU' || c === 'KeyI') changeLevel(at, c === 'KeyU' ? -1 : 1);
    else if (c === 'KeyT') toggleMode();
    else if (c === 'KeyY') nextTeam(at);
    else if (c === 'Enter' || c === 'Space') goFromSelect();
    else if (c === 'Escape') { if (cursor.held >= 0) cursor.held = -1; else { if (online) leaveOnline(); screen = 'menu'; } }
    return;
  }
  if (screen === 'stageSelect') {
    const n = stageTiles.length;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') stageIndex = (stageIndex + n - 1) % n;
    else if (e.code === 'KeyD' || e.code === 'ArrowRight') stageIndex = (stageIndex + 1) % n;
    else if (e.code === 'KeyJ' || e.code === 'Enter' || e.code === 'Space') chooseStage(stageIndex);
    else if (e.code === 'Escape') { if (online) online.room.setPhase('lobby'); screen = 'charSelect'; }
    return;
  }
  if (paused && (e.code === 'Tab' || (!(match && match.online) && ['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight'].includes(e.code)))) { helpPage = 1 - helpPage; sfx.play('menuMove'); return; }
  if (e.code === 'Escape') { paused = !paused; helpPage = 0; }
  else if (e.code === 'KeyQ' && paused && online) { leaveOnline(); screen = 'menu'; }
  else if (e.code === 'KeyQ' && paused) { screen = 'stageSelect'; match = null; }
  else if (e.code === 'F1') { settings.showDebug = !settings.showDebug; saveSettings(settings); }
  else if (e.code === 'F2') { settings.showBoxes = !settings.showBoxes; saveSettings(settings); }
});

// --- Fighter select actions (shared by the keys and the mouse) ---
// Make a slot the one the keys move. Choosing a slot that is off adds it as a CPU.
function selectSlot(i, turnOn = true) {
  if (online) {
    const room = online.room;
    if (!room.isHost) return;   // friends only have their own slot
    if (!room.canEdit(i)) { say('THAT SLOT IS A FRIEND\'S', 1400); return; }
    selSlot = i;
    if (turnOn && room.slots[i].type === 'off') room.toggleCpu(i);
    return;
  }
  selSlot = i;
  const sl = slots()[i];
  if (turnOn && sl.type === 'off') { sl.type = 'cpu'; freeSkin(slots(), i); }
  saveSettings(settings);
}
// Roster position k: a fighter, or the Random tile after the last one.
const tileChar = (k) => (k >= CHARACTERS.length ? RANDOM : k);
const charTile = (char) => (char === RANDOM ? CHARACTERS.length : char);
function pickChar(i, char) {
  if (online) { online.room.pick(i, char, 0); return; }
  const sl = slots()[i];
  if (sl.type === 'off') sl.type = 'cpu';
  sl.char = char; sl.alt = 0;
  freeSkin(slots(), i);
  saveSettings(settings);
}
function nextSkin(i) {
  const sl = lobbySlots()[i];
  if (sl.type === 'off' || sl.char === RANDOM) return;
  if (online) { online.room.pick(i, sl.char, sl.alt + 1); return; }
  sl.alt = (sl.alt + 1) % CHARACTERS[sl.char].palettes.length;
  freeSkin(slots(), i);
  saveSettings(settings);
}
// Slots 2-4 can be switched between CPU and off, as long as two fighters remain.
function toggleSlot(i) {
  if (online) {
    if (!online.room.isHost) return;
    if (i === 0) say('THAT IS YOUR OWN SLOT', 1400);
    else if (!online.room.toggleCpu(i)) say('THAT SLOT IS A FRIEND\'S', 1400);
    return;
  }
  const ss = slots(), sl = ss[i];
  if (i === 0) { say('PLAYER 1 IS ALWAYS IN', 1400); return; }
  if (sl.type === 'off') { sl.type = 'cpu'; freeSkin(ss, i); }
  else if (ss.filter((o) => o.type !== 'off').length > 2) sl.type = 'off';
  else say('A MATCH NEEDS AT LEAST TWO FIGHTERS', 1600);
  saveSettings(settings);
}
// Free-for-all or teams. Online, only the host decides.
function toggleMode() {
  if (online) { if (online.room.isHost) online.room.setMode(online.room.mode === 'teams' ? 'ffa' : 'teams'); else say('THE HOST CHOOSES TEAMS OR FREE-FOR-ALL', 1600); return; }
  settings.mode = settings.mode === 'teams' ? 'ffa' : 'teams';
  saveSettings(settings);
}
// Red, then blue, then green.
function nextTeam(i) {
  if (!teamsOn()) { say('PRESS T TO PLAY IN TEAMS', 1400); return; }
  if (online) { online.room.setTeam(i, (online.room.slots[i].team + 1) % 3); return; }
  const sl = slots()[i];
  if (sl.type === 'off') return;
  sl.team = (sl.team + 1) % 3;
  saveSettings(settings);
}
function changeLevel(i, d) {
  if (online) { online.room.changeLevel(i, d); return; }
  const sl = slots()[i];
  if (sl.type !== 'cpu') return;
  sl.level = CPU_ORDER[(CPU_ORDER.indexOf(sl.level) + d + CPU_ORDER.length) % CPU_ORDER.length];
  saveSettings(settings);
}

// Clicks and blips for the menus and the pause screen.
function menuSound(code) {
  const ok = code === 'KeyJ' || code === 'Enter' || code === 'Space';
  // (on the fighter select the hand moves silently, and J makes its own sounds)
  const dirKey = (screen !== 'charSelect' && ['KeyA', 'KeyD', 'KeyW', 'KeyS', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(code))
    || (screen === 'charSelect' && /^(Digit|Numpad)[1-4]$|^Key[KLUI]$|^Tab$/.test(code));
  if (screen === 'title') { if (!['F5', 'F12'].includes(code)) sfx.play('menuOk'); }
  else if (screen === 'charSelect' || screen === 'stageSelect' || screen === 'menu') {
    if (code === 'Escape') sfx.play('menuBack');
    else if (ok && screen !== 'stageSelect' && !(screen === 'charSelect' && code === 'KeyJ')) sfx.play('menuOk');
    else if (dirKey) sfx.play('menuMove');
  } else if (screen === 'match') {
    if (code === 'Escape') sfx.play('pause');
    else if (code === 'KeyQ' && paused) sfx.play('menuBack');
  }
}

function chooseStage(i) {
  stageIndex = i;
  const t = stageTiles[i];
  // Random picks outside the simulation, so Math.random is fine here.
  const stage = t.stage || STAGES[Math.floor(Math.random() * STAGES.length)];
  if (online) {
    // everyone starts when the room says so (see roomEvents)
    if (!online.room.start(stage.id)) { online.room.setPhase('lobby'); screen = 'charSelect'; say('A MATCH NEEDS AT LEAST TWO FIGHTERS', 2200); }
  }
  else startMatch(stage);
}

// Mouse: on the fighter select the hand follows it.
renderer.canvas.addEventListener('mousemove', (e) => {
  if (screen !== 'charSelect') return;
  const b = renderer.canvas.getBoundingClientRect();
  cursor.x = ((e.clientX - b.left) / b.width) * CONFIG.SCREEN_W; cursor.y = ((e.clientY - b.top) / b.height) * CONFIG.SCREEN_H;
});
// Mouse: click a roster tile, a player panel or a stage tile.
renderer.canvas.addEventListener('click', (e) => {
  const b = renderer.canvas.getBoundingClientRect();
  const x = ((e.clientX - b.left) / b.width) * CONFIG.SCREEN_W, y = ((e.clientY - b.top) / b.height) * CONFIG.SCREEN_H;
  const inside = (r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  if (screen === 'charSelect') {
    sfx.unlock();
    cursor.x = x; cursor.y = y;
    selectPress();
    return;
  }
  if (screen !== 'stageSelect' || (online && !online.room.isHost)) return;
  stageTiles.forEach((_, i) => { if (inside(renderer.stageTileRect(i, stageTiles.length))) chooseStage(i); });
});

// Back from an automatic update: rejoin the room we were trying to join.
try {
  const code = sessionStorage.getItem('rejoin');
  if (code) { sessionStorage.removeItem('rejoin'); joinCode = code; screen = 'join'; joinRoom(code); }
} catch (e) { /* no session storage */ }

// --- Update check (title screen only) ---
async function lookForUpdate() {
  if (screen !== 'title') return;
  if (await checkForUpdate()) updateMessage = UPDATE_MESSAGE;
}
lookForUpdate();
setInterval(lookForUpdate, CONFIG.UPDATE_CHECK_SECONDS * 1000);

// --- Fixed-timestep loop ---
const STEP_MS = 1000 / CONFIG.TICK_RATE;
let last = performance.now(), acc = 0;
// If something ever throws, report it once and keep the game loop alive
// instead of freezing the page.
// The first error is also shown on screen (F8 copies the details), so a
// crash or freeze can be reported.
let lastError = '';
let crash = null;       // { text, details }
function safely(fn) {
  try { fn(); } catch (e) {
    const msg = String(e && e.stack || e);
    if (msg !== lastError) { lastError = msg; console.error(e); }
    if (!crash) {
      crash = {
        text: String(e && e.message || e).toUpperCase().slice(0, 70),
        details: 'UBC Brawlers v' + GAME_VERSION + '\nscreen: ' + screen + (online ? ' (online, ' + (online.room.isHost ? 'host' : 'friend') + ')' : '') + '\n' + navigator.userAgent + '\n\n' + msg,
      };
    }
  }
}
function frame(now) {
  acc += Math.min(now - last, STEP_MS * CONFIG.MAX_CATCHUP_TICKS);
  last = now;
  while (acc >= STEP_MS) { safely(tick); acc -= STEP_MS; }
  safely(render);
  if (crash) { try { renderer.drawCrash(crash.text); } catch (e) { /* nothing more we can do */ } }
  fpsFrames++;
  if (now - fpsTime >= 1000) {
    fps = fpsFrames; fpsFrames = 0; fpsTime = now;
    // Running slowly for a few seconds in a row: lower the picture sharpness
    // a step so the game stays at full speed.
    if (fps > 5 && fps < 50 && document.visibilityState === 'visible') { if (++slowSeconds >= 3) { renderer.lowerQuality(); slowSeconds = 0; } }
    else slowSeconds = 0;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Handy for testing from the browser console.
window.__game = { get match() { return match; }, get screen() { return screen; }, get online() { return online; }, settings, renderer, startMatch, enterRoom };
