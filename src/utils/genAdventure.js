// Shared building blocks for the procedural generators (settlement, scenario,
// dungeon). Two layers: pure schema builders (no data dependencies) and content
// rollers that draw on the canonical tables.

import { slugify } from './validate.js';
import { rollDie } from './dice.js';
import { rollValue } from './tables.js';
import names from '../data/tables-names.json';
import npc from '../data/tables-npc.json';
import traits from '../data/tables-traits.json';
import bestiary from '../data/bestiary.json';

// Re-export flavor helpers from the standalone module so existing importers of
// composeAtmosphere from genAdventure.js keep working without dragging the
// bestiary into eager bundles that only want flavor.
export { rollFlavorBeat, composeAtmosphere } from './flavor.js';

// ---------- schema builders ----------

export function makeExit(fromId, target, label, opts = {}) {
  return {
    id: `${fromId}-to-${target}`,
    label: label || `Go to ${target}`,
    target,
    condition: opts.condition ?? null,
    locked: opts.locked ?? false,
  };
}

// Returns a schema-complete node, filling every field the runner/validator
// expects so generated output never trips a validation error.
export function makeNode(node) {
  const c = node.contents || {};
  return {
    id: node.id,
    title: node.title || 'Untitled',
    type: node.type || 'location',
    atmosphere: node.atmosphere || '',
    read_aloud: node.read_aloud || '',
    contents: {
      description: c.description || '',
      items: c.items || [],
      enemies: c.enemies || [],
      npcs: c.npcs || [],
      traps: c.traps || [],
      secrets: c.secrets || [],
    },
    rules: node.rules || [],
    gm_notes: node.gm_notes || '',
    exits: node.exits || [],
    tags: node.tags || [],
  };
}

export function finalizeAdventure({ title, author, description, system, nodes, startNodeId, license }) {
  return {
    meta: {
      // Unique id so two same-named generations don't collide in the library or
      // in per-adventure session storage.
      id: `${slugify(title)}-${randomSuffix()}`,
      title,
      author: author || 'Module Runner — Generator',
      version: '1.0',
      system: system || 'morkborg',
      description: description || '',
      startNode: startNodeId,
      license: license || 'Generated content. Roll if you doubt it.',
    },
    nodes,
  };
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 6);
}

export function capitalize(s) {
  const t = String(s ?? '').trim();
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}

// (sensory flavor helpers live in ./flavor.js and are re-exported above)

// ---------- content rollers ----------

const ATTITUDES = ['friendly', 'neutral', 'neutral', 'hostile'];

export function rollNpc({ attitude } = {}) {
  const occupation = rollValue(npc.occupations);
  const trait = rollValue(traits.traits);
  const body = rollValue(traits.bodies);
  const habit = rollValue(traits.habits);
  const secret = rollValue(npc.secrets);
  return {
    name: rollValue(names.entries),
    attitude: attitude || rollValue(ATTITUDES),
    description: `${occupation}. ${body} ${trait}.`,
    notes: `Habit: ${habit} — Secret: ${secret}`,
  };
}

// 48 of 97 bestiary entries are wilderness fauna from the Eat-Prey-Kill regional
// supplement. Picking uniformly fills generated dungeons with carrion owls; this
// helper carves the pool by context so dungeons and settlements get undead /
// cultists / constructs / demons, and wilderness travel gets the fauna.
function isWildernessFauna(entry) {
  return /Eat[-_]?Prey[-_]?Kill/i.test(entry?.source || '');
}
function bestiaryPool(context) {
  if (context === 'dungeon' || context === 'urban') {
    const filtered = bestiary.entries.filter((e) => !isWildernessFauna(e));
    return filtered.length > 0 ? filtered : bestiary.entries;
  }
  if (context === 'wilderness') {
    const filtered = bestiary.entries.filter(isWildernessFauna);
    return filtered.length > 0 ? filtered : bestiary.entries;
  }
  return bestiary.entries;
}

// Pull a sanitized enemy stat block out of the bestiary. The source data is
// uneven (string HP, occasional prose in the attack field), so clamp it into the
// shape the EnemyCard / CombatTracker expect. `boss` biases toward a beefier
// entry and hardens it for a climax. `context` ('dungeon' | 'urban' |
// 'wilderness' | undefined) filters the pool so the right kind of monster
// shows up for the right kind of location.
export function bestiaryEnemy({ boss = false, context } = {}) {
  const pool = bestiaryPool(context);
  let e = rollValue(pool);
  if (boss) {
    for (let i = 0; i < 6; i++) {
      const cand = rollValue(pool);
      if ((parseInt(cand.hp, 10) || 0) > (parseInt(e.hp, 10) || 0)) e = cand;
    }
  }
  let hp = parseInt(String(e.hp), 10);
  if (!hp || Number.isNaN(hp)) hp = boss ? 12 + rollDie(8) : 3 + rollDie(6);
  else if (boss) hp = Math.round(hp * 1.5) + 4;

  const moraleDigits = String(e.morale ?? '').match(/\d+/);
  const attackRaw = String(e.attack ?? '').trim();
  return {
    name: e.name || 'A nameless horror',
    hp,
    morale: boss ? '—' : moraleDigits ? moraleDigits[0] : String(3 + rollDie(6)),
    speed: 'normal',
    attack: attackRaw && attackRaw.length <= 70 ? attackRaw : 'Strikes, d6',
    special: e.special && String(e.special).length <= 200 ? String(e.special) : '',
    notes: e.descriptor
      ? `${e.descriptor}${e.source ? ` (${e.source})` : ''}`
      : e.source
        ? `Source: ${e.source}`
        : '',
  };
}
