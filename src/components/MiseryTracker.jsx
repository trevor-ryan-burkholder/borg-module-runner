import { useEffect, useState } from 'react';
import { rollDie } from '../utils/dice.js';
import NumberField from './NumberField.jsx';

const STORAGE_KEY = 'mb-misery-state';

// The Calendar of Nechrubel: 7 Psalms × ~7 verses. We do not reproduce the
// verses verbatim — that's the GM's book to read from. The tracker counts
// position and lets the GM record what was triggered.
const PSALMS = [
  { roman: 'I',   slots: 7, name: 'The first Psalm' },
  { roman: 'II',  slots: 7, name: 'The second Psalm' },
  { roman: 'III', slots: 7, name: 'The third Psalm' },
  { roman: 'IV',  slots: 7, name: 'The fourth Psalm' },
  { roman: 'V',   slots: 7, name: 'The fifth Psalm' },
  { roman: 'VI',  slots: 7, name: 'The sixth Psalm' },
  { roman: 'VII', slots: 7, name: 'The seventh Psalm — the world ends on the last' },
];

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveState(s) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

const blankState = () => ({
  day: 1,
  psalm: 0,
  verse: 0,
  triggered: [],
  lastRoll: null,
});

export default function MiseryTracker({ open, onClose }) {
  const [state, setState] = useState(() => loadState() || blankState());

  useEffect(() => {
    saveState(state);
  }, [state]);

  if (!open) return null;

  const verseDescription = state.triggered.map((t, i) => ({ ...t, idx: i + 1 }));

  const advanceDay = () => setState((s) => ({ ...s, day: s.day + 1 }));
  const setDay = (d) => setState((s) => ({ ...s, day: Math.max(1, +d || 1) }));

  const rollMisery = () => {
    const die = rollDie(6);
    if (die === 1) {
      // A Misery triggers.
      setState((s) => {
        // Defensive: if the world has already ended, refuse to advance — the
        // disabled button blocks the UI path, but a stale closure or
        // programmatic call could otherwise silently loop the final psalm.
        const lastSlots = PSALMS[PSALMS.length - 1]?.slots ?? 7;
        if (s.psalm === PSALMS.length - 1 && s.verse >= lastSlots) {
          return { ...s, lastRoll: { die, triggered: false, day: s.day } };
        }
        let psalm = s.psalm;
        let verse = s.verse + 1;
        const slots = PSALMS[psalm]?.slots ?? 7;
        if (verse > slots) {
          psalm = Math.min(PSALMS.length - 1, psalm + 1);
          verse = 1;
        }
        const triggered = [
          ...s.triggered,
          {
            day: s.day,
            psalm,
            verse,
            note: '',
            at: Date.now(),
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          },
        ];
        return { ...s, psalm, verse, triggered, lastRoll: { die, triggered: true, day: s.day } };
      });
    } else {
      setState((s) => ({ ...s, lastRoll: { die, triggered: false, day: s.day } }));
    }
  };

  const forceMisery = () => {
    setState((s) => {
      const lastSlots = PSALMS[PSALMS.length - 1]?.slots ?? 7;
      if (s.psalm === PSALMS.length - 1 && s.verse >= lastSlots) return s;
      let psalm = s.psalm;
      let verse = s.verse + 1;
      const slots = PSALMS[psalm]?.slots ?? 7;
      if (verse > slots) {
        psalm = Math.min(PSALMS.length - 1, psalm + 1);
        verse = 1;
      }
      return {
        ...s,
        psalm,
        verse,
        triggered: [
          ...s.triggered,
          { day: s.day, psalm, verse, note: '', at: Date.now(), id: `${Date.now()}-${Math.random().toString(36).slice(2, 5)}` },
        ],
        lastRoll: { die: 0, triggered: true, day: s.day, forced: true },
      };
    });
  };

  const editNote = (id, note) => {
    setState((s) => ({
      ...s,
      triggered: s.triggered.map((t) => (t.id === id ? { ...t, note } : t)),
    }));
  };

  const undoLast = () => {
    setState((s) => {
      if (s.triggered.length === 0) return s;
      const triggered = s.triggered.slice(0, -1);
      // Restore directly from the entry being undone — undoing across a
      // psalm-rollover (verse 7 → next psalm verse 1) was previously stuck
      // at verse 0 because the guard was `verse < 0` after the decrement.
      const restoreTo = triggered[triggered.length - 1];
      const psalm = restoreTo ? restoreTo.psalm : 0;
      const verse = restoreTo ? restoreTo.verse : 0;
      return { ...s, psalm, verse, triggered };
    });
  };

  const reset = () => {
    if (!window.confirm('Reset the Calendar of Nechrubel? All triggered Miseries will be cleared.')) return;
    setState(blankState());
  };

  const psalm = PSALMS[state.psalm];
  const totalSlots = PSALMS.reduce((a, p) => a + p.slots, 0);
  const triggeredCount = state.triggered.length;
  const isWorldEnding = state.psalm === PSALMS.length - 1 && state.verse >= (PSALMS[PSALMS.length - 1]?.slots ?? 7);

  return (
    <aside className="misery-tracker" role="dialog" aria-label="Calendar of Nechrubel">
      <header className="misery-tracker__header">
        <h3>CALENDAR OF NECHRUBEL</h3>
        <button type="button" className="iconbtn" onClick={onClose} aria-label="Close calendar">
          ✕
        </button>
      </header>

      <section className="misery-tracker__state">
        <div className="misery-stat">
          <span className="misery-stat__label">Day</span>
          <NumberField
            min={1}
            value={state.day}
            onChange={(n) => setDay(Math.max(1, n))}
          />
          <button type="button" className="iconbtn" onClick={advanceDay}>+1 day</button>
        </div>
        <div className="misery-stat">
          <span className="misery-stat__label">Position</span>
          <span className="misery-stat__value">
            Psalm {psalm.roman}, Verse {state.verse}/{psalm.slots}
          </span>
        </div>
        <div className="misery-stat">
          <span className="misery-stat__label">Triggered</span>
          <span className="misery-stat__value">{triggeredCount} / {totalSlots}</span>
        </div>
      </section>

      <section className="misery-tracker__roll">
        <button
          type="button"
          className="iconbtn iconbtn--rules misery-tracker__roll-btn"
          onClick={rollMisery}
          disabled={isWorldEnding}
        >
          roll d6 (1 = next Misery)
        </button>
        <button
          type="button"
          className="iconbtn"
          onClick={forceMisery}
          disabled={isWorldEnding}
          title="Manually trigger the next Misery — for scripted events"
        >
          force trigger
        </button>
        <button
          type="button"
          className="iconbtn"
          onClick={undoLast}
          disabled={triggeredCount === 0}
        >
          undo last
        </button>
        {state.lastRoll && (
          <div
            className={`misery-tracker__last ${state.lastRoll.triggered ? 'misery-tracker__last--hit' : 'misery-tracker__last--miss'}`}
          >
            Day {state.lastRoll.day}: {state.lastRoll.forced ? 'forced' : `rolled d6=${state.lastRoll.die}`} —{' '}
            {state.lastRoll.triggered ? 'Misery triggers. Read the next verse aloud.' : 'no Misery this day.'}
          </div>
        )}
        {isWorldEnding && (
          <div className="misery-tracker__end">
            ⚱ The world has ended. The final Misery has come. The campaign concludes.
          </div>
        )}
      </section>

      <section className="misery-tracker__log">
        <h4>TRIGGERED MISERIES</h4>
        {verseDescription.length === 0 ? (
          <p className="empty">None yet. The world still has some time.</p>
        ) : (
          <ol className="misery-tracker__entries">
            {verseDescription.map((t) => (
              <li key={t.id} className="misery-entry">
                <div className="misery-entry__head">
                  <span className="misery-entry__pos">
                    Psalm {PSALMS[t.psalm].roman}, Verse {t.verse}
                  </span>
                  <span className="misery-entry__day">day {t.day}</span>
                </div>
                <textarea
                  className="misery-entry__note"
                  placeholder="Note the verse text from your book and any session effects…"
                  value={t.note}
                  onChange={(e) => editNote(t.id, e.target.value)}
                  rows={2}
                />
              </li>
            ))}
          </ol>
        )}
      </section>

      <footer className="misery-tracker__foot">
        <small>
          Verses are not reproduced — read from your book of MÖRK BORG, page 92.
        </small>
        <button type="button" className="iconbtn iconbtn--danger" onClick={reset}>
          ⟲ reset calendar
        </button>
      </footer>
    </aside>
  );
}
