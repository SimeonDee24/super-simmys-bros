// Entry point: owns the fixed 60 Hz loop and switches between screens.
// The simulation (engine/sim.js) is advanced only here, one tick at a time,
// from recorded input bitmasks. Rendering happens separately, once per
// browser frame.
import { CONFIG } from './config/config.js';
import { Keyboard, KeyboardSource, InputRecorder } from './engine/input.js';
import { createMatch, step, hashState } from './engine/sim.js';
import { CpuController, CPU_ORDER, cpuLabel } from './engine/cpu.js';
import { STAGES } from './stages/index.js';
import { CHARACTERS } from './characters/index.js';
import { Renderer } from './render/renderer.js';
import { loadSettings, saveSettings } from './ui/settings.js';
import { checkForUpdate, UPDATE_MESSAGE } from './ui/updatecheck.js';
import { sfx } from './audio/sfx.js';
import { SoundDirector } from './audio/director.js';

const settings = loadSettings();
sfx.setVolume(settings.volume);
sfx.setMuted(settings.muted);
const director = new SoundDirector();   // turns what happens in a match into sounds
const renderer = new Renderer(document.getElementById('game'));
const keyboard = new Keyboard();
['F1', 'F2', 'Escape', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].forEach((k) => keyboard.blocked.add(k));

let screen = 'title';   // 'title' | 'charSelect' | 'stageSelect' | 'match'
let match = null;       // { state, sources, recorder, endTimer }
// Stage select tiles: every stage, then Random.
const stageTiles = [...STAGES.map((stage) => ({ stage })), { random: true }];
let stageIndex = 0;
let paused = false;
let toast = null;       // short message at the top of the screen, e.g. after a hotkey
let updateMessage = null;
let fps = 0, fpsFrames = 0, fpsTime = 0, slowSeconds = 0;

let selSlot = 0;        // fighter select: the slot the keys are moving

// The four saved fighter slots, kept valid if the roster changes. Slot 1 is
// always the keyboard player, and there are always at least two fighters.
function slots() {
  const ss = settings.slots, n = CHARACTERS.length;
  ss.forEach((sl, i) => {
    sl.char = ((sl.char | 0) % n + n) % n;
    sl.alt = ((sl.alt | 0) % CHARACTERS[sl.char].palettes.length + CHARACTERS[sl.char].palettes.length) % CHARACTERS[sl.char].palettes.length;
    if (!CPU_ORDER.includes(sl.level)) sl.level = 'lv3';
    sl.type = i === 0 ? 'human' : sl.type === 'off' ? 'off' : 'cpu';
  });
  if (!ss.some((sl, i) => i > 0 && sl.type !== 'off')) ss[1].type = 'cpu';
  return ss;
}
// Same fighter in the same skin as someone else: move slot i to a skin nobody
// is using, if the fighter has one left (with more players than skins, some share).
function freeSkin(i, dir = 1) {
  const ss = slots(), sl = ss[i], m = CHARACTERS[sl.char].palettes.length;
  const taken = (alt) => ss.some((o, k) => k !== i && o.type !== 'off' && o.char === sl.char && o.alt === alt);
  for (let k = 0; k < m && taken(sl.alt); k++) sl.alt = (sl.alt + dir + m) % m;
}

function startMatch(stage = STAGES[0]) {
  const active = slots().map((sl, port) => ({ ...sl, port })).filter((sl) => sl.type !== 'off');
  const state = createMatch({
    stageId: stage.id,
    players: active.map((sl) => ({ charId: CHARACTERS[sl.char].id, alt: sl.alt })),
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
  renderer.setPlayers(active.map((sl) => ({ port: sl.port, label: sl.type === 'human' ? 'P' + (sl.port + 1) : 'CPU' })));
  renderer.resetEffects();
  director.reset();
  sfx.play('start');
  paused = false;
  screen = 'match';
}

function tick() {
  if (screen === 'match' && !paused) {
    const inputs = match.sources.map((s, i) => s.sample(match.state, i));
    match.recorder.push(inputs);
    step(match.state, inputs);
    for (const e of director.update(match.state)) sfx.play(e.name, e.strength, e.pan);
    // One fighter (or nobody) left standing: show GAME!, then leave. (The
    // victory screen replaces this in milestone 5.)
    if (match.state.fighters.filter((f) => f.state !== 'out').length <= 1 && ++match.endTimer >= CONFIG.GAME_END_FRAMES) {
      screen = 'stageSelect'; match = null;
    }
  }
  keyboard.endTick();
}

function render() {
  drawScreen();
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
  if (screen === 'charSelect') { renderer.drawCharSelect(CHARACTERS, slots(), selSlot, (i) => cpuLabel(slots()[i].level)); return; }
  if (screen === 'stageSelect') { renderer.drawStageSelect(stageTiles, stageIndex); return; }
  const opts = { showBoxes: settings.showBoxes };
  if (settings.showDebug) {
    const f = match.state.fighters[0];
    opts.debugLines = [
      'TICK ' + match.state.tick + '  HASH ' + hashState(match.state) + '  FPS ' + fps,
      'P1 ' + (f.move || f.state) + ' ' + f.stateFrame + '  VX ' + f.vx + ' VY ' + f.vy + '  SHIELD ' + (f.shieldHp / 1000).toFixed(1),
    ];
  }
  renderer.drawMatch(match.state, opts);
  if (match.endTimer > 0) renderer.drawBanner('GAME!');
  if (paused) {
    renderer.drawPause([
      'PAUSED',
      'ESC  RESUME        Q  QUIT TO STAGE SELECT',
      '',
      'MOVE  W A S D      DOUBLE-TAP A / D TO DASH AND RUN',
      'JUMP  SPACE        TAP = SHORT HOP, HOLD = FULL HOP',
      'FAST FALL  TAP S AT OR AFTER THE TOP OF A JUMP',
      'CROUCH  HOLD S    (HOLD S + A / D TO CRAWL)',
      'PLATFORMS  JUMP UP THROUGH THEM.  TAP S WHILE STANDING ON ONE TO DROP THROUGH',
      'SHIELD  HOLD I.  + A / D = ROLL, + S = SPOT DODGE, + SPACE = JUMP OUT',
      '        LET GO JUST BEFORE A HIT LANDS TO PARRY.   I IN THE AIR = AIR DODGE',
      'GRAB  U (OR SHIELD + J).  THEN A / D / W / S = THROW THAT WAY, J = PUMMEL',
      'SPECIAL  K ALONE, OR WITH A / D, W OR S. EACH FIGHTER HAS FOUR:',
      ' SIMEON  K = JUMP SHOT (HOLD TO CHARGE)     A / D + K = FAST BREAK (HOLD TO CHARGE, 1 IN 10 MISFIRES)',
      '         W + K = ALLEY-OOP (RISING KICKS)   S + K = BLUFF (COUNTER)',
      ' KAELYN  K = PUFF PASS (BOOMERANG)          A / D + K = ROLL OUT (SKATING DASH INTO AN UPPERCUT)',
      '         W + K = KICKFLIP (RISE, THEN DIVE) S + K = HALF PIPE (FLIP JUMP; PRESS K OR J AGAIN TO KICK)',
      '   LUCA  K = BASS DROP (HOLD TO CHARGE)      A / D + K = SUPPLY & DEMAND (TAP: UP ARROW, HOLD: CRASH)',
      '         W + K = WIRE TRANSFER (TELEPORT)   S + K = STAGE DIVE (LEAPING KICK)',
      'TECH  PRESS I JUST BEFORE HITTING THE FLOOR, A WALL OR THE CEILING WHILE TUMBLING',
      '      (+ A / D TO TECH ROLL).  MASHING I WILL NOT WORK',
      'KNOCKED DOWN  J = GETUP ATTACK, A / D = ROLL, SPACE OR W = STAND UP',
      'LEDGE  GRABBED AUTOMATICALLY WHEN FALLING NEXT TO IT',
      '       TOWARD STAGE = GET UP, J = LEDGE ATTACK, I = LEDGE ROLL, SPACE = JUMP, S = DROP',
      '',
      'M  SOUND ON / OFF      0  TAP JUMP ON / OFF (W ALSO JUMPS)  NOW ' + (settings.tapJump ? 'ON' : 'OFF'),
      'F1  DEBUG INFO AND STATE HASH',
      'F2  HITBOXES (RED), HURTBOXES (YELLOW), LEDGE BOXES',
      '',
      'SMASH  L (+ W / S FOR UP / DOWN), OR TAP A DIRECTION AND PRESS J RIGHT AFTER.  HOLD TO CHARGE',
      'ATTACK  J    ON THE GROUND: JAB (PRESS AGAIN FOR 1-2-3), A / D = FORWARD TILT,',
      '             W = UP TILT, S = DOWN TILT',
      '             IN THE AIR: NEUTRAL, FORWARD, BACK, W = UP, S = DOWN AIR',
      '             WHILE DASHING OR RUNNING: DASH ATTACK',
    ]);
  }
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  sfx.unlock();
  // M mutes and unmutes the sound on any screen
  // 0 switches tap jump (W also jumps) on and off, on any screen
  if (e.code === 'Digit0' || e.code === 'Numpad0') {
    settings.tapJump = !settings.tapJump; saveSettings(settings);
    sfx.play(settings.tapJump ? 'menuOk' : 'menuBack');
    toast = { text: 'TAP JUMP ' + (settings.tapJump ? 'ON: W ALSO JUMPS' : 'OFF: ONLY SPACE JUMPS'), until: performance.now() + 1800 };
    return;
  }
  if (e.code === 'KeyM') { settings.muted = !settings.muted; sfx.setMuted(settings.muted); saveSettings(settings); if (!settings.muted) sfx.play('menuOk'); return; }
  menuSound(e.code);
  if (screen === 'title') {
    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.code !== 'F5' && e.code !== 'F12') screen = 'charSelect';
    return;
  }
  if (screen === 'charSelect') {
    const c = e.code, sl = slots()[selSlot], n = CHARACTERS.length;
    const digit = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(c) >= 0 ? ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(c) : ['Numpad1', 'Numpad2', 'Numpad3', 'Numpad4'].indexOf(c);
    if (digit >= 0) selectSlot(digit);
    else if (c === 'Tab') selectSlot((selSlot + (e.shiftKey ? 3 : 1)) % 4, false);
    else if (c === 'KeyA' || c === 'ArrowLeft') pickChar(selSlot, (sl.char + n - 1) % n);
    else if (c === 'KeyD' || c === 'ArrowRight') pickChar(selSlot, (sl.char + 1) % n);
    else if (c === 'KeyW' || c === 'ArrowUp' || c === 'KeyS' || c === 'ArrowDown') {
      // up and down move a row in the roster grid
      const cols = renderer.charGrid(n).cols, to = sl.char + (c === 'KeyW' || c === 'ArrowUp' ? -cols : cols);
      if (to >= 0 && to < n) pickChar(selSlot, to);
    }
    else if (c === 'KeyK') nextSkin(selSlot);
    else if (c === 'KeyL') toggleSlot(selSlot);
    else if (c === 'KeyU' || c === 'KeyI') changeLevel(selSlot, c === 'KeyU' ? -1 : 1);
    else if (c === 'KeyJ' || c === 'Enter' || c === 'Space') screen = 'stageSelect';
    else if (c === 'Escape') screen = 'title';
    return;
  }
  if (screen === 'stageSelect') {
    const n = stageTiles.length;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') stageIndex = (stageIndex + n - 1) % n;
    else if (e.code === 'KeyD' || e.code === 'ArrowRight') stageIndex = (stageIndex + 1) % n;
    else if (e.code === 'KeyJ' || e.code === 'Enter' || e.code === 'Space') chooseStage(stageIndex);
    else if (e.code === 'Escape') screen = 'charSelect';
    return;
  }
  if (e.code === 'Escape') paused = !paused;
  else if (e.code === 'KeyQ' && paused) { screen = 'stageSelect'; match = null; }
  else if (e.code === 'F1') { settings.showDebug = !settings.showDebug; saveSettings(settings); }
  else if (e.code === 'F2') { settings.showBoxes = !settings.showBoxes; saveSettings(settings); }
});

// --- Fighter select actions (shared by the keys and the mouse) ---
// Make a slot the one the keys move. Choosing a slot that is off adds it as a CPU.
function selectSlot(i, turnOn = true) {
  selSlot = i;
  const sl = slots()[i];
  if (turnOn && sl.type === 'off') { sl.type = 'cpu'; freeSkin(i); }
  saveSettings(settings);
}
function pickChar(i, char) {
  const sl = slots()[i];
  if (sl.type === 'off') sl.type = 'cpu';
  sl.char = char; sl.alt = 0;
  freeSkin(i);
  saveSettings(settings);
}
function nextSkin(i) {
  const sl = slots()[i];
  if (sl.type === 'off') return;
  sl.alt = (sl.alt + 1) % CHARACTERS[sl.char].palettes.length;
  freeSkin(i);
  saveSettings(settings);
}
// Slots 2-4 can be switched between CPU and off, as long as two fighters remain.
function toggleSlot(i) {
  const ss = slots(), sl = ss[i];
  if (i === 0) { toast = { text: 'PLAYER 1 IS ALWAYS IN', until: performance.now() + 1400 }; return; }
  if (sl.type === 'off') { sl.type = 'cpu'; freeSkin(i); }
  else if (ss.filter((o) => o.type !== 'off').length > 2) sl.type = 'off';
  else toast = { text: 'A MATCH NEEDS AT LEAST TWO FIGHTERS', until: performance.now() + 1600 };
  saveSettings(settings);
}
function changeLevel(i, d) {
  const sl = slots()[i];
  if (sl.type !== 'cpu') return;
  sl.level = CPU_ORDER[(CPU_ORDER.indexOf(sl.level) + d + CPU_ORDER.length) % CPU_ORDER.length];
  saveSettings(settings);
}

// Clicks and blips for the menus and the pause screen.
function menuSound(code) {
  const ok = code === 'KeyJ' || code === 'Enter' || code === 'Space';
  const dirKey = ['KeyA', 'KeyD', 'KeyW', 'KeyS', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(code)
    || (screen === 'charSelect' && /^(Digit|Numpad)[1-4]$|^Key[KLUI]$|^Tab$/.test(code));
  if (screen === 'title') { if (!['F5', 'F12'].includes(code)) sfx.play('menuOk'); }
  else if (screen === 'charSelect' || screen === 'stageSelect') {
    if (code === 'Escape') sfx.play('menuBack');
    else if (ok && screen === 'charSelect') sfx.play('menuOk');
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
  startMatch(t.stage || STAGES[Math.floor(Math.random() * STAGES.length)]);
}

// Mouse: click a roster tile, a player panel or a stage tile.
renderer.canvas.addEventListener('click', (e) => {
  const b = renderer.canvas.getBoundingClientRect();
  const x = ((e.clientX - b.left) / b.width) * CONFIG.SCREEN_W, y = ((e.clientY - b.top) / b.height) * CONFIG.SCREEN_H;
  const inside = (r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  if (screen === 'charSelect') {
    sfx.unlock();
    CHARACTERS.forEach((_, k) => { if (inside(renderer.charTileRect(k, CHARACTERS.length))) { pickChar(selSlot, k); sfx.play('menuMove'); } });
    for (let i = 0; i < 4; i++) {
      const r = renderer.slotPanelRect(i);
      if (!inside(r)) continue;
      // the coloured header switches a slot on and off, the rest of the panel selects it
      // (clicking the fighter of the selected slot changes skin)
      if (y < r.y + 13 && i > 0 && slots()[i].type !== 'off') toggleSlot(i);
      else if (i === selSlot && slots()[i].type !== 'off') nextSkin(i);
      else selectSlot(i);
      sfx.play('menuMove');
    }
    return;
  }
  if (screen !== 'stageSelect') return;
  stageTiles.forEach((_, i) => { if (inside(renderer.stageTileRect(i, stageTiles.length))) chooseStage(i); });
});

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
let lastError = '';
function safely(fn) {
  try { fn(); } catch (e) {
    const msg = String(e && e.stack || e);
    if (msg !== lastError) { lastError = msg; console.error(e); }
  }
}
function frame(now) {
  acc += Math.min(now - last, STEP_MS * CONFIG.MAX_CATCHUP_TICKS);
  last = now;
  while (acc >= STEP_MS) { safely(tick); acc -= STEP_MS; }
  safely(render);
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
window.__game = { get match() { return match; }, get screen() { return screen; }, settings, renderer, startMatch };
