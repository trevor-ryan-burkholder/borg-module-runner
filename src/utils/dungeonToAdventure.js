// Convert a generated dungeon (sectioned rooms) into an adventure JSON shape.
// The new dungeon shape uses explicit room ids and plural content arrays.

import { makeNode, makeExit, finalizeAdventure } from './genAdventure.js';

export function dungeonToAdventure(dungeon) {
  const startId = dungeon.rooms[0]?.id ?? 'entrance';

  const nodes = dungeon.rooms.map((room) => {
    const exits = (room.exits ?? []).map((e) =>
      makeExit(room.id, e.target, e.label, { condition: e.condition ?? null, locked: !!e.locked })
    );

    // Default the climax / last room as a terminal so the validator stays clean
    // even if no other tag was provided.
    const tags = room.tags && room.tags.length
      ? room.tags
      : room.section === 'climax'
        ? ['climax', 'end']
        : room.section === 'entrance'
          ? ['start']
          : [];

    return makeNode({
      id: room.id,
      title: room.title,
      type: 'location',
      atmosphere: room.atmosphere || '',
      read_aloud: room.read_aloud || '',
      contents: {
        description: room.description || '',
        items: room.items || [],
        enemies: room.enemies || [],
        npcs: room.npcs || [],
        traps: room.traps || [],
        secrets: room.secrets || [],
      },
      rules: room.rules || [],
      gm_notes: room.gm_notes || '',
      exits,
      tags,
    });
  });

  return finalizeAdventure({
    title: dungeon.name,
    author: 'Module Runner — Dungeon Generator',
    description: dungeon.feature || 'A procedurally generated bedeviled dungeon.',
    system: dungeon.system || 'morkborg',
    nodes,
    startNodeId: startId,
    license: 'Generated content. Roll if you doubt it.',
  });
}
