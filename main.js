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

const settings = loadSettings();
sfx.setVolume(settings.volume);
const renderer = new Renderer(document.getElementById('game'));
const keyboard = new Keyboard();
['F1', 'F2', 'Escape', 'Tab'].forEach((k) => keyboard.blocked.add(k));

let screen = 'title';   // 'title' | 'stageSelect' | 'match'
let match = null;       // { state, sources, recorder, endTimer }
// Stage select tiles: every stage, then Random.
const stageTiles = [...STAGES.map((stage) => ({ stage })), { random: true }];
let stageIndex = 0;
let paused = false;
let updateMessage = null;
let fps = 0, fpsFrames = 0, fpsTime = 0;

function startMatch(stage = STAGES[0]) {
  const state = createMatch({
    stageId: stage.id,
    players: [{ charId: CHARACTERS[0].id, alt: 0 }, { charId: CHARACTERS[0].id, alt: 1 }],
    stocks: CONFIG.DEFAULT_STOCKS,
    seed: CONFIG.DEFAULT_SEED,
  });
  match = {
    state,
    sources: [new KeyboardSource(keyboard, settings.bindings), new CpuController(settings.cpuLevel, CONFIG.DEFAULT_SEED ^ 0x2c9)],
    recorder: new InputRecorder(),
    endTimer: 0,
  };
  renderer.resetEffects();
  paused = false;
  screen = 'match';
}

function tick() {
  if (screen === 'match' && !paused) {
    const inputs = match.sources.map((s, i) => s.sample(match.state, i));
    match.recorder.push(inputs);
    step(match.state, inputs);
    // Someone is out of stocks: show GAME!, then leave. (The victory screen
    // replaces this in milestone 5.)
    if (match.state.fighters.some((f) => f.state === 'out') && ++match.endTimer >= CONFIG.GAME_END_FRAMES) {
      screen = 'stageSelect'; match = null;
    }
  }
  keyboard.endTick();
}

function render() {
  if (screen === 'title') {
    renderer.drawTitle(STAGES[0], { charId: CHARACTERS[0].id, updateMessage });
    return;
  }
  if (screen === 'stageSelect') { renderer.drawStageSelect(stageTiles, stageIndex, 'P2 CPU: ' + cpuLabel(settings.cpuLevel)); return; }
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
      'SHIELD  HOLD I.  + A / D = ROLL, + S = SPOT DODGE, + SPACE = JUMP OUT',
      '        LET GO JUST BEFORE A HIT LANDS TO PARRY.   I IN THE AIR = AIR DODGE',
      'SPECIAL  K.  S + K = BLUFF: IF HIT WHILE HOLDING THE CARD, HE COUNTERS',
      'KNOCKED DOWN  J = GETUP ATTACK, A / D = ROLL, SPACE OR W = STAND UP',
      'LEDGE  GRABBED AUTOMATICALLY WHEN FALLING NEXT TO IT',
      '       TOWARD STAGE = GET UP, J = LEDGE ATTACK, I = LEDGE ROLL, SPACE = JUMP, S = DROP',
      '',
      'F1  DEBUG INFO AND STATE HASH',
      'F2  HITBOXES (RED), HURTBOXES (YELLOW), LEDGE BOXES',
      '',
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
  if (screen === 'title') {
    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.code !== 'F5' && e.code !== 'F12') screen = 'stageSelect';
    return;
  }
  if (screen === 'stageSelect') {
    const n = stageTiles.length;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') stageIndex = (stageIndex + n - 1) % n;
    else if (e.code === 'KeyD' || e.code === 'ArrowRight') stageIndex = (stageIndex + 1) % n;
    else if (e.code === 'KeyJ' || e.code === 'Enter' || e.code === 'Space') chooseStage(stageIndex);
    else if (e.code === 'KeyW' || e.code === 'KeyS' || e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      const i = CPU_ORDER.indexOf(settings.cpuLevel);
      settings.cpuLevel = CPU_ORDER[(i + (e.code === 'KeyW' || e.code === 'ArrowUp' ? CPU_ORDER.length - 1 : 1)) % CPU_ORDER.length];
      saveSettings(settings);
    }
    else if (e.code === 'Escape') screen = 'title';
    return;
  }
  if (e.code === 'Escape') paused = !paused;
  else if (e.code === 'KeyQ' && paused) { screen = 'stageSelect'; match = null; }
  else if (e.code === 'F1') { settings.showDebug = !settings.showDebug; saveSettings(settings); }
  else if (e.code === 'F2') { settings.showBoxes = !settings.showBoxes; saveSettings(settings); }
});

function chooseStage(i) {
  stageIndex = i;
  const t = stageTiles[i];
  // Random picks outside the simulation, so Math.random is fine here.
  startMatch(t.stage || STAGES[Math.floor(Math.random() * STAGES.length)]);
}

// Mouse: click a stage tile to pick it.
renderer.canvas.addEventListener('click', (e) => {
  if (screen !== 'stageSelect') return;
  const b = renderer.canvas.getBoundingClientRect();
  const x = ((e.clientX - b.left) / b.width) * CONFIG.SCREEN_W, y = ((e.clientY - b.top) / b.height) * CONFIG.SCREEN_H;
  stageTiles.forEach((_, i) => {
    const r = renderer.stageTileRect(i, stageTiles.length);
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) chooseStage(i);
  });
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
  if (now - fpsTime >= 1000) { fps = fpsFrames; fpsFrames = 0; fpsTime = now; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Handy for testing from the browser console.
window.__game = { get match() { return match; }, get screen() { return screen; }, settings, renderer, startMatch };
