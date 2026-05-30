// Generate a runnable settlement with a richer graph than a strict hub-and-spoke:
//
//   [gate (hub)] — [place-1] ⟷ [place-2] ⟷ [place-3] ⟷ ... ⟷ [place-1]
//        \              \         \           \
//         [court-antechamber] → (locked) → [seat-inner (climax)]
//                                     ↑
//          a token held at ONE designated spoke opens the inner door
//                                     ↑
//           some spokes drop into a sub-location (backroom / crypt / basement)
//
// Spokes form a ring (each → its next and prev neighbour), with optional chords
// in city-sized settlements. The seat is split: an antechamber accessible from
// the gate, and the inner seat behind a locked door tied to the token. Returns
// a schema-valid adventure.

import { rollDie } from './dice.js';
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
const ANTE = 'court-antechamber';
const SEAT = 'seat-inner';

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

function lower(s) {
  return String(s).charAt(0).toLowerCase() + String(s).slice(1);
}

function chance(p) {
  return Math.random() < p;
}

function spokeSecret(problem) {
  return `A clue: someone here knows the why behind it — ${lower(problem)}`;
}

function buildSubLocationContents(sub, region, problem) {
  const c = { description: '', items: [], enemies: [], npcs: [], traps: [], secrets: [] };
  switch (sub.kind) {
    case 'backroom':
      c.npcs.push(rollNpc({ attitude: 'neutral' }));
      c.items.push(rollValue(S.wares));
      if (chance(0.5)) c.secrets.push(spokeSecret(problem));
      break;
    case 'crypt':
      c.enemies.push(bestiaryEnemy());
      c.items.push(rollValue(region.goods));
      c.secrets.push(spokeSecret(problem));
      break;
    case 'undercroft':
      c.items.push(rollValue(S.wares));
      c.items.push(rollValue(region.goods));
      if (chance(0.5)) c.enemies.push(bestiaryEnemy());
      c.secrets.push(`Smuggler's note: ${rollValue(S.rumors)}`);
      break;
    case 'basement':
      c.items.push(rollValue(S.wares));
      if (chance(0.5)) c.items.push(rollValue(region.goods));
      if (chance(0.5)) c.npcs.push(rollNpc({ attitude: 'neutral' }));
      c.secrets.push(`Smuggler's note: ${rollValue(S.rumors)}`);
      break;
    default:
      c.items.push(rollValue(S.wares));
  }
  return c;
}

export function generateSettlement(opts = {}) {
  const size = pickSize(opts.size);
  const region = pickRegion(opts.region);
  const name = rollName();
  const power = rollValue(S.powers);
  const [fOpen, fHidden] = rollN(S.factions, 2).map((r) => r.value);
  const problem = rollValue(S.problems);
  const rumors = rollN(S.rumors, 4).map((r) => r.value);
  const danger = rollValue(S.dangers);
  const token = rollValue(S.tokens);

  const [minSpokes, maxSpokes] = size.spokes;
  const spokeCount = minSpokes + Math.floor(Math.random() * (maxSpokes - minSpokes + 1));
  const locTypes = rollN(S.location_types, spokeCount).map((r) => r.value);
  const tokenSpokeIdx = Math.floor(Math.random() * spokeCount);

  // Per-size sub-location chance per spoke.
  const subChance = size.key === 'city' ? 0.6 : size.key === 'town' ? 0.4 : 0.2;

  // Build spokes + their optional sub-locations.
  const spokeNodes = [];
  const subNodes = [];

  locTypes.forEach((t, i) => {
    const id = `place-${i + 1}`;
    const title = t.kind === 'tavern' ? `${rollValue(S.tavern_names)} (tavern)` : t.title;
    const isTokenHolder = i === tokenSpokeIdx;

    const contents = { description: '', items: [], enemies: [], npcs: [], traps: [], secrets: [] };
    if (t.npc) contents.npcs.push(rollNpc());
    if (chance(0.4)) contents.npcs.push(rollNpc()); // second NPC sometimes
    if (t.enemy) contents.enemies.push(bestiaryEnemy());
    if (t.sells) {
      contents.items.push(rollValue(S.wares));
      contents.items.push(rollValue(region.goods));
      if (chance(0.5)) contents.items.push(rollValue(S.wares));
    }
    if (t.secret) contents.secrets.push(spokeSecret(problem));
    if (isTokenHolder) {
      contents.items.push(`${token} — taken or earned here. It opens the inner seat.`);
      contents.secrets.push(`KEY SPOKE: holds ${token}. Without it, the inner door of ${power.seat} stays sealed.`);
    }

    const spoke = makeNode({
      id,
      title,
      atmosphere: t.atmosphere,
      contents,
      exits: [makeExit(id, HUB, `Back to the gate of ${name}`)],
      tags: [t.kind, ...(isTokenHolder ? ['key'] : [])],
    });
    spokeNodes.push(spoke);

    // Sub-location?
    if (t.sub && chance(subChance)) {
      const subId = `sub-${i + 1}`;
      const subNode = makeNode({
        id: subId,
        title: t.sub.title,
        atmosphere: t.sub.atmosphere,
        contents: buildSubLocationContents(t.sub, region, problem),
        exits: [makeExit(subId, id, `Back up to ${title}`)],
        tags: ['sub', t.sub.kind],
      });
      subNodes.push(subNode);
      spoke.exits.push(makeExit(id, subId, `Deeper: ${t.sub.title.toLowerCase()}`));
    }
  });

  // Inter-spoke ring: each spoke connects to its "next" neighbour. For ≥3 spokes,
  // add the reverse direction too so the ring is bidirectional without going
  // through the gate.
  if (spokeNodes.length >= 2) {
    for (let i = 0; i < spokeNodes.length; i++) {
      const next = (i + 1) % spokeNodes.length;
      if (i === next) continue;
      spokeNodes[i].exits.push(
        makeExit(spokeNodes[i].id, spokeNodes[next].id, `Around to ${spokeNodes[next].title.toLowerCase()}`)
      );
    }
  }
  if (spokeNodes.length >= 3) {
    for (let i = 0; i < spokeNodes.length; i++) {
      const prev = (i - 1 + spokeNodes.length) % spokeNodes.length;
      spokeNodes[i].exits.push(
        makeExit(spokeNodes[i].id, spokeNodes[prev].id, `Around to ${spokeNodes[prev].title.toLowerCase()}`)
      );
    }
  }

  // City chords: 1–2 cross-connections between non-adjacent spokes.
  if (size.key === 'city' && spokeNodes.length >= 4) {
    const chordCount = rollDie(2);
    const seen = new Set();
    for (let c = 0; c < chordCount; c++) {
      const a = Math.floor(Math.random() * spokeNodes.length);
      let b = Math.floor(Math.random() * spokeNodes.length);
      if (a === b) b = (b + 2) % spokeNodes.length;
      const adj =
        (a + 1) % spokeNodes.length === b ||
        (a - 1 + spokeNodes.length) % spokeNodes.length === b;
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (adj || seen.has(key) || a === b) continue;
      seen.add(key);
      spokeNodes[a].exits.push(
        makeExit(spokeNodes[a].id, spokeNodes[b].id, `Cross the square to ${spokeNodes[b].title.toLowerCase()}`)
      );
      spokeNodes[b].exits.push(
        makeExit(spokeNodes[b].id, spokeNodes[a].id, `Cross the square to ${spokeNodes[a].title.toLowerCase()}`)
      );
    }
  }

  // Court antechamber (between gate and inner seat).
  const wardenEnemy = bestiaryEnemy();
  wardenEnemy.notes = `Court warden — bars the inner door without ${token}.`;
  const anteNode = makeNode({
    id: ANTE,
    title: power.seat,
    atmosphere: 'The hall before the seat — and a warden who already knows your business.',
    contents: {
      description: `The waiting hall of ${power.ruler}. The warden bars the inner door, which opens only to ${token}.`,
      items: [],
      enemies: [wardenEnemy],
      npcs: [rollNpc({ attitude: 'neutral' })],
      traps: chance(0.4) ? [{ name: "The Warden's Eye", trigger: 'Standing in the hall without showing the token', effect: "The warden marks you. Each round of delay: Presence DR12 or be 'shown out' (knocked back to the gate, losing one carried item).", dr: '12' }] : [],
      secrets: [],
    },
    gm_notes: `The inner door opens to ${token} (in-app 🔒 unlocks it). The warden is a real fight, but the door is the obstacle.`,
    exits: [
      makeExit(ANTE, SEAT, `Through the inner door to the ${power.seat} proper`, {
        condition: `Sealed. Opens to ${token} (held at one of the spokes).`,
        locked: true,
      }),
      makeExit(ANTE, HUB, `Back to the gate of ${name}`),
    ],
    tags: ['antechamber'],
  });

  // Inner seat (the climax).
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
    title: `${power.seat} — the inner sanctum`,
    atmosphere: 'The warmest room in town, and you will wish it were not.',
    read_aloud: `${capitalize(power.ruler)} receives you as though your arrival were both expected and already regretted.`,
    contents: seatContents,
    gm_notes: `This is where "${problem}" resolves. Reward the players who chased the rumors and held the token.`,
    exits: [],
    tags: ['climax', 'end'],
  });

  // The gate hub (start).
  const hubExits = [
    ...spokeNodes.map((n) => makeExit(HUB, n.id, n.title)),
    makeExit(HUB, ANTE, `Up to ${power.seat}`),
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
    gm_notes: `Rumors:\n— ${rumors.join('\n— ')}\n\nThe inner seat opens only to ${token}, held at one of the spokes. Mark which on first reveal.`,
    exits: hubExits,
    tags: ['start', 'hub'],
  });

  return finalizeAdventure({
    title: capitalize(name),
    author: 'Module Runner — Settlement Generator',
    description: `A ${size.label} in ${region.name}, and the trouble that festers there.`,
    system: 'morkborg',
    nodes: [hubNode, ...spokeNodes, ...subNodes, anteNode, seatNode],
    startNodeId: HUB,
  });
}
