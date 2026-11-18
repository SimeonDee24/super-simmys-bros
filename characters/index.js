// Character registry. To add a fighter: create characters/<name>.js (copy
// simeon.js as a template) and add one import + one entry here.
import { SIMEON } from './simeon.js';
import { KAELYN } from './kaelyn.js';
import { LUCA } from './luca.js';
import { SARA } from './sara.js';
import { MALCOLM } from './malcolm.js';
import { MAX } from './max.js';
import { OSAMA } from './osama.js';

export const CHARACTERS = [SIMEON, KAELYN, LUCA, SARA, MALCOLM, MAX, OSAMA];

const byId = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));
export const getCharacter = (id) => byId[id];
