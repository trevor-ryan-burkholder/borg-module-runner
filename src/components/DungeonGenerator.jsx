import { useState } from 'react';
import { rollDie } from '../utils/dice.js';
import { rollValue } from '../utils/tables.js';
import { dungeonToAdventure } from '../utils/dungeonToAdventure.js';
import dungeons from '../data/tables-bedeviled-dungeons.json';
import traps from '../data/tables-traps.json';
import items from '../data/tables-items.json';
import bestiary from '../data/bestiary.json';

function rollDungeonName() {
  const adj = rollValue(dungeons.name_adjectives);
  const noun = rollValue(dungeons.name_nouns);
  return `${adj} ${noun}`;
}

function rollEnemy() {
  const e = rollValue(bestiary.entries);
  return e;
}

function rollRoom(idx) {
  // 1-in-3 chance no enemy, 1-in-4 trap, 1-in-3 item, 1-in-5 secret.
  const enemy = rollDie(3) > 1 ? rollEnemy() : null;
  const trap = rollDie(4) === 1 ? rollValue(traps.entries) : null;
  const item = rollDie(3) > 1 ? rollValue(items.entries) : null;
  const secret = rollDie(5) === 1 ? secretFor(idx) : null;
  return {
    title: `Room ${idx + 1}`,
    atmosphere: rollValue(dungeons.room_atmospheres),
    description: '',
    enemy,
    trap,
    item,
    secret,
    gm_notes: '',
    exits: [], // filled in later
  };
}

function secretFor(idx) {
  const seeds = [
    'A loose stone hides a key to another room.',
    'Scratched into the floor: a name nobody here remembers.',
    'A draft from a hidden passage. Follow it back to room 1.',
    'The bones in the corner are arranged in a binding circle. They watch.',
    'Half a treasure map, the rest in some other dungeon.',
    'A trapdoor under the moss leads down, then nowhere.',
  ];
  return seeds[idx % seeds.length];
}

function stitchExits(rooms) {
  // Linear chain with one branch: room K has two outgoing exits, one to K+1 and one to a later room.
  const branchAt = rooms.length >= 4 ? 1 + Math.floor(rollDie(Math.max(1, rooms.length - 3))) : null;
  rooms.forEach((r, i) => {
    const exits = [];
    if (i < rooms.length - 1) exits.push(i + 1);
    if (i > 0) exits.push(i - 1);
    if (branchAt != null && i === branchAt) {
      const branchTarget = Math.min(rooms.length - 1, branchAt + 2 + rollDie(2));
      if (!exits.includes(branchTarget)) exits.push(branchTarget);
    }
    r.exits = exits;
  });
  return rooms;
}

function generateDungeon(opts) {
  const count = Math.max(3, Math.min(12, opts.rooms ?? 6));
  const name = rollDungeonName();
  const feature = rollValue(dungeons.features);
  const inhabitants = rollValue(dungeons.inhabitants);
  const danger = rollValue(dungeons.imminent_danger);

  const rooms = Array.from({ length: count }, (_, i) => rollRoom(i));
  rooms[0].title = 'The Entrance';
  rooms[rooms.length - 1].title = 'The Black Heart';
  stitchExits(rooms);

  return { name, feature, inhabitants, danger, rooms };
}

export default function DungeonGenerator({ open, onClose, onRun }) {
  const [roomCount, setRoomCount] = useState(6);
  const [dungeon, setDungeon] = useState(null);

  if (!open) return null;

  const roll = () => setDungeon(generateDungeon({ rooms: roomCount }));

  const editRoom = (idx, patch) => {
    setDungeon((d) => ({
      ...d,
      rooms: d.rooms.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }));
  };

  const runIt = () => {
    if (!dungeon) return;
    const adventure = dungeonToAdventure(dungeon);
    onRun(adventure);
  };

  return (
    <section className="dungeon-gen" role="dialog" aria-label="Dungeon generator">
      <header className="dungeon-gen__header">
        <h3>DUNGEON GENERATOR</h3>
        <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">✕</button>
      </header>

      <div className="dungeon-gen__controls">
        <label>
          Rooms
          <input
            type="number"
            min="3"
            max="12"
            value={roomCount}
            onChange={(e) => setRoomCount(parseInt(e.target.value, 10) || 6)}
          />
        </label>
        <button type="button" className="iconbtn iconbtn--rules" onClick={roll}>
          ⚂ generate
        </button>
        {dungeon && (
          <button type="button" className="iconbtn iconbtn--danger" onClick={runIt}>
            ▶ run this dungeon
          </button>
        )}
      </div>

      {dungeon && (
        <div className="dungeon-gen__preview">
          <header className="dungeon-gen__meta">
            <h2 className="dungeon-gen__name">{dungeon.name}</h2>
            <p><strong>Feature:</strong> {dungeon.feature}</p>
            <p><strong>Inhabitants:</strong> {dungeon.inhabitants}</p>
            <p><strong>Imminent danger:</strong> {dungeon.danger}</p>
          </header>

          <ol className="dungeon-gen__rooms">
            {dungeon.rooms.map((r, i) => (
              <li key={i} className="dungeon-room">
                <div className="dungeon-room__title-row">
                  <input
                    className="dungeon-room__title"
                    value={r.title}
                    onChange={(e) => editRoom(i, { title: e.target.value })}
                  />
                  <span className="dungeon-room__exits">
                    {r.exits.map((t) => (
                      <span key={t} className="dungeon-room__exit">→ {dungeon.rooms[t]?.title}</span>
                    ))}
                  </span>
                </div>
                <p className="dungeon-room__atm">{r.atmosphere}</p>
                {r.enemy && (
                  <p className="dungeon-room__line">
                    <strong>Enemy:</strong> {r.enemy.name} (HP {r.enemy.hp || '?'}, Morale {r.enemy.morale || '?'})
                  </p>
                )}
                {r.trap && (
                  <p className="dungeon-room__line">
                    <strong>Trap:</strong> {r.trap.name}. {r.trap.effect}
                  </p>
                )}
                {r.item && (
                  <p className="dungeon-room__line">
                    <strong>Item:</strong> {r.item}
                  </p>
                )}
                {r.secret && (
                  <p className="dungeon-room__line dungeon-room__secret">
                    <strong>Secret:</strong> {r.secret}
                  </p>
                )}
                <textarea
                  className="dungeon-room__notes"
                  rows={2}
                  value={r.gm_notes}
                  onChange={(e) => editRoom(i, { gm_notes: e.target.value })}
                  placeholder="GM notes for this room…"
                />
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
