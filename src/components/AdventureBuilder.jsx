import { useEffect, useMemo, useState } from 'react';
import { validateAdventure, slugify } from '../utils/validate.js';
import { saveUserAdventure } from '../utils/library.js';
import { generateScenario } from '../utils/generateScenario.js';
import NumberField from './NumberField.jsx';

const TEMPLATE = {
  meta: {
    id: 'new-adventure',
    title: 'A New Adventure',
    author: 'You',
    version: '0.1',
    system: 'morkborg',
    description: 'One line description.',
    startNode: 'start',
    license: 'Original content.',
  },
  nodes: [
    {
      id: 'start',
      title: 'The Beginning',
      type: 'location',
      atmosphere: 'Evocative 1-2 sentence description.',
      read_aloud: 'Text the GM reads directly to players.',
      contents: {
        description: 'GM-facing description of what is here.',
        items: [],
        enemies: [],
        npcs: [],
        traps: [],
        secrets: [],
      },
      rules: [],
      gm_notes: 'Private GM notes.',
      exits: [
        {
          id: 'start-to-end',
          label: 'Move on',
          target: 'end',
          condition: null,
          locked: false,
        },
      ],
      visited: false,
      tags: ['start'],
    },
    {
      id: 'end',
      title: 'The End',
      type: 'location',
      atmosphere: 'And then it ends.',
      read_aloud: 'The end. For now.',
      contents: { description: '', items: [], enemies: [], npcs: [], traps: [], secrets: [] },
      rules: [],
      gm_notes: '',
      exits: [],
      visited: false,
      tags: ['end'],
    },
  ],
};

const BLANK_ENEMY = () => ({ name: '', hp: 0, morale: '—', speed: 'normal', attack: '', special: '', notes: '' });
const BLANK_NPC = () => ({ name: '', description: '', attitude: 'neutral', notes: '' });
const BLANK_TRAP = () => ({ name: '', trigger: '', effect: '', dr: '' });
const BLANK_RULE = () => ({ title: '', text: '' });
const BLANK_EXIT = () => ({ id: '', label: '', target: '', condition: null, locked: false });
const BLANK_NODE = (i) => ({
  id: `node-${i}`,
  title: 'New Location',
  type: 'location',
  atmosphere: '',
  read_aloud: '',
  contents: { description: '', items: [], enemies: [], npcs: [], traps: [], secrets: [] },
  rules: [],
  gm_notes: '',
  exits: [],
  visited: false,
  tags: [],
});

export default function AdventureBuilder({ initial, onSave, onClose }) {
  const [text, setText] = useState(() =>
    JSON.stringify(initial || TEMPLATE, null, 2)
  );
  const [view, setView] = useState('structured'); // 'structured' | 'json'
  const [savedMessage, setSavedMessage] = useState(null);
  const [openNode, setOpenNode] = useState(null);

  const { parsed, parseError } = useMemo(() => {
    try {
      return { parsed: JSON.parse(text), parseError: null };
    } catch (e) {
      return { parsed: null, parseError: e.message };
    }
  }, [text]);

  const validation = useMemo(() => {
    if (!parsed) return null;
    return validateAdventure(parsed);
  }, [parsed]);

  // Open the first node by default once parsed; re-seed if the currently-open
  // node was deleted or no longer exists in the parsed adventure (e.g. after a
  // delete, rename, or random-generate).
  useEffect(() => {
    const ids = parsed?.nodes?.map((n) => n.id) ?? [];
    if (ids.length === 0) {
      if (openNode !== null) setOpenNode(null);
      return;
    }
    if (!openNode || !ids.includes(openNode)) {
      setOpenNode(ids[0]);
    }
  }, [openNode, parsed]);

  const writeParsed = (next) => setText(JSON.stringify(next, null, 2));

  const updateMeta = (field, value) => {
    if (!parsed) return;
    const next = { ...parsed, meta: { ...parsed.meta, [field]: value } };
    if (field === 'title' && (!parsed.meta.id || parsed.meta.id === slugify(parsed.meta.title))) {
      next.meta.id = slugify(value);
    }
    writeParsed(next);
  };

  const updateNode = (nodeId, mutator) => {
    if (!parsed) return;
    const next = {
      ...parsed,
      nodes: parsed.nodes.map((n) => (n.id === nodeId ? mutator(n) : n)),
    };
    writeParsed(next);
  };

  const addNode = () => {
    if (!parsed) return;
    const newNode = BLANK_NODE((parsed.nodes?.length ?? 0) + 1);
    writeParsed({ ...parsed, nodes: [...(parsed.nodes || []), newNode] });
    setOpenNode(newNode.id);
  };

  const removeNode = (id) => {
    if (!parsed) return;
    if (!window.confirm(`Delete node "${id}"? This cannot be undone in the editor.`)) return;
    const next = { ...parsed, nodes: parsed.nodes.filter((n) => n.id !== id) };
    writeParsed(next);
  };

  const duplicateNode = (id) => {
    if (!parsed) return;
    const src = parsed.nodes.find((n) => n.id === id);
    if (!src) return;
    // Find a free id by appending -copy / -copy-2 / …
    let base = `${src.id}-copy`;
    let candidate = base;
    let n = 2;
    const existing = new Set(parsed.nodes.map((x) => x.id));
    while (existing.has(candidate)) candidate = `${base}-${n++}`;
    const copy = {
      ...src,
      id: candidate,
      title: `${src.title} (copy)`,
      // Regenerate exit ids to avoid duplicates while preserving targets.
      exits: (src.exits || []).map((e) => ({
        ...e,
        id: `${candidate}-${e.id?.split('-').pop() ?? Math.random().toString(36).slice(2, 6)}`,
      })),
      tags: src.tags?.filter((t) => t !== 'start') ?? [], // never duplicate the start tag
    };
    writeParsed({ ...parsed, nodes: [...parsed.nodes, copy] });
    setOpenNode(candidate);
  };

  const renameNode = (oldId, newIdRaw) => {
    const newId = slugify(newIdRaw);
    if (!parsed || !newId || newId === oldId) return;
    if (parsed.nodes.some((n) => n.id === newId)) {
      window.alert(`A node with id "${newId}" already exists.`);
      return;
    }
    const next = {
      ...parsed,
      meta: parsed.meta.startNode === oldId
        ? { ...parsed.meta, startNode: newId }
        : parsed.meta,
      nodes: parsed.nodes.map((n) => {
        if (n.id === oldId) return { ...n, id: newId };
        // Rewrite exit targets.
        if (!n.exits?.some((e) => e.target === oldId)) return n;
        return {
          ...n,
          exits: n.exits.map((e) =>
            e.target === oldId ? { ...e, target: newId } : e
          ),
        };
      }),
    };
    writeParsed(next);
    setOpenNode(newId);
  };

  const handleSaveToLibrary = (thenLoad) => {
    if (!parsed || !validation?.ok) return;
    // Build a non-mutating copy with a derived id if needed, then write it back
    // to the editor so the textarea reflects what was actually persisted.
    const toSave = {
      ...parsed,
      meta: {
        ...parsed.meta,
        id: parsed.meta.id || slugify(parsed.meta.title),
      },
    };
    try {
      saveUserAdventure(toSave);
      if (toSave.meta.id !== parsed.meta.id) writeParsed(toSave);
      setSavedMessage(`Saved "${toSave.meta.title}" to your library.`);
      setTimeout(() => setSavedMessage(null), 3000);
      onSave?.(toSave, { thenLoad });
    } catch (err) {
      setSavedMessage(`⚠ Save failed: ${err.message}`);
      setTimeout(() => setSavedMessage(null), 5000);
    }
  };

  const handleDownload = () => {
    if (!parsed) return;
    const blob = new Blob([text], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `${parsed.meta?.id || 'adventure'}.json`;
    a.click();
    URL.revokeObjectURL(href);
  };

  const handlePrettify = () => {
    if (!parsed) return;
    writeParsed(parsed);
  };

  const handleReset = () => {
    if (!window.confirm('Reset the editor to the starter template? Unsaved changes will be lost.')) return;
    writeParsed(TEMPLATE);
  };

  const handleGenerateRandom = () => {
    if (!window.confirm('Replace the editor contents with a freshly generated random adventure?')) return;
    const generated = generateScenario();
    writeParsed(generated);
    setView('structured');
    setOpenNode(generated.nodes[0].id);
  };

  return (
    <div className="picker-overlay" role="dialog" aria-modal="true" aria-label="Adventure Builder">
      <div className="builder" onClick={(e) => e.stopPropagation()}>
        <header className="picker__header">
          <h2>ADVENTURE BUILDER</h2>
          <div className="builder__view-toggle" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'structured'}
              className={`tab ${view === 'structured' ? 'tab--active' : ''}`}
              onClick={() => setView('structured')}
            >
              structured
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'json'}
              className={`tab ${view === 'json' ? 'tab--active' : ''}`}
              onClick={() => setView('json')}
            >
              json
            </button>
          </div>
          <button
            type="button"
            className="iconbtn iconbtn--rules builder__generate"
            onClick={handleGenerateRandom}
            title="Generate a complete random adventure into the editor"
          >
            🎲 generate random
          </button>
          <button type="button" className="iconbtn" onClick={onClose}>
            ✕
          </button>
        </header>

        {view === 'json' ? (
          <div className="builder__cols">
            <section className="builder__meta">
              <h3>META</h3>
              <MetaForm parsed={parsed} onChange={updateMeta} />
              <div className="builder__snippets">
                <button type="button" className="iconbtn" onClick={handlePrettify}>
                  ⫯ format JSON
                </button>
                <button type="button" className="iconbtn" onClick={handleReset}>
                  ⟲ reset template
                </button>
              </div>
            </section>

            <section className="builder__editor">
              <h3>JSON</h3>
              <textarea
                className="builder__textarea"
                value={text}
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
                wrap="off"
              />
            </section>
          </div>
        ) : (
          <div className="builder__structured">
            <aside className="builder__nodes-list">
              <h3>NODES ({parsed?.nodes?.length ?? 0})</h3>
              <ul>
                {(parsed?.nodes ?? []).map((n) => (
                  <li
                    key={n.id}
                    className={`builder__node-item ${openNode === n.id ? 'builder__node-item--open' : ''} ${n.id === parsed.meta?.startNode ? 'builder__node-item--start' : ''}`}
                  >
                    <button
                      type="button"
                      className="builder__node-pick"
                      onClick={() => setOpenNode(n.id)}
                    >
                      <span className="builder__node-id">{n.id}</span>
                      <span className="builder__node-title">{n.title || '(untitled)'}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className="iconbtn" onClick={addNode}>
                + new node
              </button>
              <hr />
              <h3>META</h3>
              <MetaForm parsed={parsed} onChange={updateMeta} />
            </aside>

            <section className="builder__node-editor">
              {parsed && openNode ? (
                <NodeForm
                  node={parsed.nodes.find((n) => n.id === openNode)}
                  isStart={parsed.meta?.startNode === openNode}
                  allNodeIds={parsed.nodes.map((n) => ({ id: n.id, title: n.title }))}
                  onChange={(mutator) => updateNode(openNode, mutator)}
                  onRename={(newId) => renameNode(openNode, newId)}
                  onDelete={() => {
                    removeNode(openNode);
                    setOpenNode(parsed.nodes[0]?.id);
                  }}
                  onDuplicate={() => duplicateNode(openNode)}
                  onSetStart={() => updateMeta('startNode', openNode)}
                />
              ) : (
                <p className="empty">Pick a node on the left to edit, or create a new one.</p>
              )}
            </section>
          </div>
        )}

        <footer className="builder__footer">
          <div className="builder__status">
            {parseError ? (
              <span className="builder__error">⚠ JSON parse error: {parseError}</span>
            ) : validation && !validation.ok ? (
              <span className="builder__error">
                ⚠ {validation.errors.join(' · ')}
              </span>
            ) : (validation?.warnings?.length ?? 0) > 0 ? (
              <span className="builder__warn">
                ⚠ {validation.warnings.length} warning
                {validation.warnings.length > 1 ? 's' : ''}: {validation.warnings.join(' · ')}
              </span>
            ) : (
              <span className="builder__ok">✓ valid</span>
            )}
            {savedMessage && <span className="builder__saved">{savedMessage}</span>}
          </div>

          <div className="builder__actions">
            <button type="button" className="iconbtn" onClick={handleDownload} disabled={!parsed}>
              ⤓ download
            </button>
            <button
              type="button"
              className="iconbtn"
              onClick={() => handleSaveToLibrary(false)}
              disabled={!validation?.ok}
            >
              ⌑ save to library
            </button>
            <button
              type="button"
              className="iconbtn iconbtn--rules"
              onClick={() => handleSaveToLibrary(true)}
              disabled={!validation?.ok}
            >
              ▶ save & run
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function MetaForm({ parsed, onChange }) {
  if (!parsed?.meta) {
    return <p className="empty">Fix JSON parse error to enable meta editing.</p>;
  }
  return (
    <div className="builder__fields">
      <label>
        <span>Title</span>
        <input
          type="text"
          value={parsed.meta.title || ''}
          onChange={(e) => onChange('title', e.target.value)}
        />
      </label>
      <label>
        <span>ID (slug)</span>
        <input
          type="text"
          value={parsed.meta.id || ''}
          onChange={(e) => onChange('id', slugify(e.target.value))}
        />
      </label>
      <label>
        <span>Author</span>
        <input
          type="text"
          value={parsed.meta.author || ''}
          onChange={(e) => onChange('author', e.target.value)}
        />
      </label>
      <label>
        <span>System</span>
        <select
          value={parsed.meta.system || 'morkborg'}
          onChange={(e) => onChange('system', e.target.value)}
        >
          <option value="morkborg">Mörk Borg</option>
          <option value="ronin-borg">Ronin Borg</option>
        </select>
      </label>
      <label>
        <span>Start node id</span>
        <input
          type="text"
          value={parsed.meta.startNode || ''}
          list="meta-start-targets"
          onChange={(e) => onChange('startNode', e.target.value)}
          placeholder="pick or type"
        />
        <datalist id="meta-start-targets">
          {(parsed.nodes || []).map((n) => (
            <option key={n.id} value={n.id}>{n.title}</option>
          ))}
        </datalist>
      </label>
      <label className="builder__field-wide">
        <span>Description</span>
        <input
          type="text"
          value={parsed.meta.description || ''}
          onChange={(e) => onChange('description', e.target.value)}
        />
      </label>
      <label className="builder__field-wide">
        <span>License</span>
        <input
          type="text"
          value={parsed.meta.license || ''}
          onChange={(e) => onChange('license', e.target.value)}
        />
      </label>
    </div>
  );
}

function NodeForm({ node, isStart, allNodeIds, onChange, onRename, onDelete, onDuplicate, onSetStart }) {
  if (!node) return <p className="empty">Node not found.</p>;

  const upd = (field, val) => onChange((n) => ({ ...n, [field]: val }));
  const updContents = (field, val) =>
    onChange((n) => ({ ...n, contents: { ...(n.contents || {}), [field]: val } }));

  const updArray = (key, idx, patch) =>
    onChange((n) => {
      const arr = [...(n.contents?.[key] || [])];
      arr[idx] = typeof patch === 'function' ? patch(arr[idx]) : { ...arr[idx], ...patch };
      return { ...n, contents: { ...(n.contents || {}), [key]: arr } };
    });

  const pushArray = (key, item) =>
    onChange((n) => ({
      ...n,
      contents: {
        ...(n.contents || {}),
        [key]: [...(n.contents?.[key] || []), item],
      },
    }));

  const removeArray = (key, idx) =>
    onChange((n) => ({
      ...n,
      contents: {
        ...(n.contents || {}),
        [key]: (n.contents?.[key] || []).filter((_, i) => i !== idx),
      },
    }));

  const updTopArray = (key, idx, patch) =>
    onChange((n) => {
      const arr = [...(n[key] || [])];
      arr[idx] = typeof patch === 'function' ? patch(arr[idx]) : { ...arr[idx], ...patch };
      return { ...n, [key]: arr };
    });
  const pushTopArray = (key, item) =>
    onChange((n) => ({ ...n, [key]: [...(n[key] || []), item] }));
  const removeTopArray = (key, idx) =>
    onChange((n) => ({ ...n, [key]: (n[key] || []).filter((_, i) => i !== idx) }));

  return (
    <div className="node-form">
      <header className="node-form__header">
        <div className="node-form__title-row">
          <label className="node-form__id">
            <span>id</span>
            <input
              type="text"
              defaultValue={node.id}
              key={node.id}
              onBlur={(e) => {
                if (e.target.value && e.target.value !== node.id) onRename(e.target.value);
              }}
            />
          </label>
          <label className="node-form__title">
            <span>title</span>
            <input
              type="text"
              value={node.title || ''}
              onChange={(e) => upd('title', e.target.value)}
            />
          </label>
        </div>
        <div className="node-form__top-actions">
          {isStart ? (
            <span className="tag" title="This is the start node">★ start</span>
          ) : (
            <button type="button" className="iconbtn" onClick={onSetStart}>
              set as start
            </button>
          )}
          {onDuplicate && (
            <button type="button" className="iconbtn" onClick={onDuplicate} title="Duplicate this node as a template">
              ⎘ duplicate
            </button>
          )}
          <button type="button" className="iconbtn iconbtn--danger" onClick={onDelete}>
            ✕ delete node
          </button>
        </div>
      </header>

      <label className="node-form__field">
        <span>tags (comma separated)</span>
        <input
          type="text"
          value={(node.tags || []).join(', ')}
          onChange={(e) =>
            upd(
              'tags',
              e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            )
          }
        />
      </label>

      <label className="node-form__field">
        <span>atmosphere</span>
        <textarea
          rows={2}
          value={node.atmosphere || ''}
          onChange={(e) => upd('atmosphere', e.target.value)}
        />
      </label>

      <label className="node-form__field">
        <span>read aloud</span>
        <textarea
          rows={4}
          value={node.read_aloud || ''}
          onChange={(e) => upd('read_aloud', e.target.value)}
        />
      </label>

      <label className="node-form__field">
        <span>what is here (GM description)</span>
        <textarea
          rows={3}
          value={node.contents?.description || ''}
          onChange={(e) => updContents('description', e.target.value)}
        />
      </label>

      <ArrayEditor
        title="ITEMS"
        items={node.contents?.items || []}
        onAdd={() => pushArray('items', '')}
        onRemove={(i) => removeArray('items', i)}
        renderItem={(it, i) => (
          <input
            type="text"
            value={it}
            onChange={(e) =>
              onChange((n) => {
                const arr = [...(n.contents?.items || [])];
                arr[i] = e.target.value;
                return { ...n, contents: { ...(n.contents || {}), items: arr } };
              })
            }
            placeholder="Item description and mechanical note"
          />
        )}
      />

      <ArrayEditor
        title="ENEMIES"
        items={node.contents?.enemies || []}
        onAdd={() => pushArray('enemies', BLANK_ENEMY())}
        onRemove={(i) => removeArray('enemies', i)}
        renderItem={(e, i) => (
          <div className="grid-2">
            <label><span>name</span><input value={e.name || ''} onChange={(ev) => updArray('enemies', i, { name: ev.target.value })} /></label>
            <label><span>HP</span><NumberField value={e.hp ?? 0} onChange={(n) => updArray('enemies', i, { hp: n })} /></label>
            <label><span>Morale</span><input value={e.morale || ''} onChange={(ev) => updArray('enemies', i, { morale: ev.target.value })} /></label>
            <label><span>Speed</span><input value={e.speed || ''} onChange={(ev) => updArray('enemies', i, { speed: ev.target.value })} /></label>
            <label className="grid-full"><span>Attack</span><input value={e.attack || ''} onChange={(ev) => updArray('enemies', i, { attack: ev.target.value })} /></label>
            <label className="grid-full"><span>Special</span><textarea rows={2} value={e.special || ''} onChange={(ev) => updArray('enemies', i, { special: ev.target.value })} /></label>
            <label className="grid-full"><span>GM notes</span><textarea rows={2} value={e.notes || ''} onChange={(ev) => updArray('enemies', i, { notes: ev.target.value })} /></label>
          </div>
        )}
      />

      <ArrayEditor
        title="NPCs"
        items={node.contents?.npcs || []}
        onAdd={() => pushArray('npcs', BLANK_NPC())}
        onRemove={(i) => removeArray('npcs', i)}
        renderItem={(n, i) => (
          <div className="grid-2">
            <label><span>name</span><input value={n.name || ''} onChange={(ev) => updArray('npcs', i, { name: ev.target.value })} /></label>
            <label><span>attitude</span>
              <select value={n.attitude || 'neutral'} onChange={(ev) => updArray('npcs', i, { attitude: ev.target.value })}>
                <option>friendly</option><option>neutral</option><option>hostile</option>
              </select>
            </label>
            <label className="grid-full"><span>description</span><textarea rows={2} value={n.description || ''} onChange={(ev) => updArray('npcs', i, { description: ev.target.value })} /></label>
            <label className="grid-full"><span>GM notes</span><textarea rows={3} value={n.notes || ''} onChange={(ev) => updArray('npcs', i, { notes: ev.target.value })} /></label>
          </div>
        )}
      />

      <ArrayEditor
        title="TRAPS"
        items={node.contents?.traps || []}
        onAdd={() => pushArray('traps', BLANK_TRAP())}
        onRemove={(i) => removeArray('traps', i)}
        renderItem={(t, i) => (
          <div className="grid-2">
            <label className="grid-full"><span>name</span><input value={t.name || ''} onChange={(ev) => updArray('traps', i, { name: ev.target.value })} /></label>
            <label className="grid-full"><span>trigger</span><input value={t.trigger || ''} onChange={(ev) => updArray('traps', i, { trigger: ev.target.value })} /></label>
            <label className="grid-full"><span>effect</span><textarea rows={2} value={t.effect || ''} onChange={(ev) => updArray('traps', i, { effect: ev.target.value })} /></label>
            <label><span>DR</span><input value={t.dr || ''} onChange={(ev) => updArray('traps', i, { dr: ev.target.value })} /></label>
          </div>
        )}
      />

      <ArrayEditor
        title="SECRETS"
        items={node.contents?.secrets || []}
        onAdd={() => pushArray('secrets', '')}
        onRemove={(i) => removeArray('secrets', i)}
        renderItem={(s, i) => (
          <textarea
            rows={2}
            value={s}
            onChange={(e) =>
              onChange((n) => {
                const arr = [...(n.contents?.secrets || [])];
                arr[i] = e.target.value;
                return { ...n, contents: { ...(n.contents || {}), secrets: arr } };
              })
            }
            placeholder="Hidden until the GM taps to reveal at the table."
          />
        )}
      />

      <ArrayEditor
        title="LOCAL RULES"
        items={node.rules || []}
        onAdd={() => pushTopArray('rules', BLANK_RULE())}
        onRemove={(i) => removeTopArray('rules', i)}
        renderItem={(r, i) => (
          <div className="grid-2">
            <label className="grid-full"><span>title</span><input value={r.title || ''} onChange={(ev) => updTopArray('rules', i, { title: ev.target.value })} /></label>
            <label className="grid-full"><span>text</span><textarea rows={3} value={r.text || ''} onChange={(ev) => updTopArray('rules', i, { text: ev.target.value })} /></label>
          </div>
        )}
      />

      <label className="node-form__field">
        <span>GM notes (private)</span>
        <textarea
          rows={4}
          value={node.gm_notes || ''}
          onChange={(e) => upd('gm_notes', e.target.value)}
        />
      </label>

      <ArrayEditor
        title="EXITS"
        items={node.exits || []}
        onAdd={() => pushTopArray('exits', { ...BLANK_EXIT(), id: `${node.id}-exit-${(node.exits?.length || 0) + 1}` })}
        onRemove={(i) => removeTopArray('exits', i)}
        renderItem={(e, i) => (
          <div className="grid-2">
            <label><span>id</span><input value={e.id || ''} onChange={(ev) => updTopArray('exits', i, { id: ev.target.value })} /></label>
            <label>
              <span>target node id</span>
              <input
                value={e.target || ''}
                list={`exit-targets-${node.id}`}
                onChange={(ev) => updTopArray('exits', i, { target: ev.target.value })}
                placeholder="pick or type"
              />
            </label>
            <label className="grid-full"><span>label (shown to GM)</span><input value={e.label || ''} onChange={(ev) => updTopArray('exits', i, { label: ev.target.value })} /></label>
            <label className="grid-full"><span>condition (optional)</span><input value={e.condition || ''} onChange={(ev) => updTopArray('exits', i, { condition: ev.target.value || null })} /></label>
            <label className="checkbox"><input type="checkbox" checked={!!e.locked} onChange={(ev) => updTopArray('exits', i, { locked: ev.target.checked })} /> locked by default</label>
          </div>
        )}
      />

      {/* Datalist of all node ids for the exit-target field autocomplete. */}
      {allNodeIds && allNodeIds.length > 0 && (
        <datalist id={`exit-targets-${node.id}`}>
          {allNodeIds.map((n) => (
            <option key={n.id} value={n.id}>{n.title}</option>
          ))}
        </datalist>
      )}
    </div>
  );
}

function ArrayEditor({ title, items, onAdd, onRemove, renderItem }) {
  return (
    <fieldset className="array-editor">
      <legend>
        {title} <span className="array-editor__count">({items.length})</span>
      </legend>
      <ol>
        {items.map((it, i) => (
          <li key={i} className="array-editor__row">
            <div className="array-editor__row-body">{renderItem(it, i)}</div>
            <button
              type="button"
              className="iconbtn iconbtn--danger array-editor__remove"
              onClick={() => onRemove(i)}
              aria-label="Remove"
            >
              ✕
            </button>
          </li>
        ))}
      </ol>
      <button type="button" className="iconbtn" onClick={onAdd}>
        + add
      </button>
    </fieldset>
  );
}
