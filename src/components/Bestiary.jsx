import { useEffect, useMemo, useRef, useState } from 'react';
import bestiary from '../data/bestiary.json';

function byName(a, b) {
  return a.name.localeCompare(b.name);
}

// Name matches outrank descriptor matches. Within each rank, alphabetical.
function rankedSearch(entries, query) {
  if (!query) return entries.slice().sort(byName);
  const q = query.toLowerCase();
  const nameHits = [];
  const descHits = [];
  for (const e of entries) {
    if (e.name.toLowerCase().includes(q)) nameHits.push(e);
    else if ((e.descriptor || '').toLowerCase().includes(q)) descHits.push(e);
  }
  return [...nameHits.sort(byName), ...descHits.sort(byName)];
}

function formatForNotes(e) {
  return [
    `Bestiary — ${e.name}`,
    e.descriptor ? `  ${e.descriptor}` : null,
    `  HP ${e.hp || '?'} · Morale ${e.morale || '?'} · ${e.attack || '—'}`,
    e.special ? `  Special: ${e.special}` : null,
    e.source ? `  (${e.source})` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export default function Bestiary({ open, onClose, canAddToNotes, onAddToNotes }) {
  const [query, setQuery] = useState('');
  const [hideStubs, setHideStubs] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [justAdded, setJustAdded] = useState(null);
  const searchRef = useRef(null);

  // Auto-focus search on open. requestAnimationFrame waits for the panel to be
  // in the DOM before the focus call lands.
  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => searchRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  const filtered = useMemo(() => {
    let list = bestiary.entries;
    if (hideStubs) list = list.filter((e) => !e.stub);
    return rankedSearch(list, query);
  }, [query, hideStubs]);

  if (!open) return null;

  const handleAdd = (e) => {
    if (!canAddToNotes || !onAddToNotes) return;
    onAddToNotes(formatForNotes(e));
    setJustAdded(e.id);
    window.setTimeout(() => setJustAdded(null), 1600);
  };

  return (
    <aside className="bestiary" role="dialog" aria-label="Bestiary">
      <header className="bestiary__header">
        <h3>BESTIARY</h3>
        <span className="bestiary__count">{filtered.length} / {bestiary.count}</span>
        <button type="button" className="iconbtn" onClick={onClose} aria-label="Close bestiary">✕</button>
      </header>

      <div className="bestiary__controls">
        <input
          ref={searchRef}
          type="search"
          className="bestiary__search"
          placeholder={`search ${bestiary.count} creatures…`}
          value={query}
          onChange={(ev) => {
            setQuery(ev.target.value);
            setExpandedId(null);
          }}
        />
        <label className="bestiary__filter" title="Hide entries with no canonical stat block">
          <input
            type="checkbox"
            checked={hideStubs}
            onChange={(ev) => setHideStubs(ev.target.checked)}
          />
          hide stubs
        </label>
      </div>

      {filtered.length === 0 && (
        <p className="bestiary__empty">Nothing matches “{query}”.</p>
      )}

      <ul className="bestiary__list">
        {filtered.map((e) => {
          const isOpen = expandedId === e.id;
          return (
            <li
              key={e.id}
              className={`bestiary-row ${e.stub ? 'bestiary-row--stub' : ''} ${isOpen ? 'bestiary-row--open' : ''}`}
            >
              <button
                type="button"
                className="bestiary-row__head"
                onClick={() => setExpandedId(isOpen ? null : e.id)}
                aria-expanded={isOpen}
              >
                <span className="bestiary-row__name">
                  {e.name}
                  {e.variant ? <em className="bestiary-row__variant"> ({e.variant.toLowerCase()})</em> : null}
                </span>
                <span className="bestiary-row__quick">
                  {e.hp ? <span>HP {e.hp}</span> : null}
                  {e.morale ? <span>M {e.morale}</span> : null}
                  {e.stub ? <span className="bestiary-row__stub-tag">stub</span> : null}
                </span>
              </button>

              {!isOpen && e.descriptor && (
                <p className="bestiary-row__descriptor">{e.descriptor}</p>
              )}

              {isOpen && (
                <div className="bestiary-row__detail">
                  {e.descriptor && (
                    <p className="bestiary-row__descriptor">{e.descriptor}</p>
                  )}
                  <dl className="bestiary-stats">
                    <div>
                      <dt>HP</dt>
                      <dd>{e.hp || '—'}</dd>
                    </div>
                    <div>
                      <dt>Morale</dt>
                      <dd>{e.morale || '—'}</dd>
                    </div>
                    <div className="bestiary-stats__attack">
                      <dt>Attack</dt>
                      <dd>{e.attack || '—'}</dd>
                    </div>
                  </dl>
                  {e.special && (
                    <p className="bestiary-row__special">
                      <span className="label">Special:</span> {e.special}
                    </p>
                  )}
                  {e.lore && <p className="bestiary-row__lore">{e.lore}</p>}
                  {e.stub && (
                    <p className="bestiary-row__stub-note">
                      <span className="label">Note:</span> {e.stub}
                    </p>
                  )}
                  {e.source && (
                    <p className="bestiary-row__source">{e.source}</p>
                  )}
                  <footer className="bestiary-row__foot">
                    <button
                      type="button"
                      className="iconbtn"
                      onClick={() => handleAdd(e)}
                      disabled={!canAddToNotes}
                      title={
                        canAddToNotes
                          ? 'Append this stat block to the current node’s session notes'
                          : 'Load a node before adding to notes'
                      }
                    >
                      {justAdded === e.id ? '✓ added' : '+ add to gm notes'}
                    </button>
                  </footer>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
