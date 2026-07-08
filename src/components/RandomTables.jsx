import { useMemo, useState } from 'react';
import { roll } from '../utils/tables.js';
import gm from '../data/tables-gm.json';
import weather from '../data/tables-weather.json';
import reaction from '../data/tables-reaction.json';
import names from '../data/tables-names.json';
import traits from '../data/tables-traits.json';
import npc from '../data/tables-npc.json';
import items from '../data/tables-items.json';
import traps from '../data/tables-traps.json';
import overland from '../data/tables-overland.json';
import dungeons from '../data/tables-bedeviled-dungeons.json';

const formatTrap = (t) => `${t.name} — ${t.effect} (DR ${t.dr})`;

// Every rollable GM table, normalized into one list. Several reuse the same JSON
// the generators draw from, so there is one source of truth per table.
const TABLES = [
  // Character
  { id: 'names', cat: 'Character', name: 'Names', die: 'd6×d8', data: names.entries },
  { id: 'traits', cat: 'Character', name: 'Terrible Traits', die: 'd20', data: traits.traits },
  { id: 'bodies', cat: 'Character', name: 'Broken Bodies', die: 'd20', data: traits.bodies },
  { id: 'habits', cat: 'Character', name: 'Bad Habits', die: 'd20', data: traits.habits },
  { id: 'tales', cat: 'Character', name: gm.troubling_tales.name, die: gm.troubling_tales.die, data: gm.troubling_tales.entries },
  { id: 'feats', cat: 'Character', name: gm.unheroic_feats.name, die: gm.unheroic_feats.die, data: gm.unheroic_feats.entries },

  // NPCs & Encounters
  { id: 'reaction', cat: 'NPCs & Encounters', name: 'Reaction', die: '2d6', data: reaction.reaction },
  { id: 'occupations', cat: 'NPCs & Encounters', name: 'Occupation', die: 'd20', data: npc.occupations },
  { id: 'factions', cat: 'NPCs & Encounters', name: 'Faction', die: 'weighted', data: npc.factions },
  { id: 'secrets', cat: 'NPCs & Encounters', name: 'NPC Secret', die: 'd20', data: npc.secrets },

  // Treasure
  { id: 'items', cat: 'Treasure', name: 'Items & Trinkets', die: 'd100', data: items.entries },
  { id: 'pockets', cat: 'Treasure', name: gm.contents_of_pockets.name, die: gm.contents_of_pockets.die, data: gm.contents_of_pockets.entries },

  // Travel & Environment
  { id: 'weather', cat: 'Travel & Environment', name: 'Weather', die: 'd12', data: weather.entries },
  { id: 'road', cat: 'Travel & Environment', name: 'Road Type', die: 'd8', data: overland.road_types },
  { id: 'roadevents', cat: 'Travel & Environment', name: 'Road Event', die: 'd20', data: overland.events },
  { id: 'forage', cat: 'Travel & Environment', name: 'Foraging', die: 'd6', data: overland.navigation },
  { id: 'village', cat: 'Travel & Environment', name: 'The Village Is…', die: 'd6', data: overland.villages },
  { id: 'offroad', cat: 'Travel & Environment', name: 'Off the Road', die: 'd12', data: overland.off_road },

  // Dungeon
  { id: 'dungadj', cat: 'Dungeon', name: 'Dungeon — Adjective', die: 'd12', data: dungeons.name_adjectives },
  { id: 'dungnoun', cat: 'Dungeon', name: 'Dungeon — Noun', die: 'd12', data: dungeons.name_nouns },
  { id: 'dungstatus', cat: 'Dungeon', name: 'Dungeon Status', die: 'd6', data: dungeons.status },
  { id: 'dungwho', cat: 'Dungeon', name: 'Who Lives There', die: 'd12', data: dungeons.inhabitants },
  { id: 'dungfeat', cat: 'Dungeon', name: 'Distinctive Feature', die: 'd12', data: dungeons.features },
  { id: 'dungdanger', cat: 'Dungeon', name: 'Imminent Danger', die: 'd10', data: dungeons.imminent_danger },
  { id: 'dungroom', cat: 'Dungeon', name: 'Room Detail', die: '1-in-31', data: dungeons.room_atmospheres },
  { id: 'traps', cat: 'Dungeon', name: 'Traps', die: 'd12', data: traps.entries, format: formatTrap },

  // Powers
  { id: 'unclean', cat: 'Powers', name: gm.unclean_scrolls.name, die: gm.unclean_scrolls.die, data: gm.unclean_scrolls.entries },
  { id: 'sacred', cat: 'Powers', name: gm.sacred_scrolls.name, die: gm.sacred_scrolls.die, data: gm.sacred_scrolls.entries },
  { id: 'catastrophes', cat: 'Powers', name: gm.arcane_catastrophes.name, die: gm.arcane_catastrophes.die, data: gm.arcane_catastrophes.entries },

  // Seeds & Apocalypse
  { id: 'seedwhere', cat: 'Seeds & Apocalypse', name: gm.adventure_seed_where.name, die: gm.adventure_seed_where.die, data: gm.adventure_seed_where.entries },
  { id: 'seedwho', cat: 'Seeds & Apocalypse', name: gm.adventure_seed_who.name, die: gm.adventure_seed_who.die, data: gm.adventure_seed_who.entries },
  { id: 'seedwhy', cat: 'Seeds & Apocalypse', name: gm.adventure_seed_why.name, die: gm.adventure_seed_why.die, data: gm.adventure_seed_why.entries },
  { id: 'basilisk', cat: 'Seeds & Apocalypse', name: gm.basilisks_demand.name, die: gm.basilisks_demand.die, data: gm.basilisks_demand.entries },
];

const CATEGORY_ORDER = [
  'Character',
  'NPCs & Encounters',
  'Treasure',
  'Travel & Environment',
  'Dungeon',
  'Powers',
  'Seeds & Apocalypse',
];

function rollTable(t) {
  const r = roll(t.data);
  return t.format ? t.format(r.value) : r.value;
}

export default function RandomTables({ open, onClose, canAddToNotes, onAddToNotes }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({});
  const [justAdded, setJustAdded] = useState(null);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q ? TABLES.filter((t) => t.name.toLowerCase().includes(q)) : TABLES;
    const byCat = new Map();
    for (const t of matches) {
      if (!byCat.has(t.cat)) byCat.set(t.cat, []);
      byCat.get(t.cat).push(t);
    }
    return CATEGORY_ORDER.filter((c) => byCat.has(c)).map((c) => [c, byCat.get(c)]);
  }, [query]);

  if (!open) return null;

  const doRoll = (t) => {
    setResults((prev) => ({ ...prev, [t.id]: rollTable(t) }));
  };

  const addToNotes = (t) => {
    const value = results[t.id];
    if (!value || !canAddToNotes || !onAddToNotes) return;
    onAddToNotes(`${t.name} (${t.die}) → ${value}`);
    setJustAdded(t.id);
    window.setTimeout(() => setJustAdded(null), 1400);
  };

  return (
    <aside className="tables" role="dialog" aria-label="Random tables">
      <header className="tables__header">
        <h3>TABLES</h3>
        <button type="button" className="iconbtn" onClick={onClose} aria-label="Close tables">✕</button>
      </header>

      <div className="tables__controls">
        <input
          type="search"
          className="tables__search"
          placeholder={`search ${TABLES.length} tables…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {grouped.length === 0 && (
        <p className="tables__empty">No table matches “{query}”.</p>
      )}

      <div className="tables__body">
        {grouped.map(([cat, list]) => (
          <section key={cat} className="tables__category">
            <h4 className="tables__cat-head">{cat}</h4>
            <ul className="tables__list">
              {list.map((t) => (
                <li key={t.id} className="table-row">
                  <div className="table-row__head">
                    <span className="table-row__name">{t.name}</span>
                    <span className="table-row__die">{t.die}</span>
                    <button
                      type="button"
                      className="iconbtn iconbtn--rules table-row__roll"
                      onClick={() => doRoll(t)}
                    >
                      roll
                    </button>
                  </div>
                  {results[t.id] && (
                    <div className="table-row__result">
                      <span className="table-row__value">{results[t.id]}</span>
                      <button
                        type="button"
                        className="iconbtn table-row__note"
                        onClick={() => addToNotes(t)}
                        disabled={!canAddToNotes}
                        title={canAddToNotes ? 'Append to session notes' : 'Load a node first'}
                      >
                        {justAdded === t.id ? '✓' : '+ notes'}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  );
}
