import { useEffect, useState } from 'react';
import { DIE_SIDES, rollDice, rollTest, rollDamage } from '../utils/dice.js';

const MAX_HISTORY = 12;
const PRESETS_KEY = 'mb-dice-presets';
const MAX_PRESETS = 4;

function loadPresets() {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_PRESETS) : [];
  } catch {
    return [];
  }
}

function savePresets(list) {
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(list.slice(0, MAX_PRESETS)));
  } catch {
    /* quota or privacy mode */
  }
}

function rollText(r) {
  if (r.label) return `${r.label}: ${r.text}`;
  return r.text;
}

export default function DiceTray({ open, onClose, canAddToNotes, onAddToNotes }) {
  const [history, setHistory] = useState([]);
  const [mode, setMode] = useState('test'); // test | damage | dice
  const [modifier, setModifier] = useState(0);
  const [dr, setDr] = useState(12);
  const [damCount, setDamCount] = useState(1);
  const [damSides, setDamSides] = useState(6);
  const [label, setLabel] = useState('');
  const [presets, setPresets] = useState(() => loadPresets());

  useEffect(() => {
    savePresets(presets);
  }, [presets]);

  const push = (entry) =>
    setHistory((h) => [entry, ...h].slice(0, MAX_HISTORY));

  const doTest = () => push(rollTest({ modifier: +modifier, dr: +dr, label }));
  const doDamage = () =>
    push(rollDamage({ count: +damCount, sides: +damSides, modifier: +modifier, label }));
  const doSingle = (sides) => {
    const rolls = rollDice(1, sides);
    push({
      kind: 'die',
      label,
      sides,
      rolls,
      total: rolls[0],
      text: `d${sides} → ${rolls[0]}`,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      at: Date.now(),
    });
  };

  const savePreset = () => {
    const name =
      window.prompt(
        'Name this preset (e.g. "Anund longbow"):',
        label || `${mode} preset`
      )?.trim();
    if (!name) return;
    const snapshot = {
      id: `p-${Date.now()}`,
      name,
      mode,
      modifier: +modifier,
      dr: +dr,
      damCount: +damCount,
      damSides: +damSides,
      label,
    };
    setPresets((ps) => [snapshot, ...ps.filter((p) => p.name !== name)].slice(0, MAX_PRESETS));
  };

  const applyPreset = (p) => {
    setMode(p.mode);
    setModifier(p.modifier);
    setDr(p.dr);
    setDamCount(p.damCount);
    setDamSides(p.damSides);
    setLabel(p.label || '');
  };

  const removePreset = (id) => setPresets((ps) => ps.filter((p) => p.id !== id));

  if (!open) return null;

  return (
    <aside className="dice-tray" role="dialog" aria-label="Dice tray">
      <header className="dice-tray__header">
        <h3>DICE</h3>
        <button type="button" className="iconbtn" onClick={onClose} aria-label="Close dice">
          ✕
        </button>
      </header>

      <div className="dice-tray__modes" role="tablist">
        {['test', 'damage', 'dice'].map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            className={`tab ${mode === m ? 'tab--active' : ''}`}
            onClick={() => setMode(m)}
            aria-selected={mode === m}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="dice-tray__panel">
        <label className="dice-tray__label">
          purpose (optional)
          <input
            type="text"
            placeholder="e.g. agility test to dodge"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </label>

        {mode === 'test' && (
          <div className="dice-tray__row">
            <label>
              modifier
              <input
                type="number"
                value={modifier}
                onChange={(e) => setModifier(e.target.value)}
              />
            </label>
            <label>
              DR
              <input
                type="number"
                min={4}
                max={24}
                value={dr}
                onChange={(e) => setDr(e.target.value)}
              />
            </label>
            <button type="button" className="iconbtn iconbtn--rules" onClick={doTest}>
              roll d20
            </button>
          </div>
        )}

        {mode === 'damage' && (
          <div className="dice-tray__row">
            <label>
              count
              <input
                type="number"
                min={1}
                max={20}
                value={damCount}
                onChange={(e) => setDamCount(e.target.value)}
              />
            </label>
            <label>
              sides (dN)
              <select value={damSides} onChange={(e) => setDamSides(+e.target.value)}>
                {DIE_SIDES.map((s) => (
                  <option key={s} value={s}>d{s}</option>
                ))}
              </select>
            </label>
            <label>
              modifier
              <input
                type="number"
                value={modifier}
                onChange={(e) => setModifier(e.target.value)}
              />
            </label>
            <button type="button" className="iconbtn iconbtn--rules" onClick={doDamage}>
              roll damage
            </button>
          </div>
        )}

        {mode === 'dice' && (
          <div className="dice-tray__quick">
            {DIE_SIDES.map((s) => (
              <button
                key={s}
                type="button"
                className="iconbtn dice-tray__quick-btn"
                onClick={() => doSingle(s)}
              >
                d{s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Presets — saved roll templates persisted to localStorage. */}
      <div className="dice-tray__presets">
        <button
          type="button"
          className="iconbtn"
          onClick={savePreset}
          title="Save current mode + modifiers as a preset"
        >
          ⭑ save preset
        </button>
        {presets.length === 0 && (
          <span className="dice-tray__presets-hint">no presets yet</span>
        )}
        {presets.map((p) => (
          <span key={p.id} className="dice-tray__preset">
            <button
              type="button"
              className="iconbtn"
              onClick={() => applyPreset(p)}
              title={`${p.mode} · mod ${p.modifier} · DR ${p.dr}`}
            >
              {p.name}
            </button>
            <button
              type="button"
              className="iconbtn iconbtn--danger"
              onClick={() => removePreset(p.id)}
              aria-label={`Remove preset ${p.name}`}
              title="Remove"
            >
              ✕
            </button>
          </span>
        ))}
      </div>

      <ol className="dice-tray__history" aria-label="roll history">
        {history.length === 0 && (
          <li className="empty">no rolls yet — the dice are waiting.</li>
        )}
        {history.map((r) => (
          <li
            key={r.id}
            className={
              r.kind === 'test'
                ? `roll roll--test ${r.crit ? 'roll--crit' : ''} ${r.fumble ? 'roll--fumble' : ''} ${r.success ? 'roll--success' : 'roll--fail'}`
                : `roll roll--${r.kind}`
            }
          >
            {r.label && <span className="roll__label">{r.label}</span>}
            <span className="roll__text">{r.text}</span>
            {canAddToNotes && onAddToNotes && (
              <button
                type="button"
                className="iconbtn dice-tray__roll-notes"
                onClick={() => onAddToNotes(rollText(r))}
                title="Append this roll to the current node's GM notes"
                aria-label="Append to GM notes"
              >
                + notes
              </button>
            )}
          </li>
        ))}
      </ol>

      {history.length > 0 && (
        <footer className="dice-tray__foot">
          <button
            type="button"
            className="iconbtn"
            onClick={() => setHistory([])}
          >
            clear history
          </button>
        </footer>
      )}
    </aside>
  );
}
