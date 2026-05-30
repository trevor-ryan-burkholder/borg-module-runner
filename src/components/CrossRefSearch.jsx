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

export default function CrossRefSearch({ open, onClose, onLoad }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Pull every adventure once when the panel opens.
  const index = useMemo(() => {
    if (!open) return [];
    const all = [];
    for (const entry of listBundledAdventures()) {
      const adv = getBundledAdventure(entry.id);
      if (adv) all.push(...indexAdventure(adv));
    }
    for (const adv of listUserAdventures()) all.push(...indexAdventure(adv));
    return all;
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return index.filter((row) => row.blob.includes(q)).slice(0, 60);
  }, [index, query]);

  if (!open) return null;

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
              className="cross-search__hit"
              onClick={() => {
                onLoad(row.advId, row.nodeId);
                onClose();
              }}
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
