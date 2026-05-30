// Generate a structured dungeon: entrance → body (last room = antechamber) →
// climax, with side rooms branching off non-final body rooms, plus 1–2 locked
// shortcuts between non-adjacent body rooms. The inner-door from antechamber to
// climax is locked; one side room is the designated key-holder.
//
// Returned shape (consumed by dungeonToAdventure + DungeonGenerator preview):
//   { name, feature, inhabitants, danger, rooms: [<room>, ...] }
// Each room: { id, section, title, atmosphere, description, enemies[], items[],
//              npcs[], traps[], secrets[], rules[], gm_notes, exits[], tags[] }
// Each exit: { target, label, locked, condition }

import { rollValue } from './tables.js';
import { bestiaryEnemy, rollNpc } from './genAdventure.js';
import dungeons from '../data/tables-bedeviled-dungeons.json';
import traps from '../data/tables-traps.json';
import items from '../data/tables-items.json';

const ROOM_SECRET_SEEDS = [
  'A loose stone hides a key to another room.',
  'Scratched into the floor: a name nobody here remembers.',
  'A draft from a hidden passage. Follow it back toward the threshold.',
  'The bones in the corner are arranged in a binding circle. They watch.',
  'Half a treasure map, the rest in some other dungeon.',
  'A trapdoor under the moss leads down, then nowhere.',
  'Carved in the wall: the name of the next person to die here.',
  'A drawing of the boss, signed by a child.',
];

const SHORTCUT_CONDITIONS = [
  'Cracked through — needs the bone-and-iron key from a side passage.',
  'Collapsed in — can be cleared by an NPC ally or two PCs at Strength DR12.',
  'Sealed by an old rune — broken only by a true name spoken aloud.',
  "Bricked over — the bricks are loose to anyone who knows the warden's sigil.",
];

function chance(p) {
  return Math.random() < p;
}

function pickFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function blankRoom(id, section, title) {
  return {
    id,
    section,
    title,
    atmosphere: '',
    description: '',
    enemies: [],
    items: [],
    npcs: [],
    traps: [],
    secrets: [],
    rules: [],
    gm_notes: '',
    exits: [],
    tags: [],
  };
}

export function generateDungeon(opts = {}) {
  const total = Math.max(6, Math.min(14, opts.rooms ?? 9));
  // Allocate: 1 entrance + B body + S sides + 1 climax = total.
  const S = Math.max(1, Math.floor((total - 2) / 4));
  const B = total - 2 - S;

  const name = `${rollValue(dungeons.name_adjectives)} ${rollValue(dungeons.name_nouns)}`;
  const feature = rollValue(dungeons.features);
  const inhabitants = rollValue(dungeons.inhabitants);
  const danger = rollValue(dungeons.imminent_danger);

  const rooms = [];

  // Entrance.
  const entrance = blankRoom('entrance', 'entrance', 'The Threshold');
  entrance.atmosphere = rollValue(dungeons.room_atmospheres);
  entrance.enemies.push(bestiaryEnemy());
  entrance.npcs.push(rollNpc({ attitude: 'neutral' }));
  entrance.gm_notes = `Tone: ${feature}. Inhabitants: ${inhabitants}.`;
  entrance.tags = ['start'];
  rooms.push(entrance);

  // Body (last room is the antechamber).
  const body = [];
  for (let i = 0; i < B; i++) {
    const isLast = i === B - 1;
    const r = blankRoom(`body-${i}`, 'body', isLast ? 'The Antechamber' : `Room ${i + 1}`);
    r.atmosphere = rollValue(dungeons.room_atmospheres);

    if (isLast) {
      const warden = bestiaryEnemy();
      warden.name = `${warden.name} (Warden)`;
      r.enemies.push(warden);
      if (chance(0.5)) r.enemies.push(bestiaryEnemy());
      r.gm_notes = 'Antechamber. The inner door is locked — the relic-key from a side passage opens it.';
      r.tags = ['antechamber'];
    } else {
      const eCount = (chance(0.7) ? 1 : 0) + (chance(0.4) ? 1 : 0);
      for (let e = 0; e < eCount; e++) r.enemies.push(bestiaryEnemy());
      if (chance(0.35)) r.traps.push(rollValue(traps.entries));
      if (chance(0.55)) r.items.push(rollValue(items.entries));
      if (chance(0.3)) r.npcs.push(rollNpc());
      if (chance(0.4)) r.secrets.push(pickFrom(ROOM_SECRET_SEEDS));
    }
    body.push(r);
    rooms.push(r);
  }

  // Side rooms — attached to a non-antechamber body room.
  const sides = [];
  const sideParents = [];
  const eligibleParents = Math.max(1, B - 1);
  for (let s = 0; s < S; s++) {
    const parent = Math.floor(Math.random() * eligibleParents);
    const r = blankRoom(`side-${s}`, 'side', `Side: ${rollValue(dungeons.features)}`);
    r.atmosphere = rollValue(dungeons.room_atmospheres);
    r.items.push(rollValue(items.entries));
    if (chance(0.6)) r.items.push(rollValue(items.entries));
    if (chance(0.4)) r.enemies.push(bestiaryEnemy());
    if (chance(0.3)) r.traps.push(rollValue(traps.entries));
    if (chance(0.5)) r.secrets.push(pickFrom(ROOM_SECRET_SEEDS));
    sides.push(r);
    sideParents.push(parent);
    rooms.push(r);
  }

  // Key-holder side.
  const keyIdx = Math.floor(Math.random() * sides.length);
  const keyRoom = sides[keyIdx];
  keyRoom.secrets.push(
    'A bone-and-iron key glows faintly here. It bears the same mark as the inner door of the sanctum.'
  );
  keyRoom.tags = ['key'];
  keyRoom.gm_notes =
    'KEY ROOM: holds the relic that opens the inner door of the climax. Use the in-app 🔒 at the antechamber once the party claims it.';

  // Climax.
  const climax = blankRoom('climax', 'climax', 'The Black Heart');
  climax.atmosphere = 'The room everything else fed.';
  climax.enemies.push(bestiaryEnemy({ boss: true }));
  const treasureCount = 2 + (chance(0.5) ? 1 : 0);
  for (let t = 0; t < treasureCount; t++) climax.items.push(rollValue(items.entries));
  climax.secrets.push(pickFrom(ROOM_SECRET_SEEDS));
  climax.gm_notes = `Boss room. Imminent danger: ${danger}.`;
  climax.tags = ['climax', 'end'];
  rooms.push(climax);

  // Exits.
  entrance.exits.push({ target: body[0].id, label: 'Inward', locked: false, condition: null });

  body.forEach((r, i) => {
    const isLast = i === B - 1;
    const forwardTarget = isLast ? climax.id : body[i + 1].id;
    const backTarget = i > 0 ? body[i - 1].id : entrance.id;

    r.exits.push({
      target: forwardTarget,
      label: isLast ? 'Through the inner door' : 'Press on',
      locked: isLast,
      condition: isLast
        ? `Sealed. Opens to the bone-and-iron key (held at ${keyRoom.title.toLowerCase()}).`
        : null,
    });
    r.exits.push({
      target: backTarget,
      label: 'Back the way you came',
      locked: false,
      condition: null,
    });
  });

  sides.forEach((r, s) => {
    const parent = body[sideParents[s]];
    r.exits.push({
      target: parent.id,
      label: 'Back to the main path',
      locked: false,
      condition: null,
    });
    parent.exits.push({
      target: r.id,
      label: `A side passage: ${r.title.toLowerCase()}`,
      locked: false,
      condition: null,
    });
  });

  // Locked shortcuts between non-adjacent body rooms (skip antechamber).
  if (B >= 4) {
    const shortcutCount = 1 + (chance(0.5) ? 1 : 0);
    const seen = new Set();
    let tries = 0;
    while (seen.size < shortcutCount && tries++ < 16) {
      const a = Math.floor(Math.random() * (B - 1));
      const b = Math.floor(Math.random() * (B - 1));
      if (a === b || Math.abs(a - b) <= 1) continue;
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const condition = pickFrom(SHORTCUT_CONDITIONS);
      body[a].exits.push({
        target: body[b].id,
        label: `A cracked passage to ${body[b].title.toLowerCase()}`,
        locked: true,
        condition,
      });
      body[b].exits.push({
        target: body[a].id,
        label: `A cracked passage to ${body[a].title.toLowerCase()}`,
        locked: true,
        condition,
      });
    }
  }

  return { name, feature, inhabitants, danger, rooms };
}
