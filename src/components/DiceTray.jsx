import { useState } from 'react';
import { DIE_SIDES, rollDice, rollTest, rollDamage } from '../utils/dice.js';

const MAX_HISTORY = 12;

export default function DiceTray({ open, onClose }) {
  const [history, setHistory] = useState([]);
  const [mode, setMode] = useState('test'); // test | damage | dice
  const [modifier, setModifier] = useState(0);
  const [dr, setDr] = useState(12);
  const [damCount, setDamCount] = useState(1);
  const [damSides, setDamSides] = useState(6);
  const [label, setLabel] = useState('');

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
      id: Date.now(),
      at: Date.now(),
    });
  };

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
