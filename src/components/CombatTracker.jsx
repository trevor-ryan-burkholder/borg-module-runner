import { useState } from 'react';
import { rollDice } from '../utils/dice.js';
import { rollSideInitiative, parseMorale, buildCombatants } from '../utils/combat.js';
import NumberField from './NumberField.jsx';

// Re-export so existing importers (App.jsx) keep a stable surface.
export { rollSideInitiative, buildCombatants };

const COMMON_CONDITIONS = [
  'broken', 'bleeding', 'on fire', 'frightened', 'prone', 'restrained', 'blinded', 'poisoned',
];

export default function CombatTracker({ open, onClose, combatState, setCombat, endCombat }) {
  const [moraleResult, setMoraleResult] = useState(null);
  const [conditionDraft, setConditionDraft] = useState({});
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addHp, setAddHp] = useState(6);
  const [addMorale, setAddMorale] = useState('7');
  const [addSide, setAddSide] = useState('enemy');

  if (!open) return null;
  if (!combatState.active) {
    return (
      <aside className="combat-tracker" role="dialog" aria-label="Combat tracker">
        <header className="combat-tracker__header">
          <h3>COMBAT</h3>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <p className="combat-tracker__empty">
          No combat in progress. Open a node with enemies and press <strong>⚔ start combat</strong>.
        </p>
      </aside>
    );
  }

  const initiative = combatState.initiative ?? { party: null, enemies: null };
  const first =
    initiative.party == null || initiative.enemies == null
      ? null
      : initiative.party >= initiative.enemies
        ? 'party'
        : 'enemies';

  const damageBy = (id, delta) => {
    setCombat((cs) => ({
      ...cs,
      combatants: cs.combatants.map((c) =>
        c.id === id
          ? {
              ...c,
              hp: c.hp + delta,
              dead: c.hp + delta <= 0 ? true : c.dead,
            }
          : c
      ),
    }));
  };

  const setHp = (id, n) => {
    setCombat((cs) => ({
      ...cs,
      combatants: cs.combatants.map((c) =>
        c.id === id ? { ...c, hp: n, dead: n <= 0 ? true : c.dead } : c
      ),
    }));
  };

  const toggleDead = (id) => {
    setCombat((cs) => ({
      ...cs,
      combatants: cs.combatants.map((c) => (c.id === id ? { ...c, dead: !c.dead } : c)),
    }));
  };

  const addCondition = (id, cond) => {
    const trimmed = cond.trim();
    if (!trimmed) return;
    setCombat((cs) => ({
      ...cs,
      combatants: cs.combatants.map((c) =>
        c.id === id && !c.conditions.includes(trimmed)
          ? { ...c, conditions: [...c.conditions, trimmed] }
          : c
      ),
    }));
  };

  const removeCondition = (id, cond) => {
    setCombat((cs) => ({
      ...cs,
      combatants: cs.combatants.map((c) =>
        c.id === id ? { ...c, conditions: c.conditions.filter((x) => x !== cond) } : c
      ),
    }));
  };

  const rollMorale = (c) => {
    const target = parseMorale(c.morale);
    if (target == null) {
      setMoraleResult({ id: c.id, text: 'No morale score on this combatant.' });
      return;
    }
    const dice = rollDice(2, 6);
    const sum = dice[0] + dice[1];
    const broken = sum > target;
    setMoraleResult({
      id: c.id,
      text: broken
        ? `2d6 = ${sum} (>${target}) — BROKEN. Flees or surrenders.`
        : `2d6 = ${sum} (≤${target}) — holds firm.`,
    });
  };

  const nextRound = () => setCombat((cs) => ({ ...cs, round: cs.round + 1 }));

  const commitAdd = () => {
    const name = addName.trim() || (addSide === 'pc' ? 'Unnamed PC' : 'Reinforcement');
    setCombat((cs) => ({
      ...cs,
      combatants: [
        ...cs.combatants,
        {
          id: `c-add-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          kind: addSide,
          name,
          hp: addHp,
          hpMax: addHp,
          morale: addSide === 'enemy' ? addMorale : null,
          conditions: [],
          dead: false,
        },
      ],
    }));
    setAddName('');
    setAddHp(6);
    setAddMorale('7');
    setAddOpen(false);
  };

  const rerollInitiative = () =>
    setCombat((cs) => ({ ...cs, initiative: rollSideInitiative() }));

  const renderCombatant = (c) => {
    const moraleScore = parseMorale(c.morale);
    return (
      <li
        key={c.id}
        className={`combatant combatant--${c.kind} ${c.dead ? 'combatant--dead' : ''}`}
      >
        <div className="combatant__top">
          <span className="combatant__kind">{c.kind === 'pc' ? '☉' : '☠'}</span>
          <span className="combatant__name">{c.name}</span>
        </div>

        <div className="combatant__row">
          <span className="combatant__label">HP</span>
          <button type="button" className="iconbtn" onClick={() => damageBy(c.id, -1)}>−</button>
          <NumberField
            value={c.hp}
            onChange={(n) => setHp(c.id, n)}
            className="combatant__hp-input"
            aria-label="HP"
          />
          <span className="combatant__hpmax">/ {c.hpMax}</span>
          <button type="button" className="iconbtn" onClick={() => damageBy(c.id, +1)}>+</button>
          {c.kind === 'enemy' && moraleScore != null && (
            <button type="button" className="iconbtn" onClick={() => rollMorale(c)}>
              morale ({c.morale})
            </button>
          )}
          <label className="combatant__dead">
            <input type="checkbox" checked={!!c.dead} onChange={() => toggleDead(c.id)} />
            dead
          </label>
        </div>

        {moraleResult?.id === c.id && (
          <p className="combatant__morale-result">{moraleResult.text}</p>
        )}

        <div className="combatant__conditions">
          {c.conditions.map((cond) => (
            <button
              key={cond}
              type="button"
              className="condition-chip"
              onClick={() => removeCondition(c.id, cond)}
              title="Click to remove"
            >
              {cond} ✕
            </button>
          ))}
          <select
            className="condition-add"
            value={conditionDraft[c.id] ?? ''}
            onChange={(e) => {
              if (e.target.value === '__custom__') {
                const custom = window.prompt('Condition:');
                if (custom) addCondition(c.id, custom);
              } else if (e.target.value) {
                addCondition(c.id, e.target.value);
              }
              setConditionDraft((d) => ({ ...d, [c.id]: '' }));
            }}
          >
            <option value="">+ condition</option>
            {COMMON_CONDITIONS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
            <option value="__custom__">other…</option>
          </select>
        </div>
      </li>
    );
  };

  const sides = [
    { key: 'party', label: 'THE PARTY', glyph: '☉', members: combatState.combatants.filter((c) => c.kind === 'pc') },
    { key: 'enemies', label: 'ENEMIES', glyph: '☠', members: combatState.combatants.filter((c) => c.kind === 'enemy') },
  ];
  // The side that won initiative is shown on top.
  if (first === 'enemies') sides.reverse();

  return (
    <aside className="combat-tracker" role="dialog" aria-label="Combat tracker">
      <header className="combat-tracker__header">
        <h3>COMBAT · ROUND {combatState.round}</h3>
        <div className="combat-tracker__head-actions">
          <button type="button" className="iconbtn" onClick={() => setAddOpen((o) => !o)}>+ add</button>
          <button type="button" className="iconbtn" onClick={nextRound}>▶ next round</button>
          <button type="button" className="iconbtn iconbtn--danger" onClick={endCombat}>end combat</button>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">✕</button>
        </div>
      </header>

      {addOpen && (
        <div className="combat-add">
          <label>
            side
            <select value={addSide} onChange={(e) => setAddSide(e.target.value)}>
              <option value="enemy">enemy</option>
              <option value="pc">PC</option>
            </select>
          </label>
          <label>
            name
            <input
              type="text"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder={addSide === 'enemy' ? 'Reinforcement' : 'PC name'}
              onKeyDown={(e) => e.key === 'Enter' && commitAdd()}
              autoFocus
            />
          </label>
          <label>
            HP
            <NumberField value={addHp} onChange={setAddHp} aria-label="HP" />
          </label>
          {addSide === 'enemy' && (
            <label>
              morale
              <input
                type="text"
                value={addMorale}
                onChange={(e) => setAddMorale(e.target.value)}
                placeholder="7 or —"
                style={{ width: '3rem' }}
              />
            </label>
          )}
          <button type="button" className="iconbtn iconbtn--rules" onClick={commitAdd}>add</button>
          <button type="button" className="iconbtn" onClick={() => setAddOpen(false)}>cancel</button>
        </div>
      )}

      <div className="combat-init">
        <div className="combat-init__verdict">
          {first === 'party' && '☉ THE PARTY ACTS FIRST'}
          {first === 'enemies' && '☠ THE ENEMIES ACT FIRST'}
          {!first && 'Roll initiative to begin'}
        </div>
        {first && (
          <div className="combat-init__rolls">
            party d6 = <strong>{initiative.party}</strong> · enemies d6 = <strong>{initiative.enemies}</strong>
          </div>
        )}
        <button type="button" className="iconbtn" onClick={rerollInitiative} title="Each side rolls d6, higher acts first">
          ↻ roll initiative
        </button>
      </div>

      {sides.map((side) => (
        <section
          key={side.key}
          className={`combat-side combat-side--${side.key} ${first === side.key ? 'combat-side--first' : ''}`}
        >
          <h4 className="combat-side__head">
            <span>{side.glyph} {side.label}</span>
            {first === side.key && <span className="combat-side__badge">acts first</span>}
          </h4>
          <ul className="combat-list">
            {side.members.length === 0 ? (
              <li className="combat-side__empty">— none —</li>
            ) : (
              side.members.map(renderCombatant)
            )}
          </ul>
        </section>
      ))}
    </aside>
  );
}
