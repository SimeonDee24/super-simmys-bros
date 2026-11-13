// Stage registry. To add a stage: create stages/<name>.js and add it here.
import { NEST } from './nest.js';
import { BALCONY } from './balcony.js';
import { CLOUDREST } from './cloudrest.js';

export const STAGES = [NEST, BALCONY, CLOUDREST];

const byId = Object.fromEntries(STAGES.map((s) => [s.id, s]));
export const getStage = (id) => byId[id];
