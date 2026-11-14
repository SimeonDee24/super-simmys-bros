// Sound effects, all generated in code with the Web Audio API: no audio files.
// Each sound is a few layers of tones (a pitch sliding from f0 to f1) and
// filtered noise (a filter sweeping from f0 to f1), each with a fast attack
// and a fading tail. No music.
//
//   sfx.play(name, strength = 1, pan = 0)   strength scales loudness (and for a
//                                           few sounds pitch); pan is -1..1.
//
// Sound never affects the game: it only listens.

// Layers: ['t', wave, f0, f1, seconds, gain, delay]  or
//         ['n', filter, f0, f1, seconds, gain, delay]
const T = (wave, f0, f1, dur, gain, delay = 0) => ['t', wave, f0, f1, dur, gain, delay];
const N = (filter, f0, f1, dur, gain, delay = 0) => ['n', filter, f0, f1, dur, gain, delay];

export const SOUNDS = {
  // movement
  jump: () => [T('sine', 260, 520, 0.12, 0.25), N('highpass', 2000, 2000, 0.06, 0.08)],
  djump: () => [T('sine', 400, 800, 0.12, 0.22), T('triangle', 600, 1200, 0.1, 0.1, 0.03)],
  land: () => [N('lowpass', 500, 150, 0.09, 0.3)],
  landHard: () => [N('lowpass', 700, 120, 0.16, 0.45), T('sine', 110, 50, 0.14, 0.4)],
  knockdown: () => [N('lowpass', 900, 100, 0.25, 0.5), T('sine', 90, 40, 0.2, 0.5)],
  step: () => [N('bandpass', 900, 500, 0.04, 0.1)],
  dash: () => [N('bandpass', 1200, 3000, 0.12, 0.2)],
  skid: () => [N('bandpass', 3000, 900, 0.16, 0.16)],
  fastfall: () => [T('sine', 1800, 900, 0.1, 0.12)],
  ledge: () => [T('square', 700, 700, 0.03, 0.12), N('lowpass', 1200, 500, 0.05, 0.2)],
  // attacks
  swingS: () => [N('bandpass', 1500, 3500, 0.08, 0.18)],
  swingM: () => [N('bandpass', 900, 2600, 0.12, 0.24)],
  swingL: () => [N('bandpass', 500, 1800, 0.2, 0.32)],
  hitS: () => [N('lowpass', 2500, 500, 0.06, 0.4), T('square', 300, 120, 0.06, 0.2)],
  hitM: () => [N('lowpass', 3000, 300, 0.1, 0.5), T('square', 220, 70, 0.1, 0.3)],
  hitL: () => [N('lowpass', 4000, 200, 0.22, 0.65), T('sawtooth', 160, 35, 0.25, 0.45), T('sine', 80, 30, 0.3, 0.5)],
  grab: () => [N('lowpass', 1500, 400, 0.07, 0.35), T('square', 180, 140, 0.05, 0.15)],
  throw: () => [N('bandpass', 500, 2500, 0.18, 0.28)],
  // defence
  shieldOn: () => [T('sine', 500, 900, 0.1, 0.12)],
  shieldHit: () => [T('triangle', 900, 500, 0.12, 0.3), N('bandpass', 2500, 1500, 0.08, 0.2)],
  shieldBreak: () => [N('highpass', 800, 4000, 0.5, 0.5), T('sawtooth', 900, 80, 0.5, 0.4)],
  parry: () => [T('sine', 1400, 1400, 0.25, 0.3), T('sine', 2100, 2100, 0.3, 0.2)],
  dodge: () => [N('bandpass', 600, 2400, 0.16, 0.2)],
  tech: () => [T('sine', 900, 1500, 0.08, 0.25), N('highpass', 3000, 3000, 0.05, 0.12)],
  counter: () => [T('sawtooth', 200, 1200, 0.2, 0.3), T('sine', 1600, 1600, 0.3, 0.25, 0.1)],
  flick: () => [T('triangle', 1200, 1800, 0.04, 0.12)],
  // KOs and match flow
  ko: () => [N('lowpass', 6000, 100, 0.9, 0.8), T('sawtooth', 400, 30, 0.8, 0.5), T('sine', 60, 25, 0.9, 0.7)],
  respawn: () => [T('sine', 400, 800, 0.25, 0.15), T('sine', 600, 1200, 0.25, 0.12, 0.1)],
  game: () => [T('square', 392, 392, 0.15, 0.2), T('square', 523, 523, 0.15, 0.2, 0.15), T('square', 659, 659, 0.15, 0.2, 0.3), T('square', 784, 784, 0.5, 0.22, 0.45)],
  start: () => [T('square', 523, 523, 0.08, 0.16), T('square', 659, 659, 0.08, 0.16, 0.08), T('square', 784, 784, 0.2, 0.18, 0.16), N('highpass', 2000, 2000, 0.3, 0.08, 0.24)],
  // specials
  charge: (s) => [T('square', 300 + 500 * s, 340 + 560 * s, 0.07, 0.08)],
  shoot: () => [N('bandpass', 1000, 2200, 0.1, 0.2), T('sine', 300, 500, 0.08, 0.12)],
  bounce: () => [T('sine', 220, 110, 0.1, 0.3), N('lowpass', 600, 600, 0.04, 0.15)],
  vape: () => [N('bandpass', 2000, 5000, 0.25, 0.15), T('sine', 700, 1000, 0.2, 0.08)],
  catch: () => [T('triangle', 800, 1200, 0.06, 0.15)],
  arrow: () => [T('sawtooth', 500, 1400, 0.12, 0.14), N('highpass', 3000, 3000, 0.08, 0.1)],
  wave: () => [N('lowpass', 300, 1500, 0.25, 0.3), T('sawtooth', 100, 300, 0.2, 0.2)],
  rocket: () => [N('bandpass', 400, 2500, 0.3, 0.35), T('sawtooth', 120, 400, 0.25, 0.2)],
  misfire: () => [N('lowpass', 5000, 300, 0.5, 0.7), T('sawtooth', 150, 900, 0.4, 0.4), T('sine', 70, 40, 0.4, 0.5)],
  skate: () => [N('bandpass', 1800, 2600, 0.35, 0.2), T('triangle', 300, 350, 0.3, 0.06)],
  prop: () => [T('sawtooth', 95, 105, 0.09, 0.12), N('bandpass', 700, 700, 0.06, 0.06)],
  bass: () => [T('sine', 110, 28, 0.7, 0.9), T('square', 55, 30, 0.4, 0.3), N('lowpass', 2000, 80, 0.5, 0.5)],
  warpOut: () => [T('sine', 600, 2400, 0.25, 0.2), N('highpass', 4000, 4000, 0.2, 0.08)],
  warpIn: () => [T('sine', 2400, 500, 0.25, 0.22), T('triangle', 1200, 300, 0.2, 0.12)],
  // menus
  menuMove: () => [T('square', 660, 660, 0.04, 0.1)],
  menuOk: () => [T('square', 660, 990, 0.08, 0.14), T('square', 990, 1320, 0.1, 0.12, 0.07)],
  menuBack: () => [T('square', 500, 300, 0.1, 0.12)],
  pause: () => [T('triangle', 500, 500, 0.06, 0.15), T('triangle', 400, 400, 0.08, 0.15, 0.07)],
};
export const SOUND_NAMES = Object.keys(SOUNDS);

const noiseBuffers = new WeakMap();
function noiseBuffer(ac) {
  let b = noiseBuffers.get(ac);
  if (!b) {
    b = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = b.getChannelData(0);
    // render-only randomness: sound never feeds back into the game
    let x = 0x2f6e2b1;
    for (let i = 0; i < d.length; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; d[i] = ((x >>> 0) / 2147483648) - 1; }
    noiseBuffers.set(ac, b);
  }
  return b;
}

// Schedule one sound on an audio context (live or offline), starting at t0.
export function buildSound(ac, dest, name, strength = 1, t0 = 0) {
  const def = SOUNDS[name];
  if (!def) return false;
  const s = Math.max(0.3, Math.min(1.6, strength));
  for (const [kind, shape, f0, f1, dur, gain, delay] of def(Math.max(0, Math.min(1, strength)))) {
    const t = t0 + delay, g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain * s, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(dest);
    let src;
    if (kind === 't') {
      src = ac.createOscillator();
      src.type = shape;
      src.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) src.frequency.exponentialRampToValueAtTime(f1, t + dur);
      src.connect(g);
    } else {
      src = ac.createBufferSource();
      src.buffer = noiseBuffer(ac);
      src.loop = true;
      const flt = ac.createBiquadFilter();
      flt.type = shape; flt.Q.value = shape === 'bandpass' ? 1.4 : 0.7;
      flt.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) flt.frequency.exponentialRampToValueAtTime(f1, t + dur);
      src.connect(flt); flt.connect(g);
    }
    src.start(t);
    src.stop(t + dur + 0.02);
  }
  return true;
}

export const sfx = {
  volume: 0.6,
  muted: false,
  ac: null, master: null, last: {},
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = this.muted ? 0 : v; },
  setMuted(m) { this.muted = !!m; this.setVolume(this.volume); },
  // Browsers only allow sound after a key press or click: called on the first one.
  unlock() {
    try {
      if (!this.ac) {
        const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AC) return;
        this.ac = new AC();
        const comp = this.ac.createDynamicsCompressor();   // keeps a pile-up of sounds from clipping
        this.master = this.ac.createGain();
        this.master.gain.value = this.muted ? 0 : this.volume;
        this.master.connect(comp); comp.connect(this.ac.destination);
      }
      if (this.ac.state === 'suspended') this.ac.resume();
    } catch (e) { /* no sound on this browser: carry on silently */ }
  },
  play(name, strength = 1, pan = 0) {
    const ac = this.ac;
    if (!ac || this.muted || ac.state !== 'running') return;
    try {
      // the same sound twice within a few hundredths of a second would just be louder
      const now = ac.currentTime;
      if (now - (this.last[name] || -1) < 0.035) return;
      this.last[name] = now;
      let dest = this.master;
      if (pan && ac.createStereoPanner) {
        const p = ac.createStereoPanner();
        p.pan.value = Math.max(-1, Math.min(1, pan));
        p.connect(this.master); dest = p;
      }
      buildSound(ac, dest, name, strength, now);
    } catch (e) { /* never let sound break the game */ }
  },
};
