// Character registry. To add a fighter: create characters/<name>.js (copy
// simeon.js as a template) and add one import + one entry here.
import { SIMEON } from './simeon.js';
import { KAELYN } from './kaelyn.js';

export const CHARACTERS = [SIMEON, KAELYN];

const byId = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));
export const getCharacter = (id) => byId[id];
