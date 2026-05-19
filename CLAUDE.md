# Mörk Borg Module Runner — CLAUDE.md

## What This Is

A client-side-only React PWA that serves as a full GM toolkit for running Mörk Borg sessions. The spine is node-based adventure navigation, but the app is a general table tool — party tracker, dice, misery clock, and more work whether or not an adventure is loaded.

No backend. No auth. No database. Client-side only, deployable to GitHub Pages, works offline.

## Authority Hierarchy

1. This CLAUDE.md file — highest authority
2. SPEC.md — defines features and behavior in detail
3. The JSON schema — fixed, do not modify without explicit instruction
4. Your judgment — for implementation details not covered above

## Tech Stack

- React (functional components, hooks only)
- Plain CSS (no Tailwind, no CSS-in-JS)
- Vite for bundling
- localStorage for session persistence
- Web Audio API for ambient sound (no external audio files)
- Deploy target: GitHub Pages

## Project Structure

```
src/
  components/
    NodeView.jsx
    ExitButton.jsx
    EnemyCard.jsx
    ItemList.jsx
    RulesPanel.jsx
    GMNotes.jsx
    BreadcrumbTrail.jsx
    PartyTracker.jsx
    SecretsReveal.jsx
    AdventurePicker.jsx
    AdventureBuilder.jsx
    ShareDialog.jsx
    DiceTray.jsx
    MiseryTracker.jsx
    MapView.jsx
    CombatTracker.jsx         ← planned
    AmbientMixer.jsx          ← planned
    NpcGenerator.jsx          ← planned
    OverlandTravel.jsx        ← planned
    CharacterGenerator.jsx    ← planned
    DungeonGenerator.jsx      ← planned
  data/
    adventures-registry.json
    [adventure-slug].json     (one per bundled adventure)
    rules-reference.json
    rules-reference-ronin-borg.json
  hooks/
    useAdventure.js
    useHistory.js
  utils/
    dice.js
    library.js
    loadAdventure.js
    share.js
    validate.js
  styles/
    theme.css
    components.css
  App.jsx
  main.jsx
public/
  manifest.webmanifest
  sw.js
  icon.svg
```

## Design System

Mörk Borg aesthetic throughout. Non-negotiable.

```css
--black: #080808
--dark: #111111
--yellow: #f5c518
--yellow-dim: #b8941a
--red: #8b0000
--red-bright: #cc0000
--white: #e8e0d0
--font-display: 'UnifrakturMaguntia', cursive
--font-body: 'Courier Prime', monospace
```

Import fonts from Google Fonts. Blackletter on all headings. Courier Prime for all body text. Film grain overlay on the app wrapper. System-specific accent palette when running Ronin Borg adventures.

## Keyboard Shortcuts

| Key | Panel |
|-----|-------|
| `?` | Rules reference |
| `b` | Back (history) |
| `l` | Library |
| `m` | Adventure map |
| `d` | Dice tray |
| `k` | Calendar of Nechrubel / Misery tracker |
| `p` | Party tracker |
| `s` | Share dialog |
| `c` | Combat tracker ← planned |
| `a` | Ambient sound mixer ← planned |
| `n` | NPC generator ← planned |
| `t` | Overland travel tool ← planned |
| `Esc` | Close active panel |

## What's Built

- Node-based adventure navigation with visited tracking
- Enemy stat blocks, item lists, NPC cards, traps, secrets reveal
- Read aloud blocks with hide toggle
- GM notes toggle (visually distinct)
- Breadcrumb trail with back-navigation
- Dice tray — all standard dice, d20+modifier with DR check, roll history
- Calendar of Nechrubel — day counter, d6 verse roll, misery log
- Party tracker — per-PC stats (Str/Agl/Pre/Tou, HP, Omens, silver, conditions, dead flag)
- Adventure map — SVG node graph, click to jump
- Rules reference panel — per-system, accordion sections
- Adventure builder — structured form view + JSON view with live validation
- Library — bundled adventures + localStorage uploads
- Share via URL — gzipped adventure in hash, no server
- Multi-system — Mörk Borg and Ronin Borg, system declared in `meta.system`
- PWA — service worker, offline capable, installable
- 9+ adventures bundled as JSON

## Planned Features

### Combat Tracker (`c`)
- Per-enemy HP bar, click to deal damage, mark dead
- Initiative order (drag to reorder)
- Conditions per combatant (broken, bleeding, on fire, etc.)
- Morale check button — rolls d20, compares to morale score, displays result
- Round counter
- Integrates with NodeView — enemies in current node auto-populate on open

### Ambient Sound Mixer (`a`)
- Web Audio API only — no external files, no hosting
- Synthesized loops: wind / cave drip / fire crackle / distant screams / rain
- Per-channel volume sliders
- Toggle on/off without losing mix state
- Persists mix settings in localStorage

### NPC Generator (`n`)
- Draws from canonical tables: Names, Terrible Traits, Reaction
- Outputs: name, occupation/class, faction affiliation, one trait, one secret
- One-click regenerate per field
- "Add to GM Notes" button copies to current node's notes

### Overland Travel Tool (`t`)
- Step-by-step journey mode: roll weather, roll encounter, roll navigation
- Uses canonical Overland Travel and Weather tables
- Log of events for the session
- Links encounters to bestiary entries where possible

### Character Generator
- Full character creation: class picker, 3d6 stat rolls, starting equipment
- Draws class data from wiki source
- Name + terrible trait from canonical tables
- Output: printable character card or "Add to Party" shortcut into PartyTracker

### Dungeon Generator
- Procedural dungeon: d6 rooms, each with description, encounter, trap, secret
- Draws from Bedeviled Dungeons, Traps, bestiary tables
- Output: runnable adventure JSON compatible with the module runner schema
- "Run this dungeon" button loads it directly into the adventure navigator

## State Structure

```javascript
{
  currentNode: "node-id",
  visitedNodes: [],
  history: [],
  partyState: {
    members: [],
    omens: 3,
    deaths: 0
  },
  unlockedExits: [],
  combatState: {           // planned
    active: false,
    round: 0,
    combatants: []
  },
  ambientState: {          // planned
    active: false,
    channels: {}
  }
}
```

## Adding a Bundled Adventure

1. Add JSON file to `src/data/`
2. Register in `adventures-registry.json`
3. Import in `utils/loadAdventure.js`
4. Open PR per CONTRIBUTING.md

## Forbidden

- No backend of any kind
- No user accounts or authentication
- No external API calls during runtime
- No external audio files (use Web Audio API synthesis)
- Do not modify the JSON schema without explicit instruction
- Do not use Tailwind
- Do not use CSS-in-JS
- Do not add dependencies without explicit approval

## When In Doubt

Build the simpler version first. This is a table tool — it needs to work fast on a tablet with bad wifi. Functional beats perfect.
