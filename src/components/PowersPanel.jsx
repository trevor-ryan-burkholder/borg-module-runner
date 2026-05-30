import { useMemo, useState } from 'react';
import gm from '../data/tables-gm.json';
import { rollDie } from '../utils/dice.js';

// Reference panel for Mörk Borg's canonical Sacred Scrolls, Unclean Scrolls,
// and Arcane Catastrophes — fully browsable, searchable, and rollable. Wraps
// the d20/d100 tables already in tables-gm.json.

const SOURCES = [
  { key: 'sacred',   label: 'Sacred Scrolls',     table: gm.sacred_scrolls },
  { key: 'unclean',  label: 'Unclean Scrolls',    table: gm.unclean_scrolls },
  { key: 'catast',   label: 'Arcane Catastrophes', table: gm.arcane_catastrophes },
];

export default function PowersPanel({ open, onClose, canAddToNotes, onAddToNotes }) {
  const [active, setActive] = useState('sacred');
  const [query, setQuery] = useState('');
  const [rolled, setRolled] = useState(null);

  const source = useMemo(() => SOURCES.find((s) => s.key === active), [active]);

  const filtered = useMemo(() => {
    const entries = source?.table?.entries ?? [];
    if (!query.trim()) return entries.map((text, i) => ({ idx: i, text }));
    const q = query.toLowerCase();
    return entries
      .map((text, i) => ({ idx: i, text }))
      .filter(({ text }) => text.toLowerCase().includes(q));
  }, [source, query]);

  if (!open) return null;

  const rollRandom = () => {
    const entries = source?.table?.entries ?? [];
    if (entries.length === 0) return;
    const die = rollDie(entries.length);
    setRolled({ key: source.key, idx: die - 1, text: entries[die - 1], die });
  };

  const addToNotes = (entry) => {
    if (!canAddToNotes || !onAddToNotes) return;
    onAddToNotes(`${source.label} #${entry.idx + 1}: ${entry.text}`);
  };

  return (
    <aside className="powers-panel" role="dialog" aria-label="Powers and catastrophes">
      <header className="powers-panel__header">
        <h3>POWERS & CATASTROPHES</h3>
        <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">✕</button>
      </header>

      <div className="powers-panel__tabs" role="tablist">
        {SOURCES.map((s) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={active === s.key}
            className={`tab ${active === s.key ? 'tab--active' : ''}`}
            onClick={() => { setActive(s.key); setRolled(null); }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="powers-panel__controls">
        <input
          type="search"
          placeholder="search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="button" className="iconbtn iconbtn--rules" onClick={rollRandom}>
          ⚂ roll {source?.table?.die}
        </button>
        <span className="powers-panel__count">{filtered.length} / {source?.table?.entries?.length ?? 0}</span>
      </div>

      {rolled && rolled.key === active && (
        <div className="powers-panel__rolled">
          <span className="powers-panel__roll-die">{source?.table?.die} = {rolled.die}</span>
          <span className="powers-panel__roll-text">{rolled.text}</span>
          {canAddToNotes && onAddToNotes && (
            <button
              type="button"
              className="iconbtn"
              onClick={() => addToNotes({ idx: rolled.idx, text: rolled.text })}
            >
              + notes
            </button>
          )}
        </div>
      )}

      <ol className="powers-panel__list">
        {filtered.map((entry) => (
          <li key={entry.idx} className="power">
            <span className="power__idx">{entry.idx + 1}</span>
            <span className="power__text">{entry.text}</span>
            {canAddToNotes && onAddToNotes && (
              <button
                type="button"
                className="iconbtn power__notes"
                onClick={() => addToNotes(entry)}
                title="Append to current node's GM notes"
              >
                + notes
              </button>
            )}
          </li>
        ))}
      </ol>
    </aside>
  );
}
