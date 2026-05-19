import { useState } from 'react';
import { rollDie } from '../utils/dice.js';
import CharacterGenerator from './CharacterGenerator.jsx';

const BLANK_PC = () => ({
  name: '',
  class: '',
  hp: 4,
  hpMax: 4,
  str: 0,
  agl: 0,
  pre: 0,
  tou: 0,
  omens: 1,
  silver: 0,
  conditions: '',
  notes: '',
  dead: false,
  expanded: true,
});

const BROKEN_TABLE = {
  1: 'Unconscious d4 rounds; wake at 1 HP.',
  2: 'Bleeding out — dead in 1 hour without help.',
  3: 'Lose a limb / sense (GM choice). Bleeding out, dead in d2 rounds without aid.',
  4: 'DEAD. Immediately. No save.',
};

export default function PartyTracker({ party, onUpdate, onDismiss }) {
  const [newName, setNewName] = useState('');
  const [brokenResult, setBrokenResult] = useState(null);
  const [genOpen, setGenOpen] = useState(false);

  const pushMember = (member) => {
    onUpdate((p) => ({ ...p, members: [...p.members, member] }));
  };

  const update = (idx, patch) => {
    onUpdate((p) => ({
      ...p,
      members: p.members.map((m, i) => (i === idx ? { ...m, ...patch } : m)),
    }));
  };

  const addMember = () => {
    const name = newName.trim();
    if (!name) return;
    onUpdate((p) => ({
      ...p,
      members: [...p.members, { ...BLANK_PC(), name }],
    }));
    setNewName('');
  };

  const removeMember = (idx) => {
    onUpdate((p) => ({ ...p, members: p.members.filter((_, i) => i !== idx) }));
  };

  const bumpCounter = (field, delta) => {
    onUpdate((p) => ({ ...p, [field]: Math.max(0, (p[field] ?? 0) + delta) }));
  };

  const damagePC = (idx, amount) => {
    onUpdate((p) => ({
      ...p,
      members: p.members.map((m, i) =>
        i === idx ? { ...m, hp: m.hp - amount } : m
      ),
    }));
  };

  const rollBrokenFor = (idx) => {
    const die = rollDie(4);
    const outcome = BROKEN_TABLE[die];
    setBrokenResult({ idx, die, outcome });
    if (die === 4) {
      onUpdate((p) => ({
        ...p,
        deaths: (p.deaths ?? 0) + 1,
        members: p.members.map((m, i) =>
          i === idx ? { ...m, dead: true, hp: 0 } : m
        ),
      }));
    }
  };

  const markDead = (idx, dead) => {
    onUpdate((p) => {
      const wasdead = p.members[idx].dead;
      const deathsDelta = !wasdead && dead ? 1 : wasdead && !dead ? -1 : 0;
      return {
        ...p,
        deaths: Math.max(0, (p.deaths ?? 0) + deathsDelta),
        members: p.members.map((m, i) => (i === idx ? { ...m, dead } : m)),
      };
    });
  };

  const toggleExpand = (idx) => update(idx, { expanded: !party.members[idx].expanded });

  return (
    <aside className="party-tracker">
      <header className="party-tracker__header">
        <h3>THE PARTY</h3>
        <button
          type="button"
          className="party-tracker__dismiss"
          onClick={onDismiss}
          aria-label="Hide party tracker"
        >
          ✕
        </button>
      </header>

      <div className="party-tracker__counters">
        <div className="counter">
          <span className="counter__label">Omens (shared)</span>
          <button type="button" onClick={() => bumpCounter('omens', -1)}>−</button>
          <span className="counter__value">{party.omens}</span>
          <button type="button" onClick={() => bumpCounter('omens', +1)}>+</button>
        </div>
        <div className="counter">
          <span className="counter__label">Deaths</span>
          <button type="button" onClick={() => bumpCounter('deaths', -1)}>−</button>
          <span className="counter__value">{party.deaths}</span>
          <button type="button" onClick={() => bumpCounter('deaths', +1)}>+</button>
        </div>
      </div>

      <ul className="party-list">
        {party.members.map((m, i) => (
          <li key={i} className={`pc-card ${m.dead ? 'pc-card--dead' : ''} ${m.expanded ? 'pc-card--open' : ''}`}>
            <header className="pc-card__head">
              <button
                type="button"
                className="pc-card__expand"
                onClick={() => toggleExpand(i)}
                aria-label={m.expanded ? 'Collapse' : 'Expand'}
              >
                {m.expanded ? '▾' : '▸'}
              </button>
              <input
                type="text"
                className="pc-card__name"
                value={m.name}
                onChange={(e) => update(i, { name: e.target.value })}
                placeholder="PC name"
                aria-label="PC name"
              />
              <div className="pc-card__hp">
                <button type="button" onClick={() => damagePC(i, 1)} title="-1 HP">−</button>
                <input
                  type="number"
                  value={m.hp ?? 0}
                  onChange={(e) => update(i, { hp: parseInt(e.target.value, 10) || 0 })}
                  aria-label="Current HP"
                />
                <span>/</span>
                <input
                  type="number"
                  value={m.hpMax ?? m.hp ?? 0}
                  onChange={(e) => update(i, { hpMax: parseInt(e.target.value, 10) || 0 })}
                  aria-label="Max HP"
                />
                <button type="button" onClick={() => damagePC(i, -1)} title="+1 HP">+</button>
              </div>
              <button
                type="button"
                className="pc-card__remove"
                onClick={() => removeMember(i)}
                aria-label="Remove PC"
                title="Remove"
              >
                ✕
              </button>
            </header>

            {m.expanded && (
              <div className="pc-card__body">
                <div className="pc-card__row">
                  <label>
                    Class
                    <input
                      type="text"
                      value={m.class ?? ''}
                      onChange={(e) => update(i, { class: e.target.value })}
                      placeholder="e.g. Gutterborn Scum"
                    />
                  </label>
                  <label>
                    Silver
                    <input
                      type="number"
                      value={m.silver ?? 0}
                      onChange={(e) =>
                        update(i, { silver: parseInt(e.target.value, 10) || 0 })
                      }
                    />
                  </label>
                </div>

                <div className="pc-card__abilities">
                  {[
                    ['Str', 'str'],
                    ['Agl', 'agl'],
                    ['Pre', 'pre'],
                    ['Tou', 'tou'],
                  ].map(([label, key]) => (
                    <label key={key} className="ability">
                      <span>{label}</span>
                      <input
                        type="number"
                        value={m[key] ?? 0}
                        onChange={(e) =>
                          update(i, { [key]: parseInt(e.target.value, 10) || 0 })
                        }
                      />
                    </label>
                  ))}
                  <label className="ability">
                    <span>Omens</span>
                    <input
                      type="number"
                      value={m.omens ?? 0}
                      onChange={(e) =>
                        update(i, { omens: parseInt(e.target.value, 10) || 0 })
                      }
                    />
                  </label>
                </div>

                <label className="pc-card__field">
                  Conditions
                  <input
                    type="text"
                    value={m.conditions ?? ''}
                    onChange={(e) => update(i, { conditions: e.target.value })}
                    placeholder="bleeding, infected, frightened…"
                  />
                </label>

                <label className="pc-card__field">
                  Notes
                  <textarea
                    rows={2}
                    value={m.notes ?? ''}
                    onChange={(e) => update(i, { notes: e.target.value })}
                    placeholder="gear, scrolls, etc."
                  />
                </label>

                <div className="pc-card__actions">
                  <button
                    type="button"
                    className="iconbtn iconbtn--danger"
                    onClick={() => rollBrokenFor(i)}
                    title="Roll d4 on the Broken table"
                  >
                    ☠ broken
                  </button>
                  <label className="pc-card__dead">
                    <input
                      type="checkbox"
                      checked={!!m.dead}
                      onChange={(e) => markDead(i, e.target.checked)}
                    />
                    dead
                  </label>
                </div>

                {brokenResult?.idx === i && (
                  <div className={`pc-card__broken ${brokenResult.die === 4 ? 'pc-card__broken--dead' : ''}`}>
                    <strong>d4 = {brokenResult.die}.</strong> {brokenResult.outcome}
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="party-add">
        <input
          type="text"
          placeholder="new pc name + enter"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addMember()}
        />
        <button type="button" onClick={addMember}>+ add</button>
        <button
          type="button"
          className="iconbtn"
          onClick={() => setGenOpen((o) => !o)}
          title="Generate a random PC"
        >
          ✦ generate
        </button>
      </div>

      <CharacterGenerator
        open={genOpen}
        onClose={() => setGenOpen(false)}
        onAddToParty={pushMember}
      />
    </aside>
  );
}
