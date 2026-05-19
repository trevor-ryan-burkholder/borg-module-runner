# Mörk Borg Module Runner — Product Spec

## Overview

A client-side-only, single-page React application that turns a Mörk Borg adventure module into an interactive node-based GM tool. The GM navigates through the adventure in real time at the table. Every screen has everything needed for that location. Nothing to flip through.

Think: digital GM screen for a specific module.

## Core Philosophy

- Zero friction — open browser, start running
- Everything on screen — no book needed during play
- Mörk Borg aesthetic — looks like the game feels
- Portable — runs on GitHub Pages, shareable link, works on a tablet at the table
- Extensible — any module can be converted to JSON and run in it

-----

## User Flow

1. GM opens the app
1. Sees the adventure start node
1. Runs the scene using on-screen information
1. Taps/clicks an exit to move to the next location
1. New screen loads with full details for that node
1. Repeat until adventure ends

-----

## Adventure JSON Schema

```json
{
  "meta": {
    "title": "Adventure Title",
    "author": "Author Name",
    "version": "1.0",
    "description": "One line description.",
    "startNode": "first-node-id",
    "license": "Attribution text"
  },
  "nodes": [
    {
      "id": "unique-id",
      "title": "Location Name",
      "type": "location",
      "atmosphere": "Evocative 1-2 sentence description.",
      "read_aloud": "Text the GM reads directly to players.",
      "contents": {
        "description": "GM-facing description.",
        "items": ["Item and mechanical note"],
        "enemies": [
          {
            "name": "Enemy Name",
            "hp": 0,
            "morale": "value",
            "speed": "normal",
            "attack": "Attack +modifier, Xd6",
            "special": "Special ability",
            "notes": "Behavior notes"
          }
        ],
        "npcs": [
          {
            "name": "NPC Name",
            "description": "Brief description",
            "attitude": "hostile/neutral/friendly",
            "notes": "What they know, what they want"
          }
        ],
        "traps": [
          {
            "name": "Trap Name",
            "trigger": "What triggers it",
            "effect": "What it does",
            "dr": "DR value"
          }
        ],
        "secrets": ["Secret the players can discover"]
      },
      "rules": [
        {
          "title": "Special Rule",
          "text": "How it works here"
        }
      ],
      "gm_notes": "Private GM information.",
      "exits": [
        {
          "id": "exit-id",
          "label": "Exit description",
          "target": "target-node-id",
          "condition": "Required condition or null",
          "locked": false
        }
      ],
      "visited": false,
      "tags": ["start", "combat", "hub", "end"]
    }
  ]
}
```

-----

## Rules Reference JSON Schema

```json
{
  "rules_reference": {
    "sections": [
      {
        "id": "section-id",
        "title": "Section Title",
        "entries": [
          {
            "term": "Rule Name",
            "text": "Concise GM reference explanation."
          }
        ]
      }
    ]
  }
}
```

### Required Sections

- `core-mechanics`
- `combat`
- `conditions`
- `powers-and-scrolls`
- `apocalypse`
- `creatures`
- `equipment`

-----

## Components

### NodeView

Primary display. Full screen on tablet.

- **Top bar:** Adventure title | Node title | Visited indicator
- **Atmosphere block:** Italic styled text
- **Read Aloud block:** Distinct styling, toggle to hide after reading
- **Contents tabs/accordion:** Enemies | Items | NPCs | Traps | Secrets
- **Secrets:** Hidden, reveal on tap with transition
- **Rules panel:** Collapsible
- **GM Notes:** Toggle show/hide, distinct styling
- **Exits:** Bottom of screen, large targets, locked exits grayed with condition

### RulesPanel

- Persistent skull button on every screen
- Slide-in from right or full overlay
- Collapsible accordion sections
- Closes without losing node state

### EnemyCard

Full stat block display:

- Name, HP, Morale, Speed
- Attack with damage
- Special ability
- GM notes

### BreadcrumbTrail

- Path through adventure
- Tappable to revisit nodes

### PartyTracker (optional)

- PC names and HP
- Conditions
- Omens remaining
- Death count
- Dismissable

### GMNotes

- Toggle show/hide
- Visually distinct — not player-facing
- Dark background, different color scheme to signal private info

### SecretsReveal

- Hidden by default
- Tap to reveal
- Dramatic transition (fade in or slide)
- Visual indicator that secrets exist without revealing them

-----

## State Management

```javascript
const adventureState = {
  currentNode: "coffins",
  visitedNodes: [],
  history: [],
  partyState: {
    members: [],
    omens: 3,
    deaths: 0
  },
  unlockedExits: []
}
```

localStorage save for session persistence. Auto-save on node change.

-----

## Design System

Full Mörk Borg visual treatment matching the wiki.

**Colors:**

- `--black: #080808`
- `--dark: #111111`
- `--yellow: #f5c518`
- `--yellow-dim: #b8941a`
- `--red: #8b0000`
- `--red-bright: #cc0000`
- `--white: #e8e0d0`

**Typography:**

- Headings: UnifrakturMaguntia (Google Fonts)
- Body: Courier Prime (Google Fonts)

**Effects:**

- Film grain overlay (CSS SVG filter)
- Sticky nav
- Subtle red gradient accents

**Responsive:**

- Desktop: full layout
- Tablet: optimized (primary use case)
- Phone: functional

-----

## Phase 1 Deliverable

Working app with:

- Node navigation
- Enemy stat blocks
- Read aloud toggle
- GM notes toggle
- Secrets reveal
- Visited node tracking
- Rules reference panel
- Graves Left Wanting bundled
- GitHub Pages deployment

## Phase 2 (Future)

- Multiple adventure support
- Adventure builder UI
- Export to shareable link

## Phase 3 (Future)

- Community submissions
- Ronin Borg support
- Conan 2d20 module support

-----

## Deployment

GitHub Pages. Vite build config for base path. `gh-pages` branch.

-----

## Friday Deadline

The app needs to be functional enough to run Graves Left Wanting on Friday May 23. Phase 1 is the entire scope. Nothing else matters until it works at the table.