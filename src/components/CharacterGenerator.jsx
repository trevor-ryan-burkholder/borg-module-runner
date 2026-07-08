import { useState } from 'react';
import { rollDie, rollExpr } from '../utils/dice.js';
import { rollValue } from '../utils/tables.js';
import { uid } from '../utils/id.js';
import classesData from '../data/classes.json';
import equipment from '../data/starting-equipment.json';
import names from '../data/tables-names.json';
import traits from '../data/tables-traits.json';

const STATS = ['str', 'agl', 'pre', 'tou'];
const STAT_LABELS = { str: 'Str', agl: 'Agl', pre: 'Pre', tou: 'Tou' };

function modOf(score) {
  // Mörk Borg ability scores convert to a modifier: 4→-3, 6→-2, 8→-1, 12→0, 14→+1, 16→+2, 18→+3 (loose canonical mapping).
  if (score <= 4) return -3;
  if (score <= 6) return -2;
  if (score <= 8) return -1;
  if (score <= 12) return 0;
  if (score <= 14) return 1;
  if (score <= 16) return 2;
  return 3;
}

function pickWeapon(cls) {
  // Some classes (e.g. Fanged Deserter) have a fixed starting weapon instead of a table roll.
  if (cls.weapon_fixed) return cls.weapon_fixed;
  const max = Math.min(cls.weapon_die, equipment.weapons.length);
  const idx = rollDie(max) - 1;
  return equipment.weapons[idx];
}

function pickArmor(cls) {
  // Some classes (e.g. Heretical Priest) have a fixed starting armor instead of a table roll.
  if (cls.armor_fixed && cls.armor_die == null) return cls.armor_fixed;
  const max = Math.min(cls.armor_die, equipment.armor.length);
  let idx = rollDie(max) - 1;
  // Some classes (e.g. Wretched Royalty) reroll if heavy armor (tier 3, index 3) is received.
  if (cls.armor_reroll_heavy && equipment.armor[idx]?.tier === 3) {
    idx = rollDie(max - 1) - 1; // reroll excluding last entry
  }
  return equipment.armor[idx];
}

function rollCharacter(cls) {
  const stats = {};
  for (const s of STATS) {
    const score = rollExpr(cls.stat_formulas?.[s] ?? '3d6');
    stats[s] = { score, mod: modOf(score) };
  }
  const tou = stats.tou.score;
  const hpMax = Math.max(1, modOf(tou) + rollDie(cls.hp_die));
  const silver = rollExpr(`${cls.silver_count}d6`) * cls.silver_mult;
  const omens = rollDie(cls.omens_die);
  const name = rollValue(names.entries);
  const trait = rollValue(traits.traits);
  const weapon = pickWeapon(cls);
  const armor = pickArmor(cls);
  const specialty = rollValue(cls.specialties);
  return {
    classId: cls.id,
    className: cls.name,
    name,
    trait,
    stats,
    hp: hpMax,
    hpMax,
    silver,
    omens,
    weapon,
    armor,
    specialty,
    specialtyLabel: cls.specialty_label,
  };
}

function toPartyMember(c) {
  // Match the BLANK_PC shape used in PartyTracker.
  const notes = [
    `Weapon: ${c.weapon.name} (${c.weapon.damage}).`,
    `Armor: ${c.armor.name} — ${c.armor.absorb}.`,
    `${c.specialtyLabel}: ${c.specialty}`,
    `Trait: ${c.trait}.`,
  ].join('\n');
  return {
    id: uid('pc'),
    name: c.name,
    class: c.className,
    hp: c.hp,
    hpMax: c.hpMax,
    str: c.stats.str.mod,
    agl: c.stats.agl.mod,
    pre: c.stats.pre.mod,
    tou: c.stats.tou.mod,
    omens: c.omens,
    silver: c.silver,
    conditions: '',
    notes,
    dead: false,
    expanded: true,
  };
}

export default function CharacterGenerator({ open, onClose, onAddToParty }) {
  const [classId, setClassId] = useState(classesData.classes[0].id);
  const [character, setCharacter] = useState(null);

  if (!open) return null;

  const cls = classesData.classes.find((c) => c.id === classId) ?? classesData.classes[0];

  const roll = () => setCharacter(rollCharacter(cls));

  const reroll = (field) => {
    if (!character) return;
    setCharacter((c) => {
      const next = { ...c };
      switch (field) {
        case 'name':
          next.name = rollValue(names.entries);
          break;
        case 'trait':
          next.trait = rollValue(traits.traits);
          break;
        case 'hp': {
          const hp = Math.max(1, modOf(c.stats.tou.score) + rollDie(cls.hp_die));
          next.hp = hp;
          next.hpMax = hp;
          break;
        }
        case 'silver':
          next.silver = rollExpr(`${cls.silver_count}d6`) * cls.silver_mult;
          break;
        case 'omens':
          next.omens = rollDie(cls.omens_die);
          break;
        case 'weapon':
          next.weapon = pickWeapon(cls);
          break;
        case 'armor':
          next.armor = pickArmor(cls);
          break;
        case 'specialty':
          next.specialty = rollValue(cls.specialties);
          break;
        case 'str':
        case 'agl':
        case 'pre':
        case 'tou': {
          const score = rollExpr(cls.stat_formulas?.[field] ?? '3d6');
          next.stats = { ...c.stats, [field]: { score, mod: modOf(score) } };
          // Tou affects hp max; recompute if rerolling Tou.
          if (field === 'tou') {
            const hp = Math.max(1, modOf(score) + rollDie(cls.hp_die));
            next.hp = hp;
            next.hpMax = hp;
          }
          break;
        }
        default:
          break;
      }
      return next;
    });
  };

  const addToParty = () => {
    if (!character || !onAddToParty) return;
    onAddToParty(toPartyMember(character));
    setCharacter(null);
    onClose();
  };

  const onPickClass = (e) => {
    setClassId(e.target.value);
    setCharacter(null);
  };

  return (
    <section className="char-gen" role="dialog" aria-label="Character generator">
      <header className="char-gen__header">
        <h4>NEW CHARACTER</h4>
        <button
          type="button"
          className="iconbtn"
          onClick={onClose}
          aria-label="Close generator"
        >
          ✕
        </button>
      </header>

      <div className="char-gen__class-row">
        <label>
          Class
          <select value={classId} onChange={onPickClass}>
            {classesData.classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <button type="button" className="iconbtn iconbtn--rules" onClick={roll}>
          ⚂ roll character
        </button>
      </div>

      <p className="char-gen__blurb">{cls.blurb}</p>
      <p className="char-gen__ability">{cls.ability}</p>

      {character && (
        <div className="char-gen__sheet">
          <div className="char-gen__row">
            <span className="cg-label">Name</span>
            <span className="cg-value">{character.name}</span>
            <button type="button" className="iconbtn" onClick={() => reroll('name')} title="Reroll name">⟲</button>
          </div>

          <div className="char-gen__stats">
            {STATS.map((s) => (
              <div key={s} className="cg-stat">
                <span className="cg-stat__label">{STAT_LABELS[s]}</span>
                <span className="cg-stat__score">{character.stats[s].score}</span>
                <span className="cg-stat__mod">{character.stats[s].mod >= 0 ? `+${character.stats[s].mod}` : character.stats[s].mod}</span>
                <button type="button" className="iconbtn cg-stat__reroll" onClick={() => reroll(s)} title={`Reroll ${STAT_LABELS[s]}`}>⟲</button>
              </div>
            ))}
          </div>

          <div className="char-gen__row">
            <span className="cg-label">HP</span>
            <span className="cg-value">{character.hp} / {character.hpMax}</span>
            <button type="button" className="iconbtn" onClick={() => reroll('hp')} title="Reroll HP">⟲</button>
          </div>
          <div className="char-gen__row">
            <span className="cg-label">Silver</span>
            <span className="cg-value">{character.silver}s</span>
            <button type="button" className="iconbtn" onClick={() => reroll('silver')} title="Reroll silver">⟲</button>
          </div>
          <div className="char-gen__row">
            <span className="cg-label">Omens</span>
            <span className="cg-value">{character.omens}</span>
            <button type="button" className="iconbtn" onClick={() => reroll('omens')} title="Reroll omens">⟲</button>
          </div>
          <div className="char-gen__row">
            <span className="cg-label">Weapon</span>
            <span className="cg-value">{character.weapon.name} <em>({character.weapon.damage})</em></span>
            <button type="button" className="iconbtn" onClick={() => reroll('weapon')} title="Reroll weapon">⟲</button>
          </div>
          <div className="char-gen__row">
            <span className="cg-label">Armor</span>
            <span className="cg-value">{character.armor.name} <em>({character.armor.absorb})</em></span>
            <button type="button" className="iconbtn" onClick={() => reroll('armor')} title="Reroll armor">⟲</button>
          </div>
          <div className="char-gen__row char-gen__row--wide">
            <span className="cg-label">{character.specialtyLabel}</span>
            <span className="cg-value">{character.specialty}</span>
            <button type="button" className="iconbtn" onClick={() => reroll('specialty')} title="Reroll specialty">⟲</button>
          </div>
          <div className="char-gen__row char-gen__row--wide">
            <span className="cg-label">Trait</span>
            <span className="cg-value">{character.trait}</span>
            <button type="button" className="iconbtn" onClick={() => reroll('trait')} title="Reroll trait">⟲</button>
          </div>

          <footer className="char-gen__foot">
            <button type="button" className="iconbtn iconbtn--rules" onClick={addToParty}>
              + add to party
            </button>
          </footer>
        </div>
      )}
    </section>
  );
}
