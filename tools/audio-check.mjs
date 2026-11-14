// Checks every generated sound against the rules a browser audio engine enforces:  node tools/audio-check.mjs
import { SOUND_NAMES, buildSound, sfx } from '../audio/sfx.js';
// A stand-in for the browser's audio engine that throws where a real one would.
const problems = [];
const param = (owner, name) => ({
  value: 0,
  setValueAtTime(v, t) { if (!Number.isFinite(v) || !Number.isFinite(t) || t < 0) problems.push(`${owner}.${name} set ${v}@${t}`); },
  linearRampToValueAtTime(v, t) { if (!Number.isFinite(v) || !Number.isFinite(t)) problems.push(`${owner}.${name} linear ${v}@${t}`); },
  exponentialRampToValueAtTime(v, t) { if (!(v > 0) || !Number.isFinite(t)) problems.push(`${owner}.${name} exp ramp to ${v} (must be > 0)`); },
});
const node = (kind) => ({ kind, connect() {}, start(t) { if (!(t >= 0)) problems.push(kind + ' start ' + t); }, stop() {} });
const FILTERS = ['lowpass', 'highpass', 'bandpass'], WAVES = ['sine', 'square', 'sawtooth', 'triangle'];
class FakeAC {
  constructor() { this.sampleRate = 44100; this.currentTime = 1; this.state = 'running'; this.destination = node('dest'); }
  createGain() { const n = node('gain'); n.gain = param('gain', 'gain'); return n; }
  createOscillator() { const n = node('osc'); n.frequency = param('osc', 'frequency'); let t; Object.defineProperty(n, 'type', { set: (v) => { if (!WAVES.includes(v)) problems.push('bad wave ' + v); t = v; }, get: () => t }); return n; }
  createBiquadFilter() { const n = node('filter'); n.frequency = param('filter', 'frequency'); n.Q = param('filter', 'Q'); let t; Object.defineProperty(n, 'type', { set: (v) => { if (!FILTERS.includes(v)) problems.push('bad filter ' + v); t = v; }, get: () => t }); return n; }
  createBuffer(c, len, rate) { const d = new Float32Array(len); return { getChannelData: () => d }; }
  createBufferSource() { return node('noise'); }
  createStereoPanner() { const n = node('pan'); n.pan = param('pan', 'pan'); return n; }
  createDynamicsCompressor() { return node('comp'); }
  resume() {}
}
let layers = 0;
for (const n of SOUND_NAMES) for (const st of [0, 0.5, 1, 1.6]) {
  const ac = new FakeAC();
  const before = problems.length;
  if (!buildSound(ac, ac.destination, n, st, 0)) problems.push('missing ' + n);
  if (problems.length > before) problems.push('  ^ in ' + n + ' at strength ' + st);
  layers++;
}
// the live player: unlock, play every sound with a pan, mute and unmute
globalThis.AudioContext = FakeAC;
sfx.unlock(); for (const n of SOUND_NAMES) { sfx.last = {}; sfx.play(n, 1, -0.5); }
sfx.setMuted(true); sfx.play('jump'); sfx.setMuted(false);
console.log(`${SOUND_NAMES.length} sounds, ${layers} builds checked; problems: ${problems.length ? '\n' + problems.join('\n') : 'none'}`);
process.exit(problems.length ? 1 : 0);
