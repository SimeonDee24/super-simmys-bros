// The very first message two machines exchange is a makeHello() packet.
// Each side runs checkHello() on what it receives and refuses to play if the
// versions differ, telling the outdated player to refresh. Different versions
// would simulate the match differently and drift apart.
import { GAME_VERSION, compareVersions } from '../config/version.js';

export const NET_PROTOCOL = 3; // bump when the wire format changes

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
      message: `Your game is v${GAME_VERSION} but the other player has v${remote.version}. Refresh the page to update.` };
  }
  return { ok: false, outdated: 'remote',
    message: `The other player has v${remote.version} but you have v${GAME_VERSION}. Ask them to refresh the page.` };
}
