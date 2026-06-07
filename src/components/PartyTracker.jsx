import { useState } from 'react';
import { rollDie } from '../utils/dice.js';
import { uid } from '../utils/id.js';
import CharacterGenerator from './CharacterGenerator.jsx';
import NumberField from './NumberField.jsx';

const BLANK_PC = () => ({
  id: uid('pc'),
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

// Canonical Broken (0 HP) table — MÖRK BORG Bare Bones Edition / Rules Reference.
const BROKEN_TABLE = {
  1: 'Fall unconscious for d4 rounds, then awaken with d4 HP.',
  2: 'd6: 1–5 broken or severed limb, 6 lost eye. Cannot act for d4 rounds, then active with d4 HP.',
  3: 'Haemorrhage: death in d2 hours unless treated. All tests DR16 the first hour, DR18 the last.',
  4: 'DEAD.',
};

export default function PartyTracker({ party, onUpdate, onDismiss, onBury }) {
  const [newName, setNewName] = useState('');
  // Map of memberId → { die, outcome } so two PCs being broken in sequence
  // both retain their roll context for the bury / display path. A single-slot
  // store let the second roll silently erase the first.
  const [brokenResultsById, setBrokenResultsById] = useState({});
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
    onUpdate((p) => {
      const m = p.members[idx];
      if (!m) return p;
      const nextHpRaw = m.hp - amount;
      const nextHp = Math.max(0, nextHpRaw);
      // Crossing semantics: flip dead only when HP actually crosses zero in
      // either direction. A narratively-dead PC at HP 5 staying dead through
      // a 1-damage hit is the expected behaviour.
      let dead = m.dead;
      if (m.hp > 0 && nextHp <= 0) dead = true;
      if (m.hp <= 0 && nextHp > 0) dead = false;
      const newlyDead = !m.dead && dead;
      return {
        ...p,
        deaths: (p.deaths ?? 0) + (newlyDead ? 1 : 0),
        members: p.members.map((mm, i) =>
          i === idx ? { ...mm, hp: nextHp, dead } : mm
        ),
      };
    });
  };

  // Direct HP edit (typed into the NumberField) — go through the same
  // crossing-aware path so manual-dead PCs at HP 5 typed to HP 4 don't get
  // silently revived, and a typed 0 still bumps deaths via the transition.
  const setHp = (idx, n) => {
    onUpdate((p) => {
      const m = p.members[idx];
      if (!m) return p;
      const nextHp = Math.max(0, n);
      let dead = m.dead;
      if (m.hp > 0 && nextHp <= 0) dead = true;
      if (m.hp <= 0 && nextHp > 0) dead = false;
      const newlyDead = !m.dead && dead;
      return {
        ...p,
        deaths: (p.deaths ?? 0) + (newlyDead ? 1 : 0),
        members: p.members.map((mm, i) =>
          i === idx ? { ...mm, hp: nextHp, dead } : mm
        ),
      };
    });
  };

  const rollBrokenFor = (idx) => {
    const die = rollDie(4);
    const outcome = BROKEN_TABLE[die];
    const memberId = party.members[idx]?.id;
    if (memberId) {
      setBrokenResultsById((m) => ({ ...m, [memberId]: { die, outcome } }));
    }
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
          className="iconbtn"
          onClick={() => {
            if (!window.confirm("Long rest: restore every PC's HP to max and reset omens to 3?")) return;
            onUpdate((p) => ({
              ...p,
              omens: 3,
              members: p.members.map((m) =>
                m.dead ? m : { ...m, hp: m.hpMax ?? m.hp ?? 4, omens: 1 }
              ),
            }));
          }}
          title="Long rest — restore HP and omens"
        >
          ☾ rest
        </button>
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
          <li key={m.id || i} className={`pc-card ${m.dead ? 'pc-card--dead' : ''} ${m.expanded ? 'pc-card--open' : ''}`}>
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
                <NumberField
                  value={m.hp ?? 0}
                  onChange={(n) => setHp(i, n)}
                  aria-label="Current HP"
                />
                <span>/</span>
                <NumberField
                  value={m.hpMax ?? m.hp ?? 0}
                  onChange={(n) => update(i, { hpMax: n })}
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
                    <NumberField
                      value={m.silver ?? 0}
                      onChange={(n) => update(i, { silver: n })}
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
                      <NumberField
                        value={m[key] ?? 0}
                        onChange={(n) => update(i, { [key]: n })}
                      />
                    </label>
                  ))}
                  <label className="ability">
                    <span>Omens</span>
                    <NumberField
                      value={m.omens ?? 0}
                      onChange={(n) => update(i, { omens: n })}
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

                <div className="pc-card__inventory">
                  <div className="pc-card__inv-head">
                    <span className="counter__label">Inventory</span>
                    <span className="pc-card__inv-slots">
                      {(m.inventory?.length ?? 0)} / {2 + Math.max(0, m.str ?? 0)} slots
                    </span>
                  </div>
                  <ul className="pc-card__inv-list">
                    {(m.inventory ?? []).map((item, j) => (
                      <li key={j} className="pc-card__inv-row">
                        <input
                          type="text"
                          value={item}
                          onChange={(e) =>
                            update(i, {
                              inventory: (m.inventory ?? []).map((x, k) => (k === j ? e.target.value : x)),
                            })
                          }
                        />
                        <button
                          type="button"
                          className="iconbtn iconbtn--danger"
                          onClick={() =>
                            update(i, { inventory: (m.inventory ?? []).filter((_, k) => k !== j) })
                          }
                          aria-label="Drop item"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="iconbtn"
                    onClick={() => update(i, { inventory: [...(m.inventory ?? []), ''] })}
                  >
                    + item
                  </button>
                </div>

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
                  {m.dead && onBury && (
                    <button
                      type="button"
                      className="iconbtn iconbtn--danger"
                      onClick={() => {
                        if (window.confirm(`Send ${m.name || 'this PC'} to the Graveyard? They leave the party list.`)) {
                          const br = brokenResultsById[m.id];
                          onBury(m.id, br ? {
                            brokenDie: br.die,
                            brokenOutcome: br.outcome,
                          } : {});
                        }
                      }}
                      title="Move to the Graveyard panel"
                    >
                      ⚰ bury
                    </button>
                  )}
                  <label className="pc-card__dead">
                    <input
                      type="checkbox"
                      checked={!!m.dead}
                      onChange={(e) => markDead(i, e.target.checked)}
                    />
                    dead
                  </label>
                </div>

                {brokenResultsById[m.id] && (
                  <div className={`pc-card__broken ${brokenResultsById[m.id].die === 4 ? 'pc-card__broken--dead' : ''}`}>
                    <strong>d4 = {brokenResultsById[m.id].die}.</strong> {brokenResultsById[m.id].outcome}
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
