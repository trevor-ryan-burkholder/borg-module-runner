// Generate a seeded multi-site scenario with branching:
//
//   Hook → [main-1 ↔ main-2 ↔ … main-N] → Twist → Antechamber → Climax
//                ↘ side-i (optional)         (locked: needs a relic-key
//                                             held at one side site)
//
// Each main site carries denser content (2–3 enemies + traps/items/NPCs/secrets);
// side sites are short, treasure-and-lore branches; one designated side site
// holds the relic-key that opens the climax. Returns a schema-valid adventure.

import { rollDie } from './dice.js';
import { rollValue } from './tables.js';
import {
  makeNode,
  makeExit,
  finalizeAdventure,
  rollNpc,
  bestiaryEnemy,
  capitalize,
  composeAtmosphere,
} from './genAdventure.js';
import gm from '../data/tables-gm.json';
import sc from '../data/tables-scenario.json';
import traps from '../data/tables-traps.json';
import items from '../data/tables-items.json';
import weather from '../data/tables-weather.json';

const HOOK = 'hook';
const TWIST = 'twist';
const ANTE = 'antechamber';
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

function chance(p) {
  return Math.random() < p;
}

function pickIndex(n) {
  return Math.floor(Math.random() * n);
}

export function generateScenario() {
  const where = rollValue(gm.adventure_seed_where.entries);
  const who = rollValue(gm.adventure_seed_who.entries);
  const why = rollValue(gm.adventure_seed_why.entries);
  const complication = rollValue(gm.troubling_tales.entries);
  const villain = rollValue(sc.villain_titles);
  const objective = rollValue(sc.objectives);
  const twist = rollValue(sc.twists);
  const climaxKey = rollValue(sc.climax_keys);
  const warden = rollValue(sc.warden_titles);

  // 3–4 main sites; each gets denser content than v1.
  const mainSiteCount = 3 + rollDie(2) - 1; // 3 or 4

  const mainSites = [];
  for (let i = 0; i < mainSiteCount; i++) {
    const id = `site-${i + 1}`;
    const enemyCount = 1 + rollDie(2); // 2 or 3
    const enemies = Array.from({ length: enemyCount }, () => bestiaryEnemy());
    const traps_ = chance(0.5) ? [rollValue(traps.entries)] : [];
    const items_ = chance(0.75) ? [rollValue(items.entries)] : [];
    if (chance(0.4)) items_.push(rollValue(items.entries));
    const npcs_ = chance(0.5) ? [rollNpc()] : [];
    const secrets_ = [`A thread of the truth: ${twist}`];
    if (chance(0.5)) secrets_.push(`Loose lore: ${rollValue(sc.side_secrets)}`);

    mainSites.push(
      makeNode({
        id,
        title: rollValue(sc.site_types),
        atmosphere: composeAtmosphere(rollValue(sc.site_atmospheres), 2),
        contents: {
          description: '',
          items: items_,
          enemies,
          npcs: npcs_,
          traps: traps_,
          secrets: secrets_,
        },
        tags: ['site'],
      })
    );
  }

  // Optional side sites: 50% chance per main site (and we guarantee at least one
  // so the climax-key thread exists).
  const sideAttachments = [];
  for (let i = 0; i < mainSiteCount; i++) {
    if (chance(0.5)) sideAttachments.push({ parentIdx: i });
  }
  if (sideAttachments.length === 0) {
    sideAttachments.push({ parentIdx: pickIndex(mainSiteCount) });
  }
  // One designated side site holds the climax-key.
  const keySideIdx = pickIndex(sideAttachments.length);

  const sideNodes = sideAttachments.map((a, k) => {
    const isKey = k === keySideIdx;
    const sideId = `side-${a.parentIdx + 1}-${k + 1}`;
    const itemsHere = [rollValue(items.entries)];
    if (chance(0.6)) itemsHere.push(rollValue(items.entries));
    const enemies = chance(0.4) ? [bestiaryEnemy()] : [];
    const traps_ = chance(0.3) ? [rollValue(traps.entries)] : [];
    const secrets_ = isKey
      ? [
          `THE RELIC: ${climaxKey} — the key that opens the inner door of the climax. Hidden here behind ${rollValue(sc.side_secrets).toLowerCase()}`,
        ]
      : [`Loose lore: ${rollValue(sc.side_secrets)}`];
    if (chance(0.4) && !isKey) secrets_.push(`Whispered: ${rollValue(sc.side_secrets)}`);

    return {
      node: makeNode({
        id: sideId,
        title: rollValue(sc.side_site_types),
        atmosphere: composeAtmosphere(rollValue(sc.site_atmospheres), 2),
        contents: {
          description: isKey
            ? `Holds the relic that opens the inner door of the climax: ${climaxKey}.`
            : '',
          items: itemsHere,
          enemies,
          npcs: chance(0.3) ? [rollNpc()] : [],
          traps: traps_,
          secrets: secrets_,
        },
        gm_notes: isKey
          ? `KEY LOCATION. The party who clears this site claims ${climaxKey} and bypasses the warden cleanly at the antechamber (in-app 🔒 unlocks the climax door).`
          : 'Optional. Reward exploration with the listed loot and a piece of lore.',
        tags: isKey ? ['side', 'key'] : ['side'],
      }),
      parentIdx: a.parentIdx,
      isKey,
    };
  });

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
    gm_notes: `Seed — WHO: ${who} · WHERE: ${where} · WHY: ${why}\nKey to seek (held at a side location): ${climaxKey}.\nWatch for: ${warden} at the antechamber.`,
    exits: [makeExit(HOOK, mainSites[0].id, 'Set out')],
    tags: ['start'],
  });

  // Twist.
  const twistNode = makeNode({
    id: TWIST,
    title: 'The Turn',
    atmosphere: composeAtmosphere(rollValue(sc.site_atmospheres), 2),
    read_aloud: 'It is here that the shape of things changes.',
    contents: {
      description: `The revelation: ${twist}`,
      items: [],
      enemies: [],
      npcs: [],
      traps: [],
      secrets: [],
    },
    gm_notes: 'Let the players feel the floor tilt. The antechamber is one room away; after it, the climax.',
    exits: [makeExit(TWIST, ANTE, "Onward, to the climax's antechamber")],
    tags: ['twist'],
  });

  // Antechamber: warden enemy + locked inner door. Spread rather than mutate
  // so the helper's return contract stays read-only at the call site.
  const wardenBase = bestiaryEnemy();
  const wardenEnemy = { ...wardenBase, name: `${wardenBase.name}, ${warden}` };
  const anteTraps = chance(0.5) ? [rollValue(traps.entries)] : [];
  const anteNode = makeNode({
    id: ANTE,
    title: rollValue(sc.antechamber_themes),
    atmosphere: composeAtmosphere('A waiting-room that has waited a long time for you.', 2),
    read_aloud: `${capitalize(warden)} bars the inner door. Without ${climaxKey} the door will not open at all; with it, the way is simply open.`,
    contents: {
      description: `The last room before the climax. The warden defends the way. The inner door opens only to ${climaxKey} — held at a side location.`,
      items: [],
      enemies: [wardenEnemy],
      npcs: [],
      traps: anteTraps,
      secrets: [
        `The warden's keys hang on a ring — only one fits, and it bears the same mark as ${climaxKey}.`,
      ],
    },
    gm_notes: `The locked inner door opens to ${climaxKey}. When the party brings the relic, use the in-app 🔒 to unlock the exit.`,
    exits: [
      makeExit(ANTE, CLIMAX, 'Through the inner door', {
        condition: `Sealed. Opens to ${climaxKey} (held at one of the side locations).`,
        locked: true,
      }),
      makeExit(ANTE, TWIST, 'Back through the turn'),
    ],
    tags: ['antechamber'],
  });

  // Climax: boss + treasure.
  const boss = bestiaryEnemy({ boss: true });
  const bossName = `${boss.name}, ${villain}`;
  const climaxItems = [rollValue(items.entries), rollValue(items.entries)];
  if (chance(0.5)) climaxItems.push(rollValue(items.entries));

  const climaxNode = makeNode({
    id: CLIMAX,
    title: capitalize(rollValue(sc.climax_types)),
    atmosphere: composeAtmosphere('Whatever was coming has finished arriving.', 2),
    read_aloud: `To ${objective}, you go through ${villain} first.`,
    contents: {
      description: `End it here, then ${objective} — if anything is left to.`,
      items: climaxItems,
      enemies: [{ ...boss, name: bossName }],
      npcs: [],
      traps: [],
      secrets: [`The cost: ${twist}`],
    },
    gm_notes: `Boss: ${bossName}. Objective was to ${objective}. A party who brought the relic faces a clean fight; one who forced the antechamber pays.`,
    exits: [],
    tags: ['climax', 'end'],
  });

  // Stitch exits.
  mainSites.forEach((site, i) => {
    const forward = i < mainSites.length - 1 ? mainSites[i + 1].id : TWIST;
    const back = i > 0 ? mainSites[i - 1].id : HOOK;
    site.exits = [
      makeExit(site.id, forward, i === mainSites.length - 1 ? 'On to the turn' : 'Press on'),
      makeExit(site.id, back, 'Back the way you came'),
    ];
    sideAttachments
      .map((a, k) => ({ ...a, k }))
      .filter((a) => a.parentIdx === i)
      .forEach((a) => {
        const sideNode = sideNodes[a.k].node;
        site.exits.push(
          makeExit(site.id, sideNode.id, `A side path: ${sideNode.title.toLowerCase()}`)
        );
        sideNode.exits = [makeExit(sideNode.id, site.id, 'Back to the main path')];
      });
  });

  return finalizeAdventure({
    title: `${capitalize(villain)} — ${stripPrep(where)}`,
    author: 'Module Runner — Scenario Generator',
    description: `${capitalize(who)}; ${lower(why)}.`,
    system: 'morkborg',
    nodes: [
      hookNode,
      ...mainSites,
      ...sideNodes.map((s) => s.node),
      twistNode,
      anteNode,
      climaxNode,
    ],
    startNodeId: HOOK,
  });
}
