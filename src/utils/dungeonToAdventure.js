// Convert a generated dungeon (rooms + meta) into an adventure JSON shape that
// matches the runner's loader/validator.

export function dungeonToAdventure(dungeon) {
  const nodes = dungeon.rooms.map((room, i) => {
    const id = `room-${i + 1}`;
    const exits = (room.exits ?? []).map((target, ei) => ({
      id: `exit-${i + 1}-${ei}`,
      label: `Go to ${nameOf(dungeon.rooms, target) ?? `room ${target + 1}`}`,
      target: `room-${target + 1}`,
      condition: null,
      locked: false,
    }));

    const enemies = room.enemy
      ? [
          {
            name: room.enemy.name || 'A creature',
            hp: parseInt(String(room.enemy.hp || '6'), 10) || 6,
            morale: room.enemy.morale || '7',
            speed: 'normal',
            attack: room.enemy.attack || 'd6',
            special: room.enemy.special || '',
            notes: room.enemy.descriptor || '',
          },
        ]
      : [];

    const items = room.item ? [room.item] : [];
    const traps = room.trap
      ? [
          {
            name: room.trap.name,
            trigger: room.trap.trigger || 'See description',
            effect: room.trap.effect || 'GM judgement',
            dr: room.trap.dr || '12',
          },
        ]
      : [];
    const secrets = room.secret ? [room.secret] : [];

    return {
      id,
      title: room.title,
      type: 'location',
      atmosphere: room.atmosphere || '',
      read_aloud: '',
      contents: {
        description: room.description || '',
        items,
        enemies,
        npcs: [],
        traps,
        secrets,
      },
      rules: [],
      gm_notes: room.gm_notes || '',
      exits,
      visited: false,
      tags: i === 0 ? ['start'] : i === dungeon.rooms.length - 1 ? ['end'] : [],
    };
  });

  return {
    meta: {
      // Unique id so two same-named dungeons don't collide in the library or in
      // per-adventure session storage.
      id: `${slugify(dungeon.name)}-${randomSuffix()}`,
      title: dungeon.name,
      author: 'Module Runner — Dungeon Generator',
      version: '1.0',
      description: dungeon.feature || 'A procedurally generated bedeviled dungeon.',
      startNode: 'room-1',
      license: 'Generated content. Roll if you doubt it.',
      system: dungeon.system || 'morkborg',
    },
    nodes,
  };
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'dungeon';
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 6);
}

function nameOf(rooms, idx) {
  return rooms[idx]?.title;
}
