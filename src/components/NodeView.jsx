import { useEffect, useState } from 'react';
import EnemyCard from './EnemyCard.jsx';
import ItemList from './ItemList.jsx';
import SecretsReveal from './SecretsReveal.jsx';
import GMNotes from './GMNotes.jsx';
import ExitButton from './ExitButton.jsx';

const TAB_ORDER = [
  { id: 'enemies', label: 'Enemies' },
  { id: 'items', label: 'Items' },
  { id: 'npcs', label: 'NPCs' },
  { id: 'traps', label: 'Traps' },
  { id: 'secrets', label: 'Secrets' },
];

function tabHasContent(tabId, contents) {
  if (!contents) return false;
  const v = contents[tabId];
  return Array.isArray(v) && v.length > 0;
}

export default function NodeView({
  adventure,
  node,
  visited,
  unlockedExits,
  onExit,
  scratchNotes,
  onScratchChange,
  onStartCombat,
}) {
  const [readAloudHidden, setReadAloudHidden] = useState(false);
  const [activeTab, setActiveTab] = useState(null);

  // Reset per-node toggles when node changes.
  useEffect(() => {
    setReadAloudHidden(false);
    const firstTab = TAB_ORDER.find((t) => tabHasContent(t.id, node?.contents));
    setActiveTab(firstTab?.id ?? null);
  }, [node?.id]);

  if (!node) {
    return (
      <main className="node-view node-view--empty">
        <p>The adventure has lost its place. Reset the session.</p>
      </main>
    );
  }

  const availableTabs = TAB_ORDER.filter((t) => tabHasContent(t.id, node.contents));

  return (
    <main className="node-view">
      <header className="node-view__top">
        <div className="top__adventure">{adventure.meta.title}</div>
        <h1 className="top__node">{node.title}</h1>
        {visited && <span className="top__visited" title="Visited">⌑ visited</span>}
        {node.tags && node.tags.length > 0 && (
          <div className="top__tags">
            {node.tags.map((t) => (
              <span key={t} className="tag">{t}</span>
            ))}
          </div>
        )}
      </header>

      {node.atmosphere && (
        <section className="atmosphere">
          <p>{node.atmosphere}</p>
        </section>
      )}

      {node.read_aloud && (
        <section className={`read-aloud ${readAloudHidden ? 'read-aloud--hidden' : ''}`}>
          <header className="read-aloud__head">
            <span className="read-aloud__label">READ ALOUD</span>
            <button
              type="button"
              className="read-aloud__toggle"
              onClick={() => setReadAloudHidden((h) => !h)}
            >
              {readAloudHidden ? 'show' : 'hide after reading'}
            </button>
          </header>
          {!readAloudHidden && <blockquote>{node.read_aloud}</blockquote>}
        </section>
      )}

      {node.contents?.description && (
        <section className="description">
          <h3>WHAT IS HERE</h3>
          <p>{node.contents.description}</p>
        </section>
      )}

      {availableTabs.length > 0 && (
        <section className="contents-tabs">
          <div className="tab-bar" role="tablist">
            {availableTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`tab ${activeTab === tab.id ? 'tab--active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label} <span className="tab__count">{node.contents[tab.id].length}</span>
              </button>
            ))}
          </div>

          <div className="tab-panel" role="tabpanel">
            {activeTab === 'enemies' && (
              <>
                {onStartCombat && (
                  <div className="enemy-grid__cta">
                    <button
                      type="button"
                      className="iconbtn iconbtn--danger"
                      onClick={() => onStartCombat(node.contents.enemies)}
                      title="Start combat with these enemies (C)"
                    >
                      ⚔ start combat
                    </button>
                  </div>
                )}
                <div className="enemy-grid">
                  {node.contents.enemies.map((e, i) => (
                    <EnemyCard key={i} enemy={e} />
                  ))}
                </div>
              </>
            )}
            {activeTab === 'items' && <ItemList items={node.contents.items} />}
            {activeTab === 'npcs' && (
              <ul className="npc-list">
                {node.contents.npcs.map((npc, i) => (
                  <li key={i} className={`npc npc--${npc.attitude || 'neutral'}`}>
                    <h4 className="npc__name">{npc.name}</h4>
                    {npc.attitude && (
                      <span className={`npc__attitude npc__attitude--${npc.attitude}`}>
                        {npc.attitude}
                      </span>
                    )}
                    {npc.description && <p className="npc__desc">{npc.description}</p>}
                    {npc.notes && <p className="npc__notes">{npc.notes}</p>}
                  </li>
                ))}
              </ul>
            )}
            {activeTab === 'traps' && (
              <ul className="trap-list">
                {node.contents.traps.map((trap, i) => (
                  <li key={i} className="trap">
                    <h4 className="trap__name">{trap.name}</h4>
                    {trap.trigger && (
                      <p><span className="label">Trigger:</span> {trap.trigger}</p>
                    )}
                    {trap.effect && (
                      <p><span className="label">Effect:</span> {trap.effect}</p>
                    )}
                    {trap.dr && (
                      <p><span className="label">DR:</span> {trap.dr}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {activeTab === 'secrets' && <SecretsReveal secrets={node.contents.secrets} />}
          </div>
        </section>
      )}

      {node.rules && node.rules.length > 0 && (
        <details className="local-rules">
          <summary>Local Rules ({node.rules.length})</summary>
          <ul>
            {node.rules.map((r, i) => (
              <li key={i}>
                <strong>{r.title}.</strong> {r.text}
              </li>
            ))}
          </ul>
        </details>
      )}

      <GMNotes
        notes={node.gm_notes}
        scratchNotes={scratchNotes}
        onScratchChange={onScratchChange}
      />

      {node.exits && node.exits.length > 0 && (
        <footer className="exits">
          <h3 className="exits__head">EXITS</h3>
          <div className="exits__grid">
            {node.exits.map((exit) => (
              <ExitButton
                key={exit.id}
                exit={exit}
                onClick={onExit}
                unlocked={unlockedExits.includes(exit.id)}
              />
            ))}
          </div>
        </footer>
      )}
    </main>
  );
}
