// ONLINE STUB (no networking yet).
//
// Planned: 1v1 delay-based lockstep over PeerJS room codes.
// The very first messages two players exchange must be makeHello() packets.
// Each side runs checkHello() on what it receives and REFUSES to start the
// match if the versions differ, telling the outdated player to refresh.
//
// The engine is already built for this: see engine/sim.js (step, hashState,
// serialize) and engine/input.js (per-frame input bitmasks, InputRecorder).
import { GAME_VERSION, compareVersions } from '../config/version.js';

export const NET_PROTOCOL = 1; // bump when the wire format changes

export function makeHello() {
  return { type: 'hello', version: GAME_VERSION, protocol: NET_PROTOCOL };
}

// Returns { ok: true } or { ok: false, outdated: 'local' | 'remote', message }.
export function checkHello(remote) {
  if (!remote || remote.type !== 'hello') {
    return { ok: false, outdated: 'remote', message: 'Could not read the other player\'s version.' };
  }
  const cmp = compareVersions(GAME_VERSION, remote.version);
  if (cmp === 0 && remote.protocol === NET_PROTOCOL) return { ok: true };
  if (cmp < 0) {
    return { ok: false, outdated: 'local',
      message: `You are on v${GAME_VERSION} but your opponent is on v${remote.version}. Refresh to play the latest version.` };
  }
  return { ok: false, outdated: 'remote',
    message: `Your opponent is on v${remote.version} but you are on v${GAME_VERSION}. Ask them to refresh.` };
}

// TODO (online prompt): createRoom(), joinRoom(code), sendInput(frame, mask),
// onRemoteInput(cb), periodic hashState() exchange for desync detection.
