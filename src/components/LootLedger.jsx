import { useState } from 'react';
import NumberField from './NumberField.jsx';

// Party-shared treasure ledger: items + silver pool, with "carried by" tags so
// the GM can note who is holding what at any moment.
export default function LootLedger({ open, onClose, loot, onUpdate, party }) {
  const [newItem, setNewItem] = useState('');
  const [newCarrier, setNewCarrier] = useState('');

  if (!open) return null;

  const items = loot?.items ?? [];
  const silver = loot?.silver ?? 0;
  const members = party?.members ?? [];

  const addItem = () => {
    const name = newItem.trim();
    if (!name) return;
    onUpdate((l) => ({
      ...l,
      items: [
        ...(l.items ?? []),
        { id: `loot-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, name, carrier: newCarrier || '' },
      ],
    }));
    setNewItem('');
  };

  const removeItem = (id) =>
    onUpdate((l) => ({ ...l, items: (l.items ?? []).filter((it) => it.id !== id) }));

  const setCarrier = (id, carrier) =>
    onUpdate((l) => ({
      ...l,
      items: (l.items ?? []).map((it) => (it.id === id ? { ...it, carrier } : it)),
    }));

  const bumpSilver = (delta) =>
    onUpdate((l) => ({ ...l, silver: Math.max(0, (l.silver ?? 0) + delta) }));

  const setSilver = (n) => onUpdate((l) => ({ ...l, silver: Math.max(0, n) }));

  return (
    <aside className="loot-ledger" role="dialog" aria-label="Loot ledger">
      <header className="loot-ledger__header">
        <h3>THE LEDGER</h3>
        <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">✕</button>
      </header>

      <div className="loot-ledger__silver">
        <span className="loot-ledger__label">Group silver</span>
        <button type="button" onClick={() => bumpSilver(-1)}>−</button>
        <NumberField value={silver} onChange={setSilver} aria-label="Group silver" />
        <button type="button" onClick={() => bumpSilver(+1)}>+</button>
      </div>

      <ul className="loot-ledger__items">
        {items.length === 0 && <li className="empty">No treasure yet. The world owes you, briefly.</li>}
        {items.map((it) => (
          <li key={it.id} className="loot-row">
            <span className="loot-row__name">{it.name}</span>
            <label className="loot-row__carrier">
              carried by
              <select value={it.carrier} onChange={(e) => setCarrier(it.id, e.target.value)}>
                <option value="">— group —</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name || '(unnamed)'}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="iconbtn iconbtn--danger"
              onClick={() => removeItem(it.id)}
              aria-label="Drop item"
              title="Drop / spend"
            >✕</button>
          </li>
        ))}
      </ul>

      <div className="loot-add">
        <input
          type="text"
          placeholder="found item / curio / coin pouch"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
        />
        <select value={newCarrier} onChange={(e) => setNewCarrier(e.target.value)}>
          <option value="">— group —</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.name || '(unnamed)'}</option>
          ))}
        </select>
        <button type="button" className="iconbtn" onClick={addItem}>+ add</button>
      </div>
    </aside>
  );
}
