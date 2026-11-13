// Entry point: owns the fixed 60 Hz loop and switches between screens.
// The simulation (engine/sim.js) is advanced only here, one tick at a time,
// from recorded input bitmasks. Rendering happens separately, once per
// browser frame.
import { CONFIG } from './config/config.js';
import { Keyboard, KeyboardSource, IdleSource, InputRecorder } from './engine/input.js';
import { createMatch, step, hashState } from './engine/sim.js';
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

let screen = 'title';
let match = null;       // { state, sources, recorder }
let paused = false;
let updateMessage = null;
let fps = 0, fpsFrames = 0, fpsTime = 0;

function startMatch() {
  const state = createMatch({
    stageId: STAGES[0].id,
    players: [{ charId: CHARACTERS[0].id, alt: 0 }, { charId: CHARACTERS[0].id, alt: 1 }],
    stocks: CONFIG.DEFAULT_STOCKS,
    seed: CONFIG.DEFAULT_SEED,
  });
  match = {
    state,
    sources: [new KeyboardSource(keyboard, settings.bindings), new IdleSource()],
    recorder: new InputRecorder(),
  };
  paused = false;
  screen = 'match';
}

function tick() {
  if (screen === 'match' && !paused) {
    const inputs = match.sources.map((s, i) => s.sample(match.state, i));
    match.recorder.push(inputs);
    step(match.state, inputs);
  }
  keyboard.endTick();
}

function render() {
  if (screen === 'title') {
    renderer.drawTitle(STAGES[0], { charId: CHARACTERS[0].id, updateMessage });
    return;
  }
  const opts = { showBoxes: settings.showBoxes };
  if (settings.showDebug) {
    const f = match.state.fighters[0];
    opts.debugLines = [
      'TICK ' + match.state.tick + '  HASH ' + hashState(match.state) + '  FPS ' + fps,
      'P1 ' + f.state + ' ' + f.stateFrame + '  VX ' + f.vx + ' VY ' + f.vy,
    ];
  }
  renderer.drawMatch(match.state, opts);
  if (paused) {
    renderer.drawPause([
      'PAUSED',
      'ESC  RESUME        Q  QUIT TO TITLE',
      '',
      'MOVE  W A S D      DOUBLE-TAP A / D TO DASH AND RUN',
      'JUMP  SPACE        TAP = SHORT HOP, HOLD = FULL HOP',
      'FAST FALL  TAP S AT OR AFTER THE TOP OF A JUMP',
      'CROUCH  HOLD S',
      'LEDGE  GRABBED AUTOMATICALLY WHEN FALLING NEXT TO IT',
      '       TOWARD STAGE = GET UP, SPACE = JUMP, S = DROP',
      '',
      'F1  DEBUG INFO AND STATE HASH',
      'F2  HURTBOXES AND LEDGE BOXES',
      '',
      'ATTACKS, SHIELD AND GRABS ARRIVE IN THE NEXT MILESTONES',
    ]);
  }
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  sfx.unlock();
  if (screen === 'title') {
    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.code !== 'F5' && e.code !== 'F12') startMatch();
    return;
  }
  if (e.code === 'Escape') paused = !paused;
  else if (e.code === 'KeyQ' && paused) { screen = 'title'; match = null; }
  else if (e.code === 'F1') { settings.showDebug = !settings.showDebug; saveSettings(settings); }
  else if (e.code === 'F2') { settings.showBoxes = !settings.showBoxes; saveSettings(settings); }
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
function frame(now) {
  acc += Math.min(now - last, STEP_MS * CONFIG.MAX_CATCHUP_TICKS);
  last = now;
  while (acc >= STEP_MS) { tick(); acc -= STEP_MS; }
  render();
  fpsFrames++;
  if (now - fpsTime >= 1000) { fps = fpsFrames; fpsFrames = 0; fpsTime = now; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Handy for testing from the browser console.
window.__game = { get match() { return match; }, settings, renderer, startMatch };
