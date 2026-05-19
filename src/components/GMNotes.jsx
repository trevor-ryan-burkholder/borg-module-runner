import { useState } from 'react';

export default function GMNotes({ notes, scratchNotes, onScratchChange }) {
  const [shown, setShown] = useState(false);

  const hasCanon = !!notes;
  const hasScratch = !!(scratchNotes && scratchNotes.length > 0);
  const editable = typeof onScratchChange === 'function';

  // Nothing to show and no way to add anything — render nothing.
  if (!hasCanon && !hasScratch && !editable) return null;

  return (
    <section className="gm-notes">
      <button
        type="button"
        className="gm-notes__toggle"
        onClick={() => setShown((s) => !s)}
      >
        {shown ? 'hide gm notes' : 'show gm notes (private)'}
      </button>

      {shown && (
        <div className="gm-notes__body" role="note">
          {hasCanon && <p className="gm-notes__canon">{notes}</p>}

          {editable && (
            <label className="gm-notes__scratch">
              <span className="gm-notes__scratch-label">session notes</span>
              <textarea
                className="gm-notes__scratch-text"
                rows={4}
                value={scratchNotes ?? ''}
                onChange={(e) => onScratchChange(e.target.value)}
                placeholder="rolled NPCs, on-the-fly rulings, what the party did here…"
              />
            </label>
          )}
        </div>
      )}
    </section>
  );
}
