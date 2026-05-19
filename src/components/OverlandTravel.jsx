import { useMemo, useState } from 'react';
import { rollValue } from '../utils/tables.js';
import overland from '../data/tables-overland.json';
import weather from '../data/tables-weather.json';
import bestiary from '../data/bestiary.json';

// Build a name-keyed bestiary index once so encounter cross-references can fire.
const bestiaryByName = (() => {
  const m = new Map();
  for (const e of bestiary.entries ?? []) {
    if (!e.name) continue;
    m.set(e.name.toLowerCase(), e);
    // Also index any parenthetical variant or simple noun fragments.
    const stripped = e.name.replace(/\(.*?\)/g, '').trim().toLowerCase();
    if (stripped && !m.has(stripped)) m.set(stripped, e);
  }
  return m;
})();

function findBestiaryMatch(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const [name, entry] of bestiaryByName) {
    // Word-boundary match so "rat" doesn't match "narrate". Trailing "s?" lets a
    // singular entry name match its plural in prose ("d8 zombies in the crypt").
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(`\\b${escaped}s?\\b`, 'i');
    if (rx.test(lower)) return entry;
  }
  return null;
}

export default function OverlandTravel({ open, onClose, travelLog, appendEntry, updateEntry, clearLog }) {
  const [expanded, setExpanded] = useState(null);

  const dayNumber = travelLog.length + 1;

  const advanceWatch = () => {
    const w = rollValue(weather.entries);
    const ev = rollValue(overland.events);
    const nav = rollValue(overland.navigation);
    appendEntry({
      day: dayNumber,
      weather: w,
      event: ev,
      navigation: nav,
      notes: '',
      at: Date.now(),
    });
  };

  const eventMatches = useMemo(() => {
    return travelLog.map((e) => findBestiaryMatch(e.event));
  }, [travelLog]);

  if (!open) return null;

  return (
    <aside className="overland" role="dialog" aria-label="Overland travel">
      <header className="overland__header">
        <h3>OVERLAND</h3>
        <div className="overland__head-actions">
          <button type="button" className="iconbtn iconbtn--rules" onClick={advanceWatch}>
            ▶ advance a watch
          </button>
          <button
            type="button"
            className="iconbtn"
            onClick={() => {
              if (window.confirm('Clear the entire travel log?')) clearLog();
            }}
            disabled={travelLog.length === 0}
          >
            ⟲ new journey
          </button>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">✕</button>
        </div>
      </header>

      {travelLog.length === 0 && (
        <p className="overland__empty">
          The road waits. Press <strong>advance a watch</strong> to begin.
        </p>
      )}

      <ol className="overland__log">
        {travelLog.map((e, i) => {
          const match = eventMatches[i];
          return (
            <li key={i} className="watch">
              <header className="watch__head">
                <span className="watch__day">Day {e.day}</span>
                <span className="watch__weather">☁ {e.weather}</span>
              </header>
              <p className="watch__event">
                <span className="watch__label">Event:</span> {e.event}
                {match && (
                  <button
                    type="button"
                    className="watch__bestiary"
                    onClick={() => setExpanded((id) => (id === `${i}-mob` ? null : `${i}-mob`))}
                    title={`Stat block: ${match.name}`}
                  >
                    ↗ {match.name}
                  </button>
                )}
              </p>
              {expanded === `${i}-mob` && match && (
                <div className="watch__mob">
                  <strong>{match.name}</strong> — <em>{match.descriptor}</em>
                  <br />
                  HP {match.hp || '?'} · Morale {match.morale || '?'} · {match.attack || '—'}
                  {match.special && (
                    <>
                      <br />
                      <span className="watch__mob-special"><b>Special:</b> {match.special}</span>
                    </>
                  )}
                </div>
              )}
              <p className="watch__nav">
                <span className="watch__label">Foraging:</span> {e.navigation}
              </p>
              <textarea
                className="watch__notes"
                rows={2}
                value={e.notes}
                onChange={(ev) => updateEntry(i, { notes: ev.target.value })}
                placeholder="what actually happened, who said what…"
              />
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
