import { useState } from 'react';

export default function SecretsReveal({ secrets }) {
  const [revealed, setRevealed] = useState(() => new Set());

  if (!secrets || secrets.length === 0) {
    return <p className="empty">No secrets here. Or none worth knowing.</p>;
  }

  const reveal = (i) =>
    setRevealed((s) => {
      const next = new Set(s);
      next.add(i);
      return next;
    });

  const collapseAll = () => setRevealed(new Set());

  return (
    <>
      <ul className="secrets-list">
        {secrets.map((secret, i) =>
          revealed.has(i) ? (
            <li key={i} className="secret secret--revealed">
              <span className="secret__mark">✦</span>
              <span className="secret__text">{secret}</span>
            </li>
          ) : (
            <li key={i} className="secret secret--hidden">
              <button
                type="button"
                className="secret__button"
                onClick={() => reveal(i)}
                aria-label={`Reveal secret ${i + 1}`}
              >
                ▴ tap to reveal secret
              </button>
            </li>
          )
        )}
      </ul>
      {revealed.size > 0 && (
        <button
          type="button"
          className="iconbtn secrets-list__collapse"
          onClick={collapseAll}
          title="Hide all revealed secrets again"
        >
          ▾ collapse revealed
        </button>
      )}
    </>
  );
}
