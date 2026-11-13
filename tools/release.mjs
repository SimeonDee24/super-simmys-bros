// Usage:  node tools/release.mjs 0.1.1
// Sets GAME_VERSION in config/version.js and rewrites version.json, including
// the list of modules that index.html uses for cache-busting.
// Run with no argument to just refresh the module list.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['config', 'engine', 'characters', 'stages', 'render', 'ui', 'audio', 'net'];
const verFile = join(root, 'config/version.js');
let src = readFileSync(verFile, 'utf8');
const current = src.match(/GAME_VERSION = '([^']+)'/)[1];
const next = process.argv[2] || current;
if (!/^\d+\.\d+\.\d+$/.test(next)) { console.error('Version must look like 0.1.1'); process.exit(1); }
src = src.replace(/GAME_VERSION = '[^']+'/, `GAME_VERSION = '${next}'`);
writeFileSync(verFile, src);

const modules = [];
for (const d of DIRS) {
  for (const f of readdirSync(join(root, d)).sort()) if (f.endsWith('.js')) modules.push(`${d}/${f}`);
}
writeFileSync(join(root, 'version.json'), JSON.stringify({ version: next, modules }, null, 2) + '\n');
console.log(`version ${current} -> ${next}, ${modules.length} modules listed`);
