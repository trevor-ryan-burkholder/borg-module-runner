// Extract a bestiary JSON from wiki/creatures/*.md.
// Handles the irregular MB stat-block dialects seen in canon:
//   - "HP X, Morale Y, [armor], [attack]"            (most common)
//   - "HP X Morale Y No armor No direct attack"      (space-separated)
//   - "HP —, Morale —, ..."                          (incorporeal / no-attack)
//   - "Lone: HP X, ..." / "Pair: HP X, ..."          (variant stat lines)
//   - "Wields (dN): 1. ..." sub-tables               (Berserker)
//   - Prose stat blocks ("HP 30. Upon death, ...")   (Plant of Life)
//   - True stubs with no stat block at all           (Earthbound)
//
// Usage:  node scripts/extract-bestiary.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const CREATURES = path.join(ROOT, 'wiki', 'creatures');
const OUT = path.resolve(__dirname, '..', 'src', 'data', 'bestiary.json');
const FIXUPS_PATH = path.resolve(__dirname, 'bestiary-fixups.json');

const EM_DASH = /[—\-−]/; // em / en / hyphen / unicode minus — used for "no value"

function slugify(name) {
  return (
    name
      .replace(/\(.*?\)/g, '')
      .trim()
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'unknown'
  );
}

function first(rx, text, fallback = '') {
  const m = text.match(rx);
  return m ? (m[1] ?? '').trim() : fallback;
}

// Extract a value after a label, accepting either "Label X" or "Label: X".
// Stops at the next known label, comma, or end-of-line, whichever comes first.
function extractField(text, label) {
  const labels = ['HP', 'Morale', 'Speed', 'Attack', 'Special', 'Loot', 'Note', 'Notes'];
  const others = labels.filter((l) => l !== label).join('|');
  const rx = new RegExp(
    `\\b${label}\\b\\s*[:]?\\s*([^,\\n]*?)(?=\\s*(?:,|\\n|\\b(?:${others})\\b)|$)`,
    'i'
  );
  const m = text.match(rx);
  if (!m) return '';
  let v = m[1].trim();
  // Some stat lines are space-separated rather than comma-separated, e.g.
  //   "HP — Morale — No armor, No direct attack"
  // The lookahead can't break on "No armor" since it's not a labelled field,
  // so the value bleeds. Strip common armor/attack tokens that follow a dash.
  v = v.replace(/^([—\-−])\s+(No armor|No attack|.+)$/i, '$1');
  return v.replace(/^[—\-−]\s*/, '—');
}

// Find the line that introduces the stat block. Returns { lineIndex, prefix } where
// prefix is any "Lone:" / "Pair:" qualifier (kept so callers know there was a variant).
function findStatLine(lines) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/\bHP\b/.test(line) && /\bMorale\b/.test(line)) {
      const prefix = first(/^([^:]+):\s*HP/, line);
      return { lineIndex: i, line, prefix };
    }
  }
  // Fallback: a line that mentions HP without Morale (Plant of Life prose case).
  for (let i = 0; i < lines.length; i++) {
    if (/^HP\s+\d/.test(lines[i])) {
      return { lineIndex: i, line: lines[i], prefix: '' };
    }
  }
  return null;
}

// Build the attack field from the stat block, including any d6/d8 weapon tables
// that follow ("Wields (d4): 1. Long flail d8 ...").
function extractAttack(statLine, fullText) {
  const cleaned = statLine
    .replace(/^[^:]+:\s*/, '') // strip variant prefix like "Lone:"
    .split(/\s*,\s*|\s{2,}/) // commas OR runs of whitespace
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((tok) => !/^HP\b/i.test(tok))
    .filter((tok) => !/^Morale\b/i.test(tok))
    .filter((tok) => !/^Speed\b/i.test(tok));

  let attack = cleaned.join(', ');

  // Look for a "Wields (dN):" block and append weapon options.
  const wieldsMatch = fullText.match(/Wields\s*\(d\d+\):?([\s\S]*?)(?:\n\s*\n|\n\*\*|$)/i);
  if (wieldsMatch) {
    const list = wieldsMatch[1]
      .split(/\n/)
      .map((l) => l.replace(/^\s*\d+\.\s*/, '').trim())
      .filter((l) => l && !l.startsWith('**'));
    if (list.length > 0) {
      attack = attack
        ? `${attack}; wields: ${list.join(' / ')}`
        : `wields: ${list.join(' / ')}`;
    }
  }

  return attack;
}

function extractSpecial(md) {
  // Capture from "**Special:**" up to a blank line OR the next bold-label OR EOF.
  // Allow markdown inside (e.g. **Wordless Song.**).
  const m = md.match(/\*\*Special:\*\*\s*([\s\S]+?)(?:\n\s*\n|\n\*\*[A-Z][a-zA-Z ]+:\*\*|$)/);
  if (!m) return '';
  return m[1].trim().replace(/\s+/g, ' ');
}

function extractLore(md, statLineText) {
  // Prefer an explicit "**Lore:**" block when present.
  const explicit = md.match(/\*\*Lore:\*\*\s*([\s\S]+?)(?:\n\s*\n|\n\*\*[A-Z][a-zA-Z ]+:\*\*|$)/);
  if (explicit) return explicit[1].trim().replace(/\s+/g, ' ');

  // Otherwise the first plain paragraph after the stat line that isn't metadata.
  const after = statLineText ? md.split(statLineText)[1] ?? md : md;
  for (const p of after.split(/\n\s*\n/)) {
    const t = p.trim();
    if (!t) continue;
    if (t.startsWith('#')) continue; // H1 / heading
    if (t.startsWith('**')) continue;
    if (t.startsWith('*') && t.endsWith('*') && !t.includes('\n')) continue; // italic descriptor
    if (/^(HP|Lone|Pair|Wields)\b/i.test(t)) continue;
    if (/^[-*]\s/.test(t)) continue; // list item
    // Reject blocks that are just the H1+italic descriptor mashed together.
    if (/^#\s+/.test(t) || (/^# /.test(t.split('\n')[0]))) continue;
    return t.replace(/\s+/g, ' ').trim();
  }
  return '';
}

function parseCreature(md, filename) {
  const lines = md.split(/\r?\n/);
  const h1 = (lines.find((l) => l.startsWith('# ')) ?? '').replace(/^#\s+/, '').trim();
  const displayName = h1.replace(/\s*\(.*?\)\s*$/, '').trim();
  const descriptor = first(/^\*([^*\n]+)\*\s*$/m, md);
  const source = first(/^\*\*Source:\*\*\s*(.+)$/m, md);

  const stat = findStatLine(lines);
  const statLine = stat?.line ?? '';

  let hp = '';
  let morale = '';
  let attack = '';

  if (statLine) {
    hp = extractField(statLine, 'HP');
    morale = extractField(statLine, 'Morale');
    attack = extractAttack(statLine, md);
  }

  // Normalize "— Morale ..." style leakage where extractField caught the dash but
  // also pulled neighbouring words. Trim anything past a known label.
  hp = hp.replace(/\s+Morale\b.*$/i, '').trim();

  const special = extractSpecial(md);
  const lore = extractLore(md, statLine);

  return {
    id: slugify(displayName || filename),
    name: displayName || filename,
    descriptor,
    source,
    hp,
    morale,
    attack,
    special,
    lore,
    variant: stat?.prefix || '',
  };
}

function loadFixups() {
  try {
    const raw = fs.readFileSync(FIXUPS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed?.fixups ?? {};
  } catch {
    return {};
  }
}

function main() {
  const files = fs
    .readdirSync(CREATURES)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .sort();
  const entries = files.map((f) =>
    parseCreature(fs.readFileSync(path.join(CREATURES, f), 'utf8'), path.basename(f, '.md'))
  );

  // Strip residual markdown from extracted fields. Bestiary entries are surfaced
  // as plain text in the UI, not rendered as markdown — strip bold, italic, and
  // wiki-style cross-reference brackets ([[Plant of Life]] → Plant of Life).
  const stripMd = (s) =>
    typeof s === 'string'
      ? s
          // [[id|display text]] → display text
          .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
          // [[name]] → name
          .replace(/\[\[([^\]]+)\]\]/g, '$1')
          // **bold** → bold
          .replace(/\*\*(.+?)\*\*/g, '$1')
          // *italic* → italic (only when surrounded by whitespace or boundaries)
          .replace(/(^|\s)\*(.+?)\*(?=\s|$)/g, '$1$2')
          .trim()
      : s;
  for (const e of entries) {
    e.hp = stripMd(e.hp);
    e.morale = stripMd(e.morale);
    e.attack = stripMd(e.attack);
    e.special = stripMd(e.special);
    e.lore = stripMd(e.lore);
  }

  // Drop the empty `variant` field on entries that don't have one so it doesn't bloat the JSON.
  for (const e of entries) if (!e.variant) delete e.variant;

  // Apply hand-curated fixups for entries where the source MD doesn't yield clean stats.
  const fixups = loadFixups();
  let patched = 0;
  for (const e of entries) {
    const fix = fixups[e.id];
    if (!fix) continue;
    Object.assign(e, fix);
    patched += 1;
  }

  const out = {
    source: 'Extracted from wiki/creatures/*.md (Mörk Borg core + supplements).',
    count: entries.length,
    entries,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
  console.log(`Wrote ${entries.length} entries → ${OUT}`);
  console.log(`Applied ${patched} fixups from ${path.relative(ROOT, FIXUPS_PATH)}.`);

  // Quality report on entries that still look suspicious.
  const suspicious = entries.filter((e) => {
    if (e.stub) return false; // stubs are intentional
    if (!e.hp) return true;
    if (/Morale|armor/i.test(e.hp)) return true;
    // Accept numeric HP, em/en-dash placeholders, or short numeric expressions like "15".
    return !/^(\d{1,3}|[—\-−])$/.test(e.hp);
  });
  console.log(`\n${suspicious.length} entries still look suspicious:`);
  for (const e of suspicious) console.log(`  - ${e.name} → hp="${e.hp}"`);
}

main();
