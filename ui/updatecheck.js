// Asks the server for version.json (never cached) and reports a newer version.
import { GAME_VERSION, compareVersions } from '../config/version.js';

export async function checkForUpdate() {
  try {
    const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
    const info = await r.json();
    return compareVersions(info.version, GAME_VERSION) > 0 ? info.version : null;
  } catch (e) {
    return null; // offline: just keep playing
  }
}

export const UPDATE_MESSAGE = 'UPDATE AVAILABLE. REFRESH TO PLAY THE LATEST VERSION.';
