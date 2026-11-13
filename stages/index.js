// Stage registry. To add a stage: create stages/<name>.js and add it here.
import { CLOUDREST } from './cloudrest.js';

export const STAGES = [CLOUDREST];

const byId = Object.fromEntries(STAGES.map((s) => [s.id, s]));
export const getStage = (id) => byId[id];
