// The Mörk Borg necessity: a roster of every PC who has died, where, and how.
export default function Graveyard({ open, onClose, graveyard, onExhume }) {
  if (!open) return null;
  const stones = graveyard ?? [];

  return (
    <aside className="graveyard" role="dialog" aria-label="The graveyard">
      <header className="graveyard__header">
        <h3>THE GRAVEYARD</h3>
        <span className="graveyard__count">{stones.length}</span>
        <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">✕</button>
      </header>

      {stones.length === 0 ? (
        <p className="empty">No deaths yet. Give it time.</p>
      ) : (
        <ul className="graveyard__list">
          {stones
            .slice()
            .sort((a, b) => (b.at ?? 0) - (a.at ?? 0))
            .map((g) => (
              <li key={g.id} className="grave">
                <header className="grave__head">
                  <h4 className="grave__name">{g.name}</h4>
                  {g.class && <span className="grave__class">{g.class}</span>}
                </header>
                <p className="grave__where">died at {g.diedAt}.</p>
                {g.howText && <p className="grave__how">{g.howText}</p>}
                {(Number.isFinite(g.brokenDie) || g.brokenOutcome) && (
                  <p className="grave__broken">
                    {Number.isFinite(g.brokenDie) && <strong>d4 = {g.brokenDie}. </strong>}
                    {g.brokenOutcome}
                  </p>
                )}
                <footer className="grave__foot">
                  {g.at && (
                    <time className="grave__time" dateTime={new Date(g.at).toISOString()}>
                      {new Date(g.at).toLocaleString()}
                    </time>
                  )}
                  <button
                    type="button"
                    className="iconbtn iconbtn--danger"
                    onClick={() => onExhume(g.id)}
                    title="Forget this death (the grave digs itself open)"
                  >
                    exhume
                  </button>
                </footer>
              </li>
            ))}
        </ul>
      )}
    </aside>
  );
}
