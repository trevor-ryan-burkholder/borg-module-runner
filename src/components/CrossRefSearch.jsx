import { useEffect, useMemo, useRef, useState } from 'react';
import { listBundledAdventures, getBundledAdventure } from '../utils/loadAdventure.js';
import { listUserAdventures } from '../utils/library.js';

// Search across every adventure (bundled + user library) for nodes / NPCs /
// enemies that match a query. Click a hit to load that adventure and jump to
// the matching node.

function indexAdventure(adv) {
  const advTitle = adv.meta?.title || adv.meta?.id;
  return (adv.nodes ?? []).map((n) => {
    const c = n.contents || {};
    const parts = [
      n.title,
      n.atmosphere,
      n.read_aloud,
      c.description,
      ...(c.npcs || []).map((x) => x.name),
      ...(c.enemies || []).map((x) => x.name),
      ...(c.items || []),
      ...(c.secrets || []),
    ];
    return {
      advId: adv.meta?.id,
      advTitle,
      nodeId: n.id,
      nodeTitle: n.title || n.id,
      blob: parts.filter(Boolean).join(' • ').toLowerCase(),
    };
  });
}

// Module-scope cache so the index only rebuilds when the library actually
// changes (bundled count + user adventures count, plus the active user titles
// in case a rename happened). For 13 bundled + a handful of user adventures
// it's milliseconds, but it adds up if the GM opens the panel often.
let _cache = null;
function getIndex() {
  const bundled = listBundledAdventures();
  const users = listUserAdventures();
  const key = `${bundled.length}:${users.length}:${users.map((u) => u.meta?.id || '').join(',')}`;
  if (_cache && _cache.key === key) return _cache.rows;
  const rows = [];
  for (const entry of bundled) {
    const adv = getBundledAdventure(entry.id);
    if (adv) rows.push(...indexAdventure(adv));
  }
  for (const adv of users) rows.push(...indexAdventure(adv));
  _cache = { key, rows };
  return rows;
}

export default function CrossRefSearch({ open, onClose, onLoad }) {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => { setActiveIdx(0); }, [query]);

  const index = useMemo(() => (open ? getIndex() : []), [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return index.filter((row) => row.blob.includes(q)).slice(0, 60);
  }, [index, query]);

  if (!open) return null;

  const submit = () => {
    if (results.length === 0) return;
    const row = results[Math.min(activeIdx, results.length - 1)];
    onLoad(row.advId, row.nodeId);
    onClose();
  };

  return (
    <aside className="cross-search" role="dialog" aria-label="Search every adventure">
      <header className="cross-search__header">
        <h3>SEARCH EVERY ADVENTURE</h3>
        <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">✕</button>
      </header>

      <div className="cross-search__controls">
        <input
          ref={inputRef}
          type="search"
          placeholder="NPC name, location, faction, item…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveIdx((i) => Math.min(results.length - 1, i + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIdx((i) => Math.max(0, i - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
        />
        <span className="cross-search__count">{results.length} hit{results.length === 1 ? '' : 's'}</span>
      </div>

      <ol className="cross-search__hits">
        {query && results.length === 0 && (
          <li className="empty">Nothing matches across the library.</li>
        )}
        {results.map((row, i) => (
          <li key={`${row.advId}-${row.nodeId}-${i}`}>
            <button
              type="button"
              className={`cross-search__hit ${i === activeIdx ? 'cross-search__hit--active' : ''}`}
              onClick={() => {
                onLoad(row.advId, row.nodeId);
                onClose();
              }}
              onMouseEnter={() => setActiveIdx(i)}
            >
              <span className="cross-search__hit-node">{row.nodeTitle}</span>
              <span className="cross-search__hit-adv">{row.advTitle}</span>
            </button>
          </li>
        ))}
      </ol>
    </aside>
  );
}
