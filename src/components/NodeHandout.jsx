// Printable / projectable handout view of a node: read-aloud + atmosphere only
// (no GM notes, no unrevealed secrets, no enemy stat blocks). Open in an
// overlay so the GM can show it on a tablet or hit ⌘P to print.

export default function NodeHandout({ open, onClose, node, adventureTitle }) {
  if (!open || !node) return null;

  return (
    <div className="picker-overlay handout-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <article className="handout" onClick={(e) => e.stopPropagation()}>
        <header className="handout__header">
          <span className="handout__adventure">{adventureTitle}</span>
          <h1 className="handout__title">{node.title}</h1>
          <button
            type="button"
            className="iconbtn handout__close"
            onClick={onClose}
            aria-label="Close handout"
          >
            ✕
          </button>
          <button
            type="button"
            className="iconbtn handout__print"
            onClick={() => window.print()}
            title="Print this handout"
          >
            🖨 print
          </button>
        </header>

        {node.atmosphere && (
          <section className="handout__atmosphere">
            <p>{node.atmosphere}</p>
          </section>
        )}

        {node.read_aloud && (
          <section className="handout__readaloud">
            <blockquote>{node.read_aloud}</blockquote>
          </section>
        )}

        {(node.contents?.items?.length ?? 0) > 0 && (
          <section className="handout__items">
            <h3>What you see</h3>
            <ul>
              {node.contents.items.map((it, i) => (
                <li key={i}>{typeof it === 'string' ? it : it.name || JSON.stringify(it)}</li>
              ))}
            </ul>
          </section>
        )}

        {(node.contents?.npcs?.length ?? 0) > 0 && (
          <section className="handout__npcs">
            <h3>Who is here</h3>
            <ul>
              {node.contents.npcs.map((n, i) => (
                <li key={i}>
                  <strong>{n.name}</strong>
                  {n.description && <> — {n.description}</>}
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="handout__foot">
          <small>For the table. The GM's secrets stay with the GM.</small>
        </footer>
      </article>
    </div>
  );
}
