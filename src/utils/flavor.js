// Standalone sensory-beat helpers. Kept separate from genAdventure.js so the
// runtime "✦ flavor" button in NodeView doesn't drag the bestiary (56 KB) into
// the eager bundle along with it.

import { rollValue } from './tables.js';
import flavor from '../data/tables-flavor.json';

const FLAVOR_SENSES = ['smells', 'sounds', 'lights', 'tactile', 'motes'];

// Roll a single short sensory beat from a random sense table.
export function rollFlavorBeat() {
  const kind = FLAVOR_SENSES[Math.floor(Math.random() * FLAVOR_SENSES.length)];
  return rollValue(flavor[kind]);
}

// Stack N sensory beats after a base atmosphere line, trying to pull each from
// a different sense table so the same kind doesn't repeat in one location.
export function composeAtmosphere(base, count = 2) {
  const taken = new Set();
  const beats = [];
  for (let i = 0; i < count; i++) {
    let kind;
    for (let j = 0; j < 6; j++) {
      kind = FLAVOR_SENSES[Math.floor(Math.random() * FLAVOR_SENSES.length)];
      if (!taken.has(kind)) break;
    }
    taken.add(kind);
    beats.push(rollValue(flavor[kind]));
  }
  return [base, ...beats].filter(Boolean).join(' ');
}
