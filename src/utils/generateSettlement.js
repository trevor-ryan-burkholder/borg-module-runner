// Generate a runnable settlement: a hub ("the gate") opening onto spoke
// locations (tavern, market, shrine…) and the seat of power as the climax.
// Returns a schema-valid adventure object ready for the runner / library.

import { rollValue, rollN } from './tables.js';
import {
  makeNode,
  makeExit,
  finalizeAdventure,
  rollNpc,
  bestiaryEnemy,
  capitalize,
} from './genAdventure.js';
import S from '../data/tables-settlement.json';

const HUB = 'gate';
const SEAT = 'seat';

function rollName() {
  return `${rollValue(S.name_prefix)}${rollValue(S.name_suffix)}`;
}

function pickSize(sizeKey) {
  if (sizeKey) {
    const found = S.sizes.find((s) => s.key === sizeKey);
    if (found) return found;
  }
  return rollValue(S.sizes);
}

function pickRegion(regionName) {
  if (regionName) {
    const found = S.regions.find((r) => r.name === regionName);
    if (found) return found;
  }
  return rollValue(S.regions);
}

function spokeSecret(problem) {
  return `A clue: someone here knows the why behind it — ${lower(problem)}`;
}

function lower(s) {
  return String(s).charAt(0).toLowerCase() + String(s).slice(1);
}

export function generateSettlement(opts = {}) {
  const size = pickSize(opts.size);
  const region = pickRegion(opts.region);
  const name = rollName();
  const power = rollValue(S.powers);
  const [fOpen, fHidden] = rollN(S.factions, 2).map((r) => r.value);
  const problem = rollValue(S.problems);
  const rumors = rollN(S.rumors, 3).map((r) => r.value);
  const danger = rollValue(S.dangers);

  const [minSpokes, maxSpokes] = size.spokes;
  const spokeCount = minSpokes + Math.floor(Math.random() * (maxSpokes - minSpokes + 1));
  const locTypes = rollN(S.location_types, spokeCount).map((r) => r.value);

  // Spoke nodes — each links back to the gate so none is a dead end.
  const spokeNodes = locTypes.map((t, i) => {
    const id = `place-${i + 1}`;
    const title = t.kind === 'tavern' ? `${rollValue(S.tavern_names)} (tavern)` : t.title;
    const contents = { description: '', items: [], enemies: [], npcs: [], traps: [], secrets: [] };
    if (t.npc) contents.npcs.push(rollNpc());
    if (t.enemy) contents.enemies.push(bestiaryEnemy());
    if (t.sells) {
      contents.items.push(rollValue(S.wares));
      contents.items.push(rollValue(region.goods));
    }
    if (t.secret) contents.secrets.push(spokeSecret(problem));
    return makeNode({
      id,
      title,
      atmosphere: t.atmosphere,
      contents,
      exits: [makeExit(id, HUB, `Back to the gate of ${name}`)],
      tags: [t.kind],
    });
  });

  // The seat of power — the climax.
  const seatContents = {
    description: `Here sits ${power.ruler}.`,
    items: [],
    enemies: [],
    npcs: [],
    traps: [],
    secrets: [`The truth: ${problem} The cause is in this room, and it already knows your name.`],
  };
  if (power.boss) seatContents.enemies.push(bestiaryEnemy({ boss: true }));
  else seatContents.npcs.push(rollNpc({ attitude: 'hostile' }));

  const seatNode = makeNode({
    id: SEAT,
    title: power.seat,
    atmosphere: 'The one warm room in town — and you will wish it were not.',
    read_aloud: `${capitalize(power.ruler)} receives you as though your arrival were both expected and already regretted.`,
    contents: seatContents,
    gm_notes: `This is where "${problem}" resolves. Reward the players who chased the rumors here.`,
    exits: [makeExit(SEAT, HUB, `Back to the gate of ${name}`)],
    tags: ['climax', 'end'],
  });

  // The gate / hub — the start node.
  const hubExits = [
    ...spokeNodes.map((n) => makeExit(HUB, n.id, n.title)),
    makeExit(HUB, SEAT, `Seek out ${power.ruler}`),
  ];
  const hubNode = makeNode({
    id: HUB,
    title: `The Gate of ${name}`,
    atmosphere: rollValue(S.atmospheres),
    read_aloud: `${name} — a ${size.label} of ${size.population}, in ${region.flavor}. Word is the place is troubled: ${lower(problem)}`,
    contents: {
      description: `${name} answers to ${power.ruler}. Openly, ${fOpen} hold sway; beneath that, ${fHidden} work in the dark. The affliction here: ${problem} What everyone fears most is ${danger}.`,
      items: [],
      enemies: [],
      npcs: [rollNpc({ attitude: 'neutral' })],
      traps: [],
      secrets: [],
    },
    gm_notes: `Rumors to feed the table:\n— ${rumors.join('\n— ')}`,
    exits: hubExits,
    tags: ['start', 'hub'],
  });

  return finalizeAdventure({
    title: capitalize(name),
    author: 'Module Runner — Settlement Generator',
    description: `A ${size.label} in ${region.name}, and the trouble that festers there.`,
    system: 'morkborg',
    nodes: [hubNode, ...spokeNodes, seatNode],
    startNodeId: HUB,
  });
}
