import { useState } from 'react';
import { dungeonToAdventure } from '../utils/dungeonToAdventure.js';
import { generateDungeon } from '../utils/generateDungeon.js';

export default function DungeonGenerator({ open, onClose, onRun }) {
  const [roomCount, setRoomCount] = useState(9);
  const [dungeon, setDungeon] = useState(null);

  if (!open) return null;

  const roll = () => setDungeon(generateDungeon({ rooms: roomCount }));

  const editRoom = (roomId, patch) => {
    setDungeon((d) => ({
      ...d,
      rooms: d.rooms.map((r) => (r.id === roomId ? { ...r, ...patch } : r)),
    }));
  };

  const runIt = () => {
    if (!dungeon) return;
    onRun(dungeonToAdventure(dungeon));
  };

  const labelFor = (id) => dungeon?.rooms.find((r) => r.id === id)?.title || id;

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
            min="6"
            max="14"
            value={roomCount}
            onChange={(e) => setRoomCount(parseInt(e.target.value, 10) || 9)}
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
            {dungeon.rooms.map((r) => (
              <li key={r.id} className={`dungeon-room dungeon-room--${r.section}`}>
                <div className="dungeon-room__title-row">
                  <input
                    className="dungeon-room__title"
                    value={r.title}
                    onChange={(e) => editRoom(r.id, { title: e.target.value })}
                  />
                  <span className="dungeon-room__exits">
                    {r.exits.map((x, i) => (
                      <span
                        key={i}
                        className={`dungeon-room__exit ${x.locked ? 'dungeon-room__exit--locked' : ''}`}
                        title={x.condition || ''}
                      >
                        {x.locked ? '🔒 ' : ''}→ {labelFor(x.target)}
                      </span>
                    ))}
                  </span>
                </div>
                {r.atmosphere && <p className="dungeon-room__atm">{r.atmosphere}</p>}
                {r.enemies.length > 0 && (
                  <p className="dungeon-room__line">
                    <strong>Enemies:</strong>{' '}
                    {r.enemies.map((e) => `${e.name} (HP ${e.hp}, M ${e.morale})`).join('; ')}
                  </p>
                )}
                {r.npcs.length > 0 && (
                  <p className="dungeon-room__line">
                    <strong>NPCs:</strong> {r.npcs.map((n) => n.name).join(', ')}
                  </p>
                )}
                {r.traps.length > 0 && (
                  <p className="dungeon-room__line">
                    <strong>Traps:</strong>{' '}
                    {r.traps.map((t) => `${t.name}. ${t.effect}`).join(' | ')}
                  </p>
                )}
                {r.items.length > 0 && (
                  <p className="dungeon-room__line">
                    <strong>Loot:</strong> {r.items.join('; ')}
                  </p>
                )}
                {r.secrets.length > 0 && (
                  <p className="dungeon-room__line dungeon-room__secret">
                    <strong>Secret:</strong> {r.secrets.join(' ')}
                  </p>
                )}
                <textarea
                  className="dungeon-room__notes"
                  rows={2}
                  value={r.gm_notes}
                  onChange={(e) => editRoom(r.id, { gm_notes: e.target.value })}
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
