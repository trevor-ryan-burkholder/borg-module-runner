# Mörk Borg Module Runner — Generation Tasks

## Task 1: Rules Reference JSON

Generate a complete rules reference JSON file for the Mörk Borg Module Runner app. Use the following schema exactly:

```json
{
  "rules_reference": {
    "sections": [
      {
        "id": "section-id",
        "title": "Section Title",
        "entries": [
          {
            "term": "Term or Rule Name",
            "text": "Clear, concise explanation. Written for a GM to reference mid-session. No fluff."
          }
        ]
      }
    ]
  }
}
```

### Required Sections (use these exact IDs):

- `core-mechanics` — Tests, DR, Tier of Use, Omens, Pushing Rolls
- `combat` — Initiative, Attack, Defense, Critical hits, Fumbles, Broken, Death
- `conditions` — Bleeding, Frightened, Cursed, Infected, any others in core rules
- `powers-and-scrolls` — How to use scrolls, misuse consequences, Unclean vs Sacred
- `apocalypse` — Miseries, what triggers them, current effects
- `creatures` — Reading stat blocks, Morale, Fear quality
- `equipment` — Armor values, weapon qualities, encumbrance

### Requirements:

- Pull directly from official source PDFs in this project
- Every entry must be accurate to canon
- Write entries as brief GM reference notes — not flavor text
- Flag any entries where canon is ambiguous with [CANON CHECK]
- Output valid JSON only — no markdown wrapping, no preamble

-----

## Task 2: Graves Left Wanting Adventure JSON

Generate a complete adventure JSON file for Graves Left Wanting using the following schema:

```json
{
  "meta": {
    "title": "Graves Left Wanting",
    "author": "Fan adaptation",
    "version": "1.0",
    "description": "The party awakens in coffins in a forgotten graveyard.",
    "startNode": "first-node-id",
    "license": "Based on official Mörk Borg content. Independent production by Trevor Burkholder, published under the MÖRK BORG Third Party License."
  },
  "nodes": [
    {
      "id": "unique-id",
      "title": "Location Name",
      "type": "location",
      "atmosphere": "Evocative 1-2 sentence description. Mörk Borg voice.",
      "read_aloud": "Text the GM reads directly to players.",
      "contents": {
        "description": "GM-facing description of what is here.",
        "items": ["Item name and brief mechanical note"],
        "enemies": [
          {
            "name": "Enemy Name",
            "hp": 0,
            "morale": "value or -",
            "speed": "normal/slow/fast",
            "attack": "Attack name +modifier, Xd6 damage",
            "special": "Special ability if any",
            "notes": "GM notes on behavior"
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
            "dr": "DR to avoid or detect"
          }
        ],
        "secrets": ["Secret information the players can discover"]
      },
      "rules": [
        {
          "title": "Special Rule Name",
          "text": "How it works in this location"
        }
      ],
      "gm_notes": "Private GM information. What to emphasize, timing, connections to other nodes.",
      "exits": [
        {
          "id": "exit-unique-id",
          "label": "Descriptive exit label shown to GM",
          "target": "target-node-id",
          "condition": "Condition required to use this exit, or null",
          "locked": false
        }
      ],
      "visited": false,
      "tags": ["start", "combat", "puzzle", "hub", "end"]
    }
  ]
}
```

### Requirements:

- Map every location in Graves Left Wanting to a node
- Every enemy must have a complete stat block from the source material
- Exits must accurately reflect the physical layout of the adventure
- Locked exits must have conditions that match the adventure’s intended flow
- Include the creepy merchant as a final node with his items catalogued
- GM notes should add value beyond what’s in the read aloud
- Flag any gaps or ambiguities with [CANON CHECK]
- Output valid JSON only — no markdown wrapping, no preamble

-----

## Output

Produce two separate JSON files:

1. `rules-reference.json`
1. `graves-left-wanting.json`

Both must be valid JSON that can be directly imported into a React application.