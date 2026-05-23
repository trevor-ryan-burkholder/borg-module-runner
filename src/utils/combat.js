// Pure combat helpers, kept free of React so they can be unit-tested and reused.
import { rollDie, rollExpr } from './dice.js';

let seq = 0;
const nextId = () => `c-${Date.now()}-${++seq}`;

// Mörk Borg initiative is side-based: each SIDE rolls a single d6, the higher
// acts first that round (rules-reference: "Each side rolls d6. Higher acts
// first."). There is no per-combatant turn order. Ties are rerolled so there is
// always a first mover.
export function rollSideInitiative() {
  let party = rollDie(6);
  let enemies = rollDie(6);
  let guard = 0;
  while (party === enemies && guard++ < 20) {
    party = rollDie(6);
    enemies = rollDie(6);
  }
  return { party, enemies };
}

export function parseMorale(value) {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  const m = String(value).match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

// Adventure data encodes enemy groups in a single stat block, marking the count
// in the name: "Bandit (×8)", "Cannon Goblin (×2)", "Goblin (×d4+1)". Pull that
// count out so a group expands into individual combatants, and clean it off the
// displayed name. Accepts × or x followed by an integer or a dice expression.
const COUNT_TOKEN = '[×x]\\s*(\\d*d\\d+(?:[+\\-]\\d+)?|\\d+)';
const COUNT_RE = new RegExp(COUNT_TOKEN, 'i');

function stripCount(name) {
  return String(name)
    // Drop a whole parenthetical that carries the count, e.g. " (×8)".
    .replace(new RegExp(`\\s*\\([^)]*${COUNT_TOKEN}[^)]*\\)`, 'i'), '')
    // Or a bare marker not wrapped in parens, e.g. " ×8".
    .replace(new RegExp(`\\s*${COUNT_TOKEN}\\b`, 'i'), '')
    .trim();
}

export function parseCount(name) {
  const m = String(name ?? '').match(COUNT_RE);
  if (!m) return { count: 1, cleanName: String(name ?? '').trim() };
  const n = Math.max(1, Math.min(24, rollExpr(m[1])));
  return { count: n, cleanName: stripCount(name) || String(name).trim() };
}

// Build a fresh combat roster from a node's enemies + non-dead party members.
// Enemy entries that encode a group count ("Bandit (×8)") are expanded into that
// many individual combatants.
export function buildCombatants({ enemies = [], partyMembers = [] }) {
  const combatants = [];
  partyMembers.forEach((m, idx) => {
    if (m.dead) return;
    combatants.push({
      id: nextId(),
      kind: 'pc',
      partyIndex: idx,
      memberId: m.id ?? null,
      name: m.name || `PC ${idx + 1}`,
      hp: m.hp ?? m.hpMax ?? 4,
      hpMax: m.hpMax ?? m.hp ?? 4,
      conditions: m.conditions ? m.conditions.split(',').map((s) => s.trim()).filter(Boolean) : [],
      dead: false,
    });
  });
  enemies.forEach((e, idx) => {
    const baseHp = typeof e.hp === 'number' ? e.hp : parseInt(String(e.hp), 10) || 1;
    const { count, cleanName } = parseCount(e.name || `Enemy ${idx + 1}`);
    for (let i = 0; i < count; i++) {
      combatants.push({
        id: nextId(),
        kind: 'enemy',
        name: count > 1 ? `${cleanName} ${i + 1}` : cleanName,
        hp: baseHp,
        hpMax: baseHp,
        morale: e.morale ?? null,
        conditions: [],
        dead: false,
      });
    }
  });
  return combatants;
}
