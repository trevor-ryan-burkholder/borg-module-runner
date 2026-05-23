import { useState } from 'react';
import { generateSettlement } from '../utils/generateSettlement.js';
import S from '../data/tables-settlement.json';

function labelFor(adventure, targetId) {
  return adventure.nodes.find((n) => n.id === targetId)?.title || targetId;
}

export default function SettlementGenerator({ open, onClose, onRun }) {
  const [size, setSize] = useState('');
  const [region, setRegion] = useState('');
  const [adventure, setAdventure] = useState(null);

  if (!open) return null;

  const roll = () =>
    setAdventure(
      generateSettlement({ size: size || undefined, region: region || undefined })
    );

  const patchNode = (id, patch) =>
    setAdventure((a) => ({
      ...a,
      nodes: a.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    }));

  const patchTitle = (title) =>
    setAdventure((a) => ({ ...a, meta: { ...a.meta, title } }));

  const runIt = () => {
    if (adventure) onRun(adventure);
  };

  return (
    <section className="dungeon-gen settlement-gen" role="dialog" aria-label="Settlement generator">
      <header className="dungeon-gen__header">
        <h3>SETTLEMENT GENERATOR</h3>
        <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">✕</button>
      </header>

      <div className="dungeon-gen__controls">
        <label>
          Size
          <select value={size} onChange={(e) => setSize(e.target.value)}>
            <option value="">any</option>
            {S.sizes.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </label>
        <label>
          Region
          <select value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">any</option>
            {S.regions.map((r) => (
              <option key={r.name} value={r.name}>{r.name}</option>
            ))}
          </select>
        </label>
        <button type="button" className="iconbtn iconbtn--rules" onClick={roll}>
          ⚂ generate
        </button>
        {adventure && (
          <button type="button" className="iconbtn iconbtn--danger" onClick={runIt}>
            ▶ run this settlement
          </button>
        )}
      </div>

      {adventure && (
        <div className="dungeon-gen__preview">
          <header className="dungeon-gen__meta">
            <input
              className="dungeon-gen__name"
              value={adventure.meta.title}
              onChange={(e) => patchTitle(e.target.value)}
              aria-label="Settlement name"
            />
            <p>{adventure.meta.description}</p>
            <p className="settlement-gen__hint">
              Loads as an unsaved session — use the banner’s “save to library” to keep it.
            </p>
          </header>

          <ol className="dungeon-gen__rooms">
            {adventure.nodes.map((n) => (
              <li key={n.id} className="dungeon-room">
                <div className="dungeon-room__title-row">
                  <input
                    className="dungeon-room__title"
                    value={n.title}
                    onChange={(e) => patchNode(n.id, { title: e.target.value })}
                  />
                  <span className="dungeon-room__exits">
                    {n.exits.map((x) => (
                      <span key={x.id} className="dungeon-room__exit">→ {labelFor(adventure, x.target)}</span>
                    ))}
                  </span>
                </div>
                <p className="dungeon-room__atm">{n.atmosphere}</p>
                {n.contents.npcs.length > 0 && (
                  <p className="dungeon-room__line">
                    <strong>NPCs:</strong> {n.contents.npcs.map((p) => p.name).join(', ')}
                  </p>
                )}
                {n.contents.enemies.length > 0 && (
                  <p className="dungeon-room__line">
                    <strong>Enemies:</strong>{' '}
                    {n.contents.enemies.map((p) => `${p.name} (HP ${p.hp})`).join(', ')}
                  </p>
                )}
                {n.contents.items.length > 0 && (
                  <p className="dungeon-room__line">
                    <strong>Wares / found:</strong> {n.contents.items.join('; ')}
                  </p>
                )}
                {n.contents.secrets.length > 0 && (
                  <p className="dungeon-room__line dungeon-room__secret">
                    <strong>Secret:</strong> {n.contents.secrets.join(' ')}
                  </p>
                )}
                <textarea
                  className="dungeon-room__notes"
                  rows={2}
                  value={n.gm_notes}
                  onChange={(e) => patchNode(n.id, { gm_notes: e.target.value })}
                  placeholder="GM notes for this location…"
                />
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
