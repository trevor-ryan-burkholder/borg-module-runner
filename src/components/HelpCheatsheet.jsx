// First-run-friendly help overlay listing every shortcut and panel. Triggered
// by the `h` key or the ☠ help button. Doubles as a feature inventory.

const SHORTCUTS = [
  { key: '?', label: 'Rules reference' },
  { key: 'b', label: 'Back one node' },
  { key: 'l', label: 'Library' },
  { key: 'm', label: 'Adventure map' },
  { key: 'd', label: 'Dice tray' },
  { key: 'k', label: 'Calendar of Nechrubel' },
  { key: 'p', label: 'Party tracker' },
  { key: 'n', label: 'NPC generator' },
  { key: 'c', label: 'Combat tracker' },
  { key: 't', label: 'Overland travel' },
  { key: 'a', label: 'Ambient sound' },
  { key: 'e', label: 'Bestiary' },
  { key: 'r', label: 'Random tables' },
  { key: 'g', label: 'Settlement generator' },
  { key: 'o', label: 'Loot ledger' },
  { key: 'v', label: 'The Graveyard' },
  { key: 'f', label: 'Find in adventure' },
  { key: 'i', label: 'Powers & Catastrophes' },
  { key: 'h', label: 'This cheatsheet' },
  { key: 's', label: 'Share dialog' },
  { key: 'Esc', label: 'Close topmost panel' },
];

const FEATURES = [
  { name: 'Combat Tracker', notes: 'Side-based d6 initiative (party vs enemies). +/− HP, conditions, morale 2d6 vs N. Grouped enemies expand automatically. "+ add" pulls reinforcements in mid-fight.' },
  { name: 'Party Tracker', notes: '4 abilities + HP + Omens + Silver per PC. Broken-table roller. ☾ rest restores HP & omens. Mark dead PCs into the Graveyard.' },
  { name: 'Loot Ledger', notes: 'Group treasure + per-item carrier. Tracks party silver.' },
  { name: 'Graveyard', notes: 'Auto-roster of dead PCs, where they died, the broken roll that killed them.' },
  { name: 'Misery / Calendar of Nechrubel', notes: 'Day counter + d6 verse roller + persistent log.' },
  { name: 'Dice Tray', notes: 'Test (d20+mod vs DR), damage (NdN+mod), single dice. Saved presets. Per-roll "+ notes" appends to current node.' },
  { name: 'Random Tables', notes: 'Every canonical d-table the GM needs at the table — Names, Pockets, Powers, Seeds, and more.' },
  { name: 'Powers & Catastrophes', notes: 'Browse/search Sacred Scrolls, Unclean Scrolls, Arcane Catastrophes. Roll random. Append to notes.' },
  { name: 'Bestiary', notes: 'Browsable, searchable. "+ add to gm notes" and "⧉ copy as enemy JSON" for the builder.' },
  { name: 'NPC Generator', notes: 'Roll a complete NPC with trait/body/habit/secret. Append to notes.' },
  { name: 'Overland Travel', notes: 'Roll-a-watch (weather + event + navigation). Persistent log.' },
  { name: 'Ambient Sound', notes: 'Web-Audio-only ambient channels (wind/rain/fire/drip/screams). Tomb / Storm / Battle / Tavern presets.' },
  { name: 'Settlement Generator', notes: 'Roll a hub-and-spoke settlement; runs as a real adventure (gate + spokes + sub-locations + sealed inner sanctum).' },
  { name: 'Dungeon Generator', notes: 'Entrance → body → climax with side rooms + locked shortcuts + boss. Runs as a real adventure.' },
  { name: 'Scenario Generator', notes: 'In the Adventure Builder: 🎲 generate a full Hook→Sites→Twist→Climax scenario, then save to your library.' },
  { name: 'Adventure Builder', notes: 'Structured form + JSON view, live validation, duplicate-node, datalist autocomplete for exit targets.' },
  { name: 'Library', notes: 'Bundled adventures + drag/drop or paste-URL imports. localStorage-only, no backend.' },
  { name: 'Share', notes: 'Gzipped adventure JSON in the URL hash. "⇄ test round-trip" verifies the link locally.' },
  { name: 'Map', notes: 'BFS-laid SVG node graph. Click or Enter/Space to jump. Responsive on mobile.' },
  { name: 'Bookmarks', notes: 'Star any node from the node header — bookmarked nodes show in the breadcrumb bar as quick-jumps.' },
  { name: 'Find / Search', notes: 'Search across the loaded adventure (titles, atmospheres, NPC/enemy names, GM notes) and jump.' },
];

export default function HelpCheatsheet({ open, onClose, theme, onSetTheme }) {
  if (!open) return null;
  return (
    <div className="picker-overlay" role="dialog" aria-modal="true" aria-label="Help" onClick={onClose}>
      <div className="picker picker--narrow help-sheet" onClick={(e) => e.stopPropagation()}>
        <header className="picker__header">
          <h2>HELP</h2>
          <button type="button" className="iconbtn" onClick={onClose}>✕</button>
        </header>

        <section className="picker__section">
          <h3>KEYBOARD SHORTCUTS</h3>
          <ul className="help-sheet__keys">
            {SHORTCUTS.map((s) => (
              <li key={s.key}>
                <kbd>{s.key}</kbd>
                <span>{s.label}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="picker__section">
          <h3>WHAT EACH PANEL DOES</h3>
          <ul className="help-sheet__features">
            {FEATURES.map((f) => (
              <li key={f.name}>
                <strong>{f.name}.</strong> {f.notes}
              </li>
            ))}
          </ul>
        </section>

        {theme && onSetTheme && (
          <section className="picker__section">
            <h3>VIEW</h3>
            <ul className="help-sheet__features">
              <li>
                <label>
                  <input
                    type="checkbox"
                    checked={!!theme.highContrast}
                    onChange={(e) => onSetTheme((t) => ({ ...t, highContrast: e.target.checked }))}
                  />{' '}
                  High-contrast palette (heavier borders, brighter yellow / white / red).
                </label>
              </li>
              <li>
                <label>
                  <input
                    type="checkbox"
                    checked={!!theme.largeText}
                    onChange={(e) => onSetTheme((t) => ({ ...t, largeText: e.target.checked }))}
                  />{' '}
                  Larger text for tablet glance-reading.
                </label>
              </li>
            </ul>
          </section>
        )}

        <section className="picker__section">
          <h3>TIPS</h3>
          <ul className="help-sheet__features">
            <li>Locked exits show <strong>🔒</strong>. Tap the lock to mark an exit unlocked permanently.</li>
            <li>Most generators load their result as an <em>unsaved session</em>. The banner has "save to library" to keep it.</li>
            <li>Dice rolls can be appended to the current node's GM notes for a roll log.</li>
            <li>The 🖨 button on a node opens a player-handout view you can print or project.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
