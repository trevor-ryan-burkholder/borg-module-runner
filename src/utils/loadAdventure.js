// Static imports of bundled adventures and rules references.
// Vite bundles each JSON into the build; the registry tells us what to expose.

import gravesLeftWanting from '../data/graves-left-wanting.json';
import rotblackSludge from '../data/rotblack-sludge.json';
import sepulchre from '../data/sepulchre-of-the-swamp-witch.json';
import deathZiggurat from '../data/death-ziggurat.json';
import goblinGrinder from '../data/goblin-grinder.json';
import devilsTomb from '../data/devils-tomb.json';
import bloat from '../data/bloat.json';
import eatPreyKill from '../data/eat-prey-kill.json';
import tenebrousReliquary from '../data/tenebrous-reliquary.json';
import shadowKingsPalace from '../data/shadow-kings-palace.json';
import theHollowCity from '../data/the-hollow-city.json';
import theFrozenCourt from '../data/the-frozen-court.json';
import roninBorgStarter from '../data/ronin-borg-starter.json';
import rulesMorkborg from '../data/rules-reference.json';
import rulesRoninBorg from '../data/rules-reference-ronin-borg.json';
import registry from '../data/adventures-registry.json';

const BUNDLED = {
  'graves-left-wanting': gravesLeftWanting,
  'rotblack-sludge': rotblackSludge,
  'sepulchre-of-the-swamp-witch': sepulchre,
  'death-ziggurat': deathZiggurat,
  'goblin-grinder': goblinGrinder,
  'devils-tomb': devilsTomb,
  'bloat': bloat,
  'eat-prey-kill': eatPreyKill,
  'tenebrous-reliquary': tenebrousReliquary,
  'shadow-kings-palace': shadowKingsPalace,
  'the-hollow-city': theHollowCity,
  'the-frozen-court': theFrozenCourt,
  'ronin-borg-starter': roninBorgStarter,
};

const RULES_BY_SYSTEM = {
  morkborg: rulesMorkborg,
  'ronin-borg': rulesRoninBorg,
};

export function listBundledAdventures() {
  return registry.bundled;
}

export function getBundledAdventure(id) {
  return BUNDLED[id] || null;
}

export function getRulesForSystem(system) {
  return RULES_BY_SYSTEM[system] || rulesMorkborg;
}

export function isBundled(id) {
  return Object.prototype.hasOwnProperty.call(BUNDLED, id);
}
