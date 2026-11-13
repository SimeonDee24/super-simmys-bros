// The single source of truth for the game version.
// Change it with:  node tools/release.mjs 0.1.1   (also updates version.json)
export const GAME_VERSION = '0.14.8';

// Returns 1 if a is newer than b, -1 if older, 0 if equal.
export function compareVersions(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}
