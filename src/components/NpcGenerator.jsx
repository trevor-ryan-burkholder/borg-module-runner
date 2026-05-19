import { useEffect, useState } from 'react';
import { rollValue } from '../utils/tables.js';
import names from '../data/tables-names.json';
import traits from '../data/tables-traits.json';
import reaction from '../data/tables-reaction.json';
import npcTables from '../data/tables-npc.json';

const STORAGE_KEY = 'mb-npc-last';

const FIELDS = [
  { key: 'name',       label: 'Name',       table: () => names.entries },
  { key: 'occupation', label: 'Occupation', table: () => npcTables.occupations },
  { key: 'faction',    label: 'Faction',    table: () => npcTables.factions },
  { key: 'trait',      label: 'Trait',      table: () => traits.traits },
  { key: 'body',       label: 'Body',       table: () => traits.bodies },
  { key: 'habit',      label: 'Habit',      table: () => traits.habits },
  { key: 'reaction',   label: 'Reaction',   table: () => reaction.reaction },
  { key: 'secret',     label: 'Secret',     table: () => npcTables.secrets },
];

function blankNpc() {
  return FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {});
}

function loadLast() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function saveLast(npc) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(npc));
  } catch {
    /* quota or privacy mode — silent */
  }
}

function formatForNotes(npc) {
  const lines = [
    `NPC — ${npc.name || '(unnamed)'}`,
    `  ${npc.occupation}. ${npc.faction}.`,
    `  Trait: ${npc.trait}`,
    `  Body: ${npc.body}`,
    `  Habit: ${npc.habit}`,
    `  Reaction: ${npc.reaction}`,
    `  Secret: ${npc.secret}`,
  ];
  return lines.join('\n');
}

export default function NpcGenerator({ open, onClose, canAddToNotes, onAddToNotes }) {
  const [npc, setNpc] = useState(() => loadLast() ?? blankNpc());
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    saveLast(npc);
  }, [npc]);

  const rollField = (key) => {
    const field = FIELDS.find((f) => f.key === key);
    if (!field) return;
    setNpc((n) => ({ ...n, [key]: rollValue(field.table()) }));
  };

  const rollAll = () => {
    const next = {};
    for (const f of FIELDS) next[f.key] = rollValue(f.table());
    setNpc(next);
  };

  const handleAdd = () => {
    if (!canAddToNotes || !onAddToNotes) return;
    onAddToNotes(formatForNotes(npc));
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1800);
  };

  if (!open) return null;

  const isBlank = FIELDS.every((f) => !npc[f.key]);

  return (
    <aside className="npc-generator" role="dialog" aria-label="NPC generator">
      <header className="npc-generator__header">
        <h3>NPC</h3>
        <div className="npc-generator__header-actions">
          <button
            type="button"
            className="iconbtn iconbtn--rules"
            onClick={rollAll}
            title="Roll every field"
          >
            ⚂ roll all
          </button>
          <button
            type="button"
            className="iconbtn"
            onClick={onClose}
            aria-label="Close NPC generator"
          >
            ✕
          </button>
        </div>
      </header>

      {isBlank && (
        <p className="npc-generator__hint">
          The void waits. Press <strong>roll all</strong> to summon someone unfortunate.
        </p>
      )}

      <ul className="npc-generator__fields">
        {FIELDS.map((f) => (
          <li key={f.key} className="npc-field">
            <span className="npc-field__label">{f.label}</span>
            <span className="npc-field__value">{npc[f.key] || '—'}</span>
            <button
              type="button"
              className="iconbtn npc-field__reroll"
              onClick={() => rollField(f.key)}
              title={`Reroll ${f.label.toLowerCase()}`}
              aria-label={`Reroll ${f.label}`}
            >
              ⟲
            </button>
          </li>
        ))}
      </ul>

      <footer className="npc-generator__foot">
        <button
          type="button"
          className="iconbtn"
          onClick={handleAdd}
          disabled={!canAddToNotes || isBlank}
          title={
            canAddToNotes
              ? 'Append to the current node’s session notes'
              : 'Load a node before adding to notes'
          }
        >
          {justAdded ? '✓ added' : '+ add to gm notes'}
        </button>
      </footer>
    </aside>
  );
}
