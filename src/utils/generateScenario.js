// Generate a seeded multi-site scenario: Hook → Sites → Twist → Climax, seeded
// by the canonical Adventure Seed tables (who / where / why). Returns a
// schema-valid adventure object for the Adventure Builder / library.

import { rollDie } from './dice.js';
import { rollValue } from './tables.js';
import {
  makeNode,
  makeExit,
  finalizeAdventure,
  rollNpc,
  bestiaryEnemy,
  capitalize,
} from './genAdventure.js';
import gm from '../data/tables-gm.json';
import sc from '../data/tables-scenario.json';
import traps from '../data/tables-traps.json';
import items from '../data/tables-items.json';
import weather from '../data/tables-weather.json';

const HOOK = 'hook';
const TWIST = 'twist';
const CLIMAX = 'climax';

function stripPrep(where) {
  return (
    String(where)
      .replace(/^(On|In|At|Near|Pretty much|Somewhere)\b/i, '')
      .replace(/^\s*(the|a)\s+/i, '')
      .trim() || String(where)
  );
}

function lower(s) {
  return String(s).charAt(0).toLowerCase() + String(s).slice(1);
}

export function generateScenario() {
  const where = rollValue(gm.adventure_seed_where.entries);
  const who = rollValue(gm.adventure_seed_who.entries);
  const why = rollValue(gm.adventure_seed_why.entries);
  const complication = rollValue(gm.troubling_tales.entries);
  const villain = rollValue(sc.villain_titles);
  const objective = rollValue(sc.objectives);
  const twist = rollValue(sc.twists);

  const siteCount = 2 + rollDie(2); // 3–4 sites

  // Site nodes (exits stitched after construction).
  const siteNodes = [];
  for (let i = 0; i < siteCount; i++) {
    const id = `site-${i + 1}`;
    const contents = { description: '', items: [], enemies: [], npcs: [], traps: [], secrets: [] };
    contents.enemies.push(bestiaryEnemy());
    if (rollDie(2) === 1) contents.enemies.push(bestiaryEnemy());
    if (rollDie(3) === 1) contents.traps.push(rollValue(traps.entries));
    if (rollDie(2) === 1) contents.items.push(rollValue(items.entries));
    if (rollDie(2) === 1) contents.npcs.push(rollNpc());
    contents.secrets.push(`A thread of the truth: ${twist}`);
    siteNodes.push(
      makeNode({
        id,
        title: rollValue(sc.site_types),
        atmosphere: rollValue(sc.site_atmospheres),
        contents,
        tags: ['site'],
      })
    );
  }

  // Hook (start).
  const patron = rollNpc({ attitude: 'neutral' });
  patron.notes = `${patron.notes} — Acting as your contact: ${who}.`;
  const hookNode = makeNode({
    id: HOOK,
    title: 'The Offer',
    atmosphere: `${rollValue(weather.entries)}. The kind of day that starts a thing like this.`,
    read_aloud: `${capitalize(who)} ${rollValue(sc.hook_framing)} The spark: ${lower(why)}. It begins ${lower(where)}.`,
    contents: {
      description: `Someone must ${objective}. It will not be clean. Complication in play: ${complication}`,
      items: [],
      enemies: [],
      npcs: [patron],
      traps: [],
      secrets: [],
    },
    gm_notes: `Seed — WHO: ${who} · WHERE: ${where} · WHY: ${why}`,
    exits: [makeExit(HOOK, siteNodes[0].id, 'Set out')],
    tags: ['start'],
  });

  // Twist node.
  const twistNode = makeNode({
    id: TWIST,
    title: 'The Turn',
    atmosphere: rollValue(sc.site_atmospheres),
    read_aloud: 'It is here that the shape of things changes.',
    contents: {
      description: `The revelation: ${twist}`,
      items: [],
      enemies: [],
      npcs: [],
      traps: [],
      secrets: [],
    },
    gm_notes: 'Let the players feel the floor tilt before the climax.',
    exits: [makeExit(TWIST, CLIMAX, 'Toward the end of it')],
    tags: ['twist'],
  });

  // Climax (end).
  const boss = bestiaryEnemy({ boss: true });
  const climaxNode = makeNode({
    id: CLIMAX,
    title: capitalize(rollValue(sc.climax_types)),
    atmosphere: 'Whatever was coming has finished arriving.',
    read_aloud: `To ${objective}, you go through ${villain} first.`,
    contents: {
      description: `End it here, then ${objective} — if anything is left to.`,
      items: [rollValue(items.entries)],
      enemies: [{ ...boss, name: `${boss.name}, ${villain}` }],
      npcs: [],
      traps: [],
      secrets: [`The cost: ${twist}`],
    },
    gm_notes: `Boss: ${boss.name}, ${villain}. The objective was to ${objective}.`,
    exits: [],
    tags: ['climax', 'end'],
  });

  // Stitch: hook → site1 → … → siteN → twist → climax, with back-links.
  siteNodes.forEach((n, i) => {
    const forward = i < siteNodes.length - 1 ? siteNodes[i + 1].id : TWIST;
    const back = i > 0 ? siteNodes[i - 1].id : HOOK;
    n.exits = [
      makeExit(n.id, forward, 'Press on'),
      makeExit(n.id, back, 'Back the way you came'),
    ];
  });

  return finalizeAdventure({
    title: `${capitalize(villain)} — ${stripPrep(where)}`,
    author: 'Module Runner — Scenario Generator',
    description: `${capitalize(who)}; ${lower(why)}.`,
    system: 'morkborg',
    nodes: [hookNode, ...siteNodes, twistNode, climaxNode],
    startNodeId: HOOK,
  });
}
