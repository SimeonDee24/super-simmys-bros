// SOUND STUB. Milestone 5 fills this in with Web Audio API generated effects
// (no audio files). The rest of the game already calls sfx.play(name, strength).
export const sfx = {
  volume: 0.6,
  setVolume(v) { this.volume = v; },
  unlock() { /* will resume the AudioContext on the first key press */ },
  play(_name, _strength = 1) { /* no-op for now */ },
};
