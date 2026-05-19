import { useMemo, useState } from 'react';
import { rollDie, rollDice } from '../utils/dice.js';

const COMMON_CONDITIONS = [
  'broken', 'bleeding', 'on fire', 'frightened', 'prone', 'restrained', 'blinded', 'poisoned',
];

let seq = 0;
const nextId = () => `c-${Date.now()}-${++seq}`;

function rollInitiative() {
  return rollDie(6);
}

function parseMorale(value) {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  const m = String(value).match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

export default function CombatTracker({ open, onClose, combatState, setCombat, endCombat }) {
  const [moraleResult, setMoraleResult] = useState(null);
  const [conditionDraft, setConditionDraft] = useState({});

  const sorted = useMemo(() => {
    return combatState.combatants
      .map((c, i) => ({ ...c, _idx: i }))
      .sort((a, b) => b.initiative - a.initiative);
  }, [combatState.combatants]);

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

  const setHp = (id, value) => {
    const n = parseInt(value, 10);
    setCombat((cs) => ({
      ...cs,
      combatants: cs.combatants.map((c) =>
        c.id === id ? { ...c, hp: Number.isNaN(n) ? c.hp : n, dead: (Number.isNaN(n) ? c.hp : n) <= 0 ? true : c.dead } : c
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

  const reorder = (id, dir) => {
    setCombat((cs) => {
      // Reorder within the initiative-sorted view, then write back.
      const view = cs.combatants.slice().sort((a, b) => b.initiative - a.initiative);
      const idx = view.findIndex((c) => c.id === id);
      const swap = idx + dir;
      if (idx < 0 || swap < 0 || swap >= view.length) return cs;
      // Swap initiatives so the order changes deterministically.
      const a = view[idx];
      const b = view[swap];
      const aInit = a.initiative;
      const bInit = b.initiative;
      // If equal, nudge by 0.5 to disambiguate.
      const swapped = cs.combatants.map((c) => {
        if (c.id === a.id) return { ...c, initiative: dir < 0 ? Math.max(aInit, bInit) + 0.5 : Math.min(aInit, bInit) - 0.5 };
        if (c.id === b.id) return { ...c, initiative: dir < 0 ? Math.min(aInit, bInit) - 0.5 : Math.max(aInit, bInit) + 0.5 };
        return c;
      });
      return { ...cs, combatants: swapped };
    });
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

  return (
    <aside className="combat-tracker" role="dialog" aria-label="Combat tracker">
      <header className="combat-tracker__header">
        <h3>COMBAT · ROUND {combatState.round}</h3>
        <div className="combat-tracker__head-actions">
          <button type="button" className="iconbtn" onClick={nextRound}>▶ next round</button>
          <button type="button" className="iconbtn iconbtn--danger" onClick={endCombat}>end combat</button>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">✕</button>
        </div>
      </header>

      <ul className="combat-list">
        {sorted.map((c) => (
          <li
            key={c.id}
            className={`combatant combatant--${c.kind} ${c.dead ? 'combatant--dead' : ''}`}
          >
            <div className="combatant__top">
              <span className="combatant__init" title="Initiative">{c.initiative}</span>
              <span className="combatant__kind">{c.kind === 'pc' ? '☉' : '☠'}</span>
              <span className="combatant__name">{c.name}</span>
              <div className="combatant__reorder">
                <button type="button" className="iconbtn" onClick={() => reorder(c.id, -1)} title="Move up">▲</button>
                <button type="button" className="iconbtn" onClick={() => reorder(c.id, +1)} title="Move down">▼</button>
              </div>
            </div>

            <div className="combatant__row">
              <span className="combatant__label">HP</span>
              <button type="button" className="iconbtn" onClick={() => damageBy(c.id, -1)}>−</button>
              <input
                type="number"
                value={c.hp}
                onChange={(e) => setHp(c.id, e.target.value)}
                className="combatant__hp-input"
                aria-label="HP"
              />
              <span className="combatant__hpmax">/ {c.hpMax}</span>
              <button type="button" className="iconbtn" onClick={() => damageBy(c.id, +1)}>+</button>
              {c.kind === 'enemy' && c.morale != null && (
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
        ))}
      </ul>
    </aside>
  );
}

// Helper: build a fresh combat state from a node's enemies + non-dead party members.
export function buildCombatants({ enemies = [], partyMembers = [] }) {
  const combatants = [];
  partyMembers.forEach((m, idx) => {
    if (m.dead) return;
    combatants.push({
      id: nextId(),
      kind: 'pc',
      partyIndex: idx,
      memberId: m.id ?? null,
      name: m.name || `PC ${idx + 1}`,
      hp: m.hp ?? m.hpMax ?? 4,
      hpMax: m.hpMax ?? m.hp ?? 4,
      conditions: m.conditions ? m.conditions.split(',').map((s) => s.trim()).filter(Boolean) : [],
      initiative: rollInitiative(),
      dead: false,
    });
  });
  enemies.forEach((e, idx) => {
    combatants.push({
      id: nextId(),
      kind: 'enemy',
      name: e.name || `Enemy ${idx + 1}`,
      hp: typeof e.hp === 'number' ? e.hp : parseInt(String(e.hp), 10) || 1,
      hpMax: typeof e.hp === 'number' ? e.hp : parseInt(String(e.hp), 10) || 1,
      morale: e.morale ?? null,
      conditions: [],
      initiative: rollInitiative(),
      dead: false,
    });
  });
  return combatants;
}
