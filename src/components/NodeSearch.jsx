import { useEffect, useMemo, useRef, useState } from 'react';

// Full-text search across the loaded adventure: titles, atmosphere, read-aloud,
// description, GM notes, NPC names, enemy names, secrets. Click a hit to jump.

function indexNode(n) {
  const c = n.contents || {};
  const parts = [
    n.title,
    n.atmosphere,
    n.read_aloud,
    c.description,
    n.gm_notes,
    ...(c.npcs || []).map((x) => `${x.name} ${x.description || ''}`),
    ...(c.enemies || []).map((x) => `${x.name} ${x.special || ''}`),
    ...(c.items || []),
    ...(c.secrets || []),
    ...(c.traps || []).map((x) => `${x.name} ${x.effect || ''}`),
  ];
  return parts.filter(Boolean).join(' • ').toLowerCase();
}

function snippet(haystack, q, span = 110) {
  const i = haystack.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return haystack.slice(0, span * 2);
  const start = Math.max(0, i - span);
  const end = Math.min(haystack.length, i + q.length + span);
  return (start > 0 ? '… ' : '') + haystack.slice(start, end) + (end < haystack.length ? ' …' : '');
}

export default function NodeSearch({ open, onClose, adventure, onJump }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  const index = useMemo(() => {
    return (adventure?.nodes ?? []).map((n) => ({ node: n, blob: indexNode(n) }));
  }, [adventure]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return index
      .filter((row) => row.blob.includes(q))
      .map((row) => ({ node: row.node, snippet: snippet(row.blob, q) }));
  }, [index, query]);

  if (!open) return null;

  return (
    <aside className="node-search" role="dialog" aria-label="Find in adventure">
      <header className="node-search__header">
        <h3>FIND IN {adventure?.meta?.title?.toUpperCase() || 'ADVENTURE'}</h3>
        <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">✕</button>
      </header>

      <div className="node-search__controls">
        <input
          ref={inputRef}
          type="search"
          placeholder="title, NPC, enemy, secret, atmosphere…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="node-search__count">{results.length} hit{results.length === 1 ? '' : 's'}</span>
      </div>

      <ol className="node-search__hits">
        {query && results.length === 0 && (
          <li className="empty">Nothing matches. The text is silent on the subject.</li>
        )}
        {results.map(({ node, snippet: s }) => (
          <li key={node.id}>
            <button
              type="button"
              className="node-search__hit"
              onClick={() => {
                onJump(node.id);
                onClose();
              }}
            >
              <span className="node-search__hit-title">{node.title || node.id}</span>
              <span className="node-search__hit-snippet">{s}</span>
            </button>
          </li>
        ))}
      </ol>
    </aside>
  );
}
