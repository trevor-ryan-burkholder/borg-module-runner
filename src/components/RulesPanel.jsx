import { useEffect, useRef, useState } from 'react';

export default function RulesPanel({ rules, open, onClose }) {
  const sections = rules?.rules_reference?.sections ?? [];
  const [openSection, setOpenSection] = useState(sections[0]?.id ?? null);

  // When the rules set itself changes (e.g. system switch morkborg ↔ ronin-borg),
  // the previously opened section id no longer exists. Reset to the first one.
  useEffect(() => {
    setOpenSection(sections[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules]);

  // No local Escape listener: App's global keydown handler already routes
  // Escape to the topmost open panel. Having a second one here caused two
  // panels to close per keypress when rules + another panel were both open.

  // Only close when a click *starts* and *ends* on the overlay. Stops a text
  // selection drag inside the panel that releases over the overlay from
  // dismissing it. Hook must come before the early return.
  const downOnOverlay = useRef(false);
  if (!open) return null;
  const handleOverlayMouseDown = (e) => {
    downOnOverlay.current = e.target === e.currentTarget;
  };
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && downOnOverlay.current) onClose();
    downOnOverlay.current = false;
  };

  return (
    <div
      className="rules-panel-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Rules reference"
      onMouseDown={handleOverlayMouseDown}
      onClick={handleOverlayClick}
    >
      <aside className="rules-panel" onClick={(e) => e.stopPropagation()}>
        <header className="rules-panel__header">
          <h2>RULES REFERENCE</h2>
          <button
            type="button"
            className="rules-panel__close"
            onClick={onClose}
            aria-label="Close rules"
          >
            ✕
          </button>
        </header>

        <div className="rules-panel__body">
          {sections.map((section) => {
            const expanded = section.id === openSection;
            return (
              <section
                key={section.id}
                className={`rules-section ${expanded ? 'rules-section--open' : ''}`}
              >
                <button
                  type="button"
                  className="rules-section__toggle"
                  onClick={() =>
                    setOpenSection((s) => (s === section.id ? null : section.id))
                  }
                  aria-expanded={expanded}
                >
                  <span className="rules-section__chev">{expanded ? '▾' : '▸'}</span>
                  <span>{section.title}</span>
                </button>
                {expanded && (
                  <dl className="rules-entries">
                    {section.entries.map((entry, i) => (
                      <div key={i} className="rules-entry">
                        <dt>{entry.term}</dt>
                        <dd>{entry.text}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </section>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
